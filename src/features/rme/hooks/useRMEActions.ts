import { useState } from 'react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { rmeService } from '../services/rmeService';
import type { RMEForm, Material, MAX_FILE_SIZE, MAX_FILES, ALLOWED_TYPES } from '../types';

export const useRMEActions = () => {
  const [fotosBefore, setFotosBefore] = useState<File[]>([]);
  const [fotosAfter, setFotosAfter] = useState<File[]>([]);
  const [tecnicoSignature, setTecnicoSignature] = useState('');
  const [clienteSignature, setClienteSignature] = useState('');
  const [scannedEquipment, setScannedEquipment] = useState<any>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [exportingRMEId, setExportingRMEId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const { handleError } = useErrorHandler();

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = Array.from(event.target.files || []);
    const MAX_SIZE = 5 * 1024 * 1024;
    const MAX_COUNT = 10;
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    const currentCount = type === 'before' ? fotosBefore.length : fotosAfter.length;

    if (currentCount + files.length > MAX_COUNT) {
      toast.error(`Máximo de ${MAX_COUNT} fotos por tipo.`);
      return;
    }

    const invalidFiles = files.filter(f => !ALLOWED.includes(f.type) || f.size > MAX_SIZE);
    if (invalidFiles.length > 0) {
      toast.error('Use apenas JPG/PNG/WEBP até 5MB.');
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
  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materiais];
    updated[index] = { ...updated[index], [field]: value };
    setMateriais(updated);
  };

  const handleExportRMEPDF = async (rme: any) => {
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

  const handleSendRMEEmail = async (rme: any) => {
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
