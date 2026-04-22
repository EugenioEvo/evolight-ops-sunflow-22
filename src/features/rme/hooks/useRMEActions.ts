import { useState } from 'react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { rmeService } from '../services/rmeService';
import type { Material } from '../types';

/** Minimal RME row shape for export/email actions */
export interface RMERow {
  id: string;
  ordem_servico_id: string;
  tecnico_id: string;
  data_execucao: string;
  servicos_executados: string;
  condicoes_encontradas: string;
  created_at?: string;
  pdf_url?: string | null;
  fotos_antes?: string[] | null;
  fotos_depois?: string[] | null;
  materiais_utilizados?: Array<{ nome?: string; descricao?: string; quantidade?: number; tinha_estoque?: boolean }> | null;
  site_name?: string | null;
  weekday?: string | null;
  shift?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  service_type?: string[] | null;
  collaboration?: string[] | null;
  images_posted?: boolean | null;
  modules_cleaned_qty?: number | null;
  string_box_qty?: number | null;
  signatures?: Record<string, string> | null;
  /** Unified status: rascunho|pendente|aprovado|rejeitado */
  status?: string | null;
  observacoes_aprovacao?: string | null;
  aprovado_por?: string | null;
  data_aprovacao?: string | null;
  tickets?: {
    titulo?: string;
    numero_ticket?: string;
    endereco_servico?: string;
    clientes?: { empresa?: string; endereco?: string; ufv_solarz?: string | null };
  } | null;
  tecnicos?: { profiles?: { nome?: string } } | null;
}

export const useRMEActions = () => {
  const [fotosBefore, setFotosBefore] = useState<File[]>([]);
  const [fotosAfter, setFotosAfter] = useState<File[]>([]);
  const [tecnicoSignature, setTecnicoSignature] = useState('');
  const [clienteSignature, setClienteSignature] = useState('');
  const [scannedEquipment, setScannedEquipment] = useState<Record<string, string> | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [exportingRMEId, setExportingRMEId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const { handleError } = useErrorHandler();

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = Array.from(event.target.files || []);
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB for photos
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50 MB for videos
    const MAX_COUNT = 10;
    const ALLOWED_IMAGE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    const currentCount = type === 'before' ? fotosBefore.length : fotosAfter.length;

    if (currentCount + files.length > MAX_COUNT) {
      toast.error(`Máximo de ${MAX_COUNT} arquivos por tipo.`);
      return;
    }

    const invalidFiles = files.filter(f => {
      const isImage = ALLOWED_IMAGE.includes(f.type);
      const isVideo = f.type.startsWith('video/');
      if (!isImage && !isVideo) return true;
      if (isImage && f.size > MAX_IMAGE_SIZE) return true;
      if (isVideo && f.size > MAX_VIDEO_SIZE) return true;
      return false;
    });
    if (invalidFiles.length > 0) {
      toast.error('Use imagens (JPG/PNG/WEBP até 5MB) ou vídeos (até 50MB).');
      return;
    }

    if (type === 'before') setFotosBefore(prev => [...prev, ...files]);
    else setFotosAfter(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number, type: 'before' | 'after') => {
    if (type === 'before') setFotosBefore(prev => prev.filter((_, i) => i !== index));
    else setFotosAfter(prev => prev.filter((_, i) => i !== index));
  };

  const addMaterial = () => setMateriais([...materiais, { insumo_id: '', nome: '', quantidade: 1 }]);
  const removeMaterial = (index: number) => setMateriais(materiais.filter((_, i) => i !== index));
  const updateMaterial = (index: number, field: keyof Material, value: string | number) => {
    const updated = [...materiais];
    updated[index] = { ...updated[index], [field]: value };
    setMateriais(updated);
  };

  const handleExportRMEPDF = async (rme: RMERow) => {
    setExportingRMEId(rme.id);
    try {
      await rmeService.exportRMEPDF(rme);
      toast.success('O relatório foi exportado com sucesso!');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao exportar PDF' });
    } finally {
      setExportingRMEId(null);
    }
  };

  const handleSendRMEEmail = async (rme: RMERow) => {
    setSendingEmailId(rme.id);
    try {
      await rmeService.sendRMEEmail(rme.id);
      toast.success('Resumo do RME enviado para o técnico.');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao enviar email' });
    } finally {
      setSendingEmailId(null);
    }
  };

  const resetForm = () => {
    setFotosBefore([]); setFotosAfter([]);
    setTecnicoSignature(''); setClienteSignature('');
    setScannedEquipment(null); setMateriais([]);
  };

  return {
    fotosBefore, fotosAfter, tecnicoSignature, setTecnicoSignature,
    clienteSignature, setClienteSignature, scannedEquipment, setScannedEquipment,
    showQuickAdd, setShowQuickAdd, materiais, exportingRMEId, sendingEmailId,
    handlePhotoUpload, removePhoto, addMaterial, removeMaterial, updateMaterial,
    handleExportRMEPDF, handleSendRMEEmail, resetForm,
  };
};
