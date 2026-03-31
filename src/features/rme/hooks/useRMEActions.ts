import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = Array.from(event.target.files || []);
    const MAX_SIZE = 5 * 1024 * 1024;
    const MAX_COUNT = 10;
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    const currentCount = type === 'before' ? fotosBefore.length : fotosAfter.length;

    if (currentCount + files.length > MAX_COUNT) {
      toast({ title: 'Limite excedido', description: `Máximo de ${MAX_COUNT} fotos por tipo.`, variant: 'destructive' });
      return;
    }

    const invalidFiles = files.filter(f => !ALLOWED.includes(f.type) || f.size > MAX_SIZE);
    if (invalidFiles.length > 0) {
      toast({ title: 'Arquivos inválidos', description: 'Use apenas JPG/PNG/WEBP até 5MB.', variant: 'destructive' });
      return;
    }

    if (type === 'before') {
      setFotosBefore(prev => [...prev, ...files]);
    } else {
      setFotosAfter(prev => [...prev, ...files]);
    }
  };

  const removePhoto = (index: number, type: 'before' | 'after') => {
    if (type === 'before') {
      setFotosBefore(prev => prev.filter((_, i) => i !== index));
    } else {
      setFotosAfter(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addMaterial = () => setMateriais([...materiais, { insumo_id: '', nome: '', quantidade: 1 }]);
  const removeMaterial = (index: number) => setMateriais(materiais.filter((_, i) => i !== index));
  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materiais];
    updated[index] = { ...updated[index], [field]: value };
    setMateriais(updated);
  };

  const handleExportRMEPDF = async (rme: any) => {
    try {
      setExportingRMEId(rme.id);
      await rmeService.exportRMEPDF(rme);
      toast({ title: 'PDF Exportado', description: 'O relatório foi exportado com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar', description: error.message, variant: 'destructive' });
    } finally {
      setExportingRMEId(null);
    }
  };

  const handleSendRMEEmail = async (rme: any) => {
    try {
      setSendingEmailId(rme.id);
      await rmeService.sendRMEEmail(rme.id);
      toast({ title: 'Email enviado!', description: 'Resumo do RME enviado para o técnico.' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar email', description: error.message, variant: 'destructive' });
    } finally {
      setSendingEmailId(null);
    }
  };

  const resetForm = () => {
    setFotosBefore([]);
    setFotosAfter([]);
    setTecnicoSignature('');
    setClienteSignature('');
    setScannedEquipment(null);
    setMateriais([]);
  };

  return {
    fotosBefore, fotosAfter, tecnicoSignature, setTecnicoSignature,
    clienteSignature, setClienteSignature, scannedEquipment, setScannedEquipment,
    showQuickAdd, setShowQuickAdd, materiais, exportingRMEId, sendingEmailId,
    handlePhotoUpload, removePhoto, addMaterial, removeMaterial, updateMaterial,
    handleExportRMEPDF, handleSendRMEEmail, resetForm,
  };
};
