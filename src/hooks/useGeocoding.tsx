import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

export const useGeocoding = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const { toast } = useToast();

  const geocodeAddress = async (
    address: string, 
    ticketId?: string
  ): Promise<GeocodeResult | null> => {
    if (!address || address.trim() === '') {
      toast({
        title: 'Endereço inválido',
        description: 'O endereço não pode estar vazio',
        variant: 'destructive'
      });
      return null;
    }

    setLoading(true);
    try {
      // Tentar Mapbox primeiro (mais preciso), fallback para Nominatim
      let data, error;
      
      try {
        const mapboxResult = await supabase.functions.invoke('mapbox-geocode', {
          body: { address, ticket_id: ticketId }
        });
        data = mapboxResult.data;
        error = mapboxResult.error;
      } catch {
        const nominatimResult = await supabase.functions.invoke('geocode-address', {
          body: { address, ticket_id: ticketId }
        });
        data = nominatimResult.data;
        error = nominatimResult.error;
      }

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao geocodificar endereço');
      }

      return data.data;
    } catch (error: any) {
      toast({
        title: 'Erro ao localizar endereço',
        description: error.message || 'Não foi possível obter coordenadas',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Geocodificar múltiplos endereços em lote
  const geocodeBatch = async (tickets: Array<{ id: string; address: string }>) => {
    setLoading(true);
    setTotal(tickets.length);
    setCompleted(0);
    setProgress(0);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      
      try {
        await geocodeAddress(ticket.address, ticket.id);
        results.push({ id: ticket.id, success: true });
      } catch (error: any) {
        results.push({ 
          id: ticket.id, 
          success: false, 
          error: error.message 
        });
      }

      setCompleted(i + 1);
      setProgress(Math.round(((i + 1) / tickets.length) * 100));

      // Aguardar 1s entre requisições para respeitar rate limit
      if (i < tickets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setLoading(false);

    const successCount = results.filter(r => r.success).length;
    toast({
      title: 'Geocodificação concluída',
      description: `${successCount}/${tickets.length} endereços geocodificados com sucesso`
    });

    return results;
  };

  return { 
    geocodeAddress, 
    geocodeBatch,
    loading,
    progress,
    total,
    completed
  };
};
