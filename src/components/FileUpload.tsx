import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, FileText, Image, Download, Eye, Camera, Clipboard, Video } from 'lucide-react';

interface FileUploadProps {
  ticketId: string;
  existingFiles?: string[];
  onFilesChange: (files: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  ticketId,
  existingFiles = [],
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<string[]>(existingFiles);
  const { toast } = useToast();

  // Sync internal state when existingFiles prop changes (e.g. switching between edit/new ticket)
  const lastExistingRef = useRef<string>(JSON.stringify(existingFiles));
  useEffect(() => {
    const serialized = JSON.stringify(existingFiles);
    if (serialized !== lastExistingRef.current) {
      lastExistingRef.current = serialized;
      setFiles(existingFiles);
    }
  }, [existingFiles]);

  const isImage = (filename: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const isVideo = (filename: string) => /\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)$/i.test(filename);

  const getFileUrl = async (path: string) => {
    const { data } = await supabase.storage.from('ticket-anexos').createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  };

  const uploadFiles = async (selectedFiles: File[]) => {
    if (files.length + selectedFiles.length > maxFiles) {
      toast({ title: 'Limite excedido', description: `Máximo de ${maxFiles} arquivos permitido`, variant: 'destructive' });
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    const oversizedFiles = selectedFiles.filter(f => f.size > maxBytes);
    if (oversizedFiles.length > 0) {
      toast({ title: 'Arquivo muito grande', description: `Tamanho máximo: ${maxSizeMB}MB`, variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const uploadedPaths: string[] = [];
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('ticket-anexos').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(fileName);
      }
      const newFiles = [...files, ...uploadedPaths];
      setFiles(newFiles);
      onFilesChange(newFiles);
      toast({ title: 'Sucesso', description: `${uploadedPaths.length} arquivo(s) enviado(s)` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao fazer upload', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    await uploadFiles(selectedFiles);
    event.target.value = '';
  };

  const handlePaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imageType });
          await uploadFiles([file]);
        }
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar a área de transferência.", variant: "destructive" });
    }
  }, [files, ticketId]);

  const handleRemoveFile = async (path: string) => {
    try {
      const { error } = await supabase.storage.from('ticket-anexos').remove([path]);
      if (error) throw error;
      const newFiles = files.filter(f => f !== path);
      setFiles(newFiles);
      onFilesChange(newFiles);
      toast({ title: 'Sucesso', description: 'Arquivo removido' });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao remover arquivo', variant: 'destructive' });
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('ticket-anexos').download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'arquivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Erro', description: 'Erro ao baixar arquivo', variant: 'destructive' });
    }
  };

  const handlePreview = async (path: string) => {
    const url = await getFileUrl(path);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={uploading || files.length >= maxFiles} onClick={() => document.getElementById('file-gallery')?.click()}>
          <Image className="h-4 w-4 mr-2" />
          {uploading ? 'Enviando...' : 'Galeria'}
        </Button>
        <Button type="button" variant="outline" disabled={uploading || files.length >= maxFiles} onClick={() => document.getElementById('file-camera')?.click()}>
          <Camera className="h-4 w-4 mr-2" />
          Câmera
        </Button>
        <Button type="button" variant="outline" disabled={uploading || files.length >= maxFiles} onClick={handlePaste}>
          <Clipboard className="h-4 w-4 mr-2" />
          Colar
        </Button>
        <span className="text-sm text-muted-foreground">
          {files.length}/{maxFiles} arquivos • Max {maxSizeMB}MB
        </span>
      </div>

      {/* Gallery input — accepts any file type */}
      <input id="file-gallery" type="file" multiple accept="*/*" onChange={handleFileUpload} className="hidden" />
      {/* Camera input — accepts photos and videos */}
      <input id="file-camera" type="file" accept="image/*,video/*" capture="environment" onChange={handleFileUpload} className="hidden" />

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((path) => {
            const filename = path.split('/').pop() || '';
            const isImg = isImage(filename);
            const isVid = isVideo(filename);
            return (
              <Card key={path} className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isImg ? <Image className="h-8 w-8 text-primary" /> : isVid ? <Video className="h-8 w-8 text-primary" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={filename}>{filename}</p>
                </div>
                <div className="flex gap-1">
                  {(isImg || isVid) && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handlePreview(path)} className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(path)} className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveFile(path)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
