import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  useGlobalRealtime(() => {
    if (osIdFromUrl) loadOSFromUrl(osIdFromUrl);
  });

  useEffect(() => {
    if (profile && (profile.role === 'tecnico_campo' || profile.role === 'admin' || profile.role === 'engenharia' || profile.role === 'supervisao')) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (osIdFromUrl && !selectedOS) {
      loadOSFromUrl(osIdFromUrl);
    }
  }, [osIdFromUrl]);

  const loadOSFromUrl = async (osId: string) => {
    try {
      const osData = await rmeService.fetchOSById(osId);
      if (!osData) {
        toast({ title: 'OS não encontrada', description: 'A ordem de serviço não foi encontrada.', variant: 'destructive' });
        setSelectedOS(null);
        return;
      }
      setSelectedOS(osData);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar OS', description: error.message, variant: 'destructive' });
      setSelectedOS(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await rmeService.fetchRMEs();
      setRmes(data);
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRMEs = rmes.filter(rme =>
    rme.tickets?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.numero_ticket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canAccessRME = profile?.role === 'tecnico_campo' ||
    profile?.role === 'admin' ||
    profile?.role === 'engenharia' ||
    profile?.role === 'supervisao';

  const osLoading = !!osIdFromUrl && !selectedOS;

  return {
    rmes, filteredRMEs, selectedOS, setSelectedOS, loading, setLoading,
    searchTerm, setSearchTerm, user, profile, authLoading,
    canAccessRME, osLoading, navigate, loadOSFromUrl,
  };
};
