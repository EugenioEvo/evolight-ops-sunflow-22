import { useState } from "react";
import { Upload, Image, X, Loader2 } from "lucide-react";
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
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!rmeId) {
      toast({
        title: "Salve primeiro",
        description: "Salve o RME antes de enviar imagens",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${osId}/${rmeId}/${type}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
          .from("rme-evidences")
          .upload(fileName, file);

        if (error) throw error;

        setUploadedFiles((prev) => [...prev, fileName]);
      }
      toast({ title: "Upload concluído!" });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Evidências</h2>
        <p className="text-sm text-muted-foreground">
          Fotos e registros da manutenção realizada
        </p>
      </div>

      {/* Images Posted Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div>
          <Label className="text-base">Imagens Postadas</Label>
          <p className="text-sm text-muted-foreground">
            Marque se as imagens já foram enviadas por outro meio
          </p>
        </div>
        <Switch
          checked={formData.images_posted}
          onCheckedChange={(checked) => updateFormData({ images_posted: checked })}
        />
      </div>

      {/* Upload Areas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fotos Antes</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e, "antes")}
              className="hidden"
              id="fotos-antes"
              disabled={uploading || !rmeId}
            />
            <label htmlFor="fotos-antes" className="cursor-pointer">
              {uploading ? (
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {rmeId ? "Clique para enviar" : "Salve primeiro para enviar"}
              </p>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fotos Depois</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e, "depois")}
              className="hidden"
              id="fotos-depois"
              disabled={uploading || !rmeId}
            />
            <label htmlFor="fotos-depois" className="cursor-pointer">
              {uploading ? (
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {rmeId ? "Clique para enviar" : "Salve primeiro para enviar"}
              </p>
            </label>
          </div>
        </div>
      </div>

      {/* Uploaded files indicator */}
      {uploadedFiles.length > 0 && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600">
            {uploadedFiles.length} arquivo(s) enviado(s)
          </p>
        </div>
      )}

      {/* Quantities */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Módulos Limpos (qtd)</Label>
          <Input
            type="number"
            min="0"
            value={formData.modules_cleaned_qty}
            onChange={(e) => updateFormData({ modules_cleaned_qty: parseInt(e.target.value) || 0 })}
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label>String Box (qtd)</Label>
          <Input
            type="number"
            min="0"
            value={formData.string_box_qty}
            onChange={(e) => updateFormData({ string_box_qty: parseInt(e.target.value) || 0 })}
            className="h-12"
          />
        </div>
      </div>
    </div>
  );
};
