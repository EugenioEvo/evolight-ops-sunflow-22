import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { rmeService } from '../services/rmeService';

export const useRMEData = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const osIdFromUrl = searchParams.get('os');

  const [rmes, setRmes] = useState<any[]>([]);
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, profile, loading: authLoading } = useAuth();
  const { handleError, handleAsyncError } = useErrorHandler();

  useGlobalRealtime(() => {
    if (osIdFromUrl) loadOSFromUrl(osIdFromUrl);
  });

  useEffect(() => {
    if (profile && (profile.role === 'tecnico_campo' || profile.role === 'admin' || profile.role === 'engenharia' || profile.role === 'supervisao')) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (osIdFromUrl && !selectedOS) loadOSFromUrl(osIdFromUrl);
  }, [osIdFromUrl]);

  const loadOSFromUrl = async (osId: string) => {
    try {
      const osData = await rmeService.fetchOSById(osId);
      if (!osData) {
        handleError('A ordem de serviço não foi encontrada.');
        setSelectedOS(null);
        return;
      }
      setSelectedOS(osData);
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao carregar OS' });
      setSelectedOS(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await handleAsyncError(
      async () => { const data = await rmeService.fetchRMEs(); setRmes(data); },
      { fallbackMessage: 'Erro ao carregar dados' }
    );
    setLoading(false);
  };

  const filteredRMEs = rmes.filter(rme =>
    rme.tickets?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.numero_ticket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canAccessRME = profile?.role === 'tecnico_campo' ||
    profile?.role === 'admin' || profile?.role === 'engenharia' || profile?.role === 'supervisao';

  const osLoading = !!osIdFromUrl && !selectedOS;

  return {
    rmes, filteredRMEs, selectedOS, setSelectedOS, loading, setLoading,
    searchTerm, setSearchTerm, user, profile, authLoading,
    canAccessRME, osLoading, navigate, loadOSFromUrl,
  };
};
