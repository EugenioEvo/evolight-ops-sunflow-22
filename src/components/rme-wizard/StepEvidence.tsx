import { useState, useRef, useCallback } from "react";
import { Upload, Camera, Image as ImageIcon, Clipboard, X, Loader2, Eye } from "lucide-react";
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

export const StepEvidence = ({ formData, updateFormData, rmeId, osId }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; type: string }[]>([]);
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, type: string) => {
    if (!rmeId) {
      toast({ title: "Salve primeiro", description: "Salve o RME antes de enviar imagens", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${osId}/${rmeId}/${type}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("rme-evidences").upload(fileName, file);
      if (error) throw error;
      const { data: signedData } = await supabase.storage.from("rme-evidences").createSignedUrl(fileName, 60 * 60 * 24 * 365);
      setUploadedFiles((prev) => [...prev, { name: file.name, url: signedData?.signedUrl || '', type }]);
      toast({ title: "Upload concluído!" });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await uploadFile(file, type);
    }
    e.target.value = "";
  };

  const handlePaste = useCallback(async (type: string) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imageType });
          await uploadFile(file, type);
        }
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar a área de transferência. Copie uma imagem e tente novamente.", variant: "destructive" });
    }
  }, [rmeId, osId]);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const renderUploadArea = (type: string, label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
        {/* Hidden inputs */}
        <input ref={type === 'antes' ? cameraRef : undefined} type="file" accept="image/*" capture="environment" multiple onChange={(e) => handleFileInput(e, type)} className="hidden" id={`camera-${type}`} disabled={uploading || !rmeId} />
        <input ref={type === 'antes' ? galleryRef : undefined} type="file" accept="image/*" multiple onChange={(e) => handleFileInput(e, type)} className="hidden" id={`gallery-${type}`} disabled={uploading || !rmeId} />

        {uploading ? (
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
          <p className="text-xs text-center text-muted-foreground">Salve o RME primeiro para enviar imagens</p>
        )}

        {/* Thumbnails for this type */}
        {uploadedFiles.filter(f => f.type === type).length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {uploadedFiles.filter(f => f.type === type).map((file, idx) => (
              <div key={idx} className="relative group">
                <img src={file.url} alt={file.name} className="w-full h-20 object-cover rounded border" />
                <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="button" variant="secondary" size="icon" className="h-6 w-6" onClick={() => window.open(file.url, '_blank')}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => removeFile(uploadedFiles.indexOf(file))}>
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
        {renderUploadArea("antes", "Fotos Antes")}
        {renderUploadArea("depois", "Fotos Depois")}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600">{uploadedFiles.length} arquivo(s) enviado(s)</p>
        </div>
      )}

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
