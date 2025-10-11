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
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { 
          address, 
          ticket_id: ticketId,
          force_refresh: false 
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao geocodificar endereço');
      }

      return data.data;
    } catch (error: any) {
      console.error('Erro na geocodificação:', error);
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

  return { geocodeAddress, loading };
};
