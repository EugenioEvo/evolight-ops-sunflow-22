import { useState, useEffect, useCallback } from "react";
import { Camera, Image as ImageIcon, Clipboard, X, Loader2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { RMEFormData } from "@/pages/RMEWizard";

interface Props {
  formData: RMEFormData;
  updateFormData: (updates: Partial<RMEFormData>) => void;
  rmeId?: string;
  osId: string;
}

type PhotoType = "antes" | "depois";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

/**
 * Step 4 — Evidence.
 * Uploads to the `rme-fotos` bucket (the one supervisors already read from)
 * and persists signed URLs into formData.fotos_antes / fotos_depois so they
 * are saved on `rme_relatorios` and visible to supervisors / PDF export.
 */
export const StepEvidence = ({ formData, updateFormData, rmeId, osId }: Props) => {
  const [uploading, setUploading] = useState<PhotoType | null>(null);
  const { toast } = useToast();

  // Re-sign storage paths cached in formData so previews keep working across sessions.
  // We store signed URLs (which already include the path) — nothing else to do here,
  // but if a URL ever expires the supervisor list will refresh it.

  const uploadFiles = useCallback(async (files: File[], type: PhotoType) => {
    if (!rmeId) {
      toast({ title: "Salve primeiro", description: "Salve o RME antes de enviar imagens", variant: "destructive" });
      return;
    }
    setUploading(type);
    const newUrls: string[] = [];
    try {
      for (const file of files) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${osId}/${rmeId}/${type}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const { error } = await supabase.storage.from("rme-fotos").upload(fileName, file);
        if (error) throw error;
        const { data: signedData } = await supabase.storage.from("rme-fotos").createSignedUrl(fileName, SIGNED_URL_TTL);
        if (signedData?.signedUrl) newUrls.push(signedData.signedUrl);
      }
      const key = type === "antes" ? "fotos_antes" : "fotos_depois";
      updateFormData({ [key]: [...(formData[key] || []), ...newUrls] } as Partial<RMEFormData>);
      toast({ title: `${newUrls.length} foto(s) enviada(s)` });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }, [rmeId, osId, formData, updateFormData, toast]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, type: PhotoType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files), type);
    e.target.value = "";
  };

  const handlePaste = useCallback(async (type: PhotoType) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          files.push(new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imageType }));
        }
      }
      if (files.length > 0) await uploadFiles(files, type);
      else toast({ title: "Nenhuma imagem", description: "Copie uma imagem para a área de transferência primeiro." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar a área de transferência.", variant: "destructive" });
    }
  }, [uploadFiles, toast]);

  const removePhoto = (type: PhotoType, index: number) => {
    const key = type === "antes" ? "fotos_antes" : "fotos_depois";
    const next = (formData[key] || []).filter((_, i) => i !== index);
    updateFormData({ [key]: next } as Partial<RMEFormData>);
  };

  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)(\?|$)/i.test(url);

  const renderUploadArea = (type: PhotoType, label: string) => {
    const photos = type === "antes" ? formData.fotos_antes : formData.fotos_depois;
    const isUploading = uploading === type;
    return (
      <div className="space-y-2">
        <Label>{label} ({photos?.length || 0})</Label>
        <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
          <input type="file" accept="image/*,video/*" capture="environment" multiple onChange={(e) => handleFileInput(e, type)} className="hidden" id={`camera-${type}`} disabled={!!uploading || !rmeId} />
          <input type="file" accept="image/*,video/*" multiple onChange={(e) => handleFileInput(e, type)} className="hidden" id={`gallery-${type}`} disabled={!!uploading || !rmeId} />

          {isUploading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Enviando...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="flex flex-col h-auto py-3 gap-1" disabled={!rmeId} onClick={() => document.getElementById(`camera-${type}`)?.click()}>
                <Camera className="h-5 w-5" />
                <span className="text-xs">Câmera</span>
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex flex-col h-auto py-3 gap-1" disabled={!rmeId} onClick={() => document.getElementById(`gallery-${type}`)?.click()}>
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Galeria</span>
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex flex-col h-auto py-3 gap-1" disabled={!rmeId} onClick={() => handlePaste(type)}>
                <Clipboard className="h-5 w-5" />
                <span className="text-xs">Colar</span>
              </Button>
            </div>
          )}

          {!rmeId && (
            <p className="text-xs text-center text-muted-foreground">Salve o RME primeiro para enviar imagens ou vídeos</p>
          )}

          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map((url, idx) => (
                <div key={`${type}-${idx}`} className="relative group">
                  {isVideoUrl(url) ? (
                    <video src={url} className="w-full h-20 object-cover rounded border bg-black" muted playsInline preload="metadata" />
                  ) : (
                    <img src={url} alt={`${label} ${idx + 1}`} className="w-full h-20 object-cover rounded border" />
                  )}
                  <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button type="button" variant="secondary" size="icon" className="h-6 w-6" onClick={() => window.open(url, "_blank")}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => removePhoto(type, idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Evidências</h2>
        <p className="text-sm text-muted-foreground">Fotos e registros da manutenção realizada</p>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div>
          <Label className="text-base">Imagens Postadas</Label>
          <p className="text-sm text-muted-foreground">Marque se as imagens já foram enviadas por outro meio</p>
        </div>
        <Switch checked={formData.images_posted} onCheckedChange={(checked) => updateFormData({ images_posted: checked })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {renderUploadArea("antes", "Fotos/Vídeos Antes")}
        {renderUploadArea("depois", "Fotos/Vídeos Depois")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Módulos Limpos (qtd)</Label>
          <Input type="number" min="0" value={formData.modules_cleaned_qty} onChange={(e) => updateFormData({ modules_cleaned_qty: parseInt(e.target.value) || 0 })} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label>String Box (qtd)</Label>
          <Input type="number" min="0" value={formData.string_box_qty} onChange={(e) => updateFormData({ string_box_qty: parseInt(e.target.value) || 0 })} className="h-12" />
        </div>
      </div>
    </div>
  );
};
