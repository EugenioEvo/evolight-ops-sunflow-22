import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResolvedAddress {
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

interface Props {
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  onAddressResolved?: (addr: ResolvedAddress) => void;
}

export function CoordsField({ endereco, cidade, estado, cep, latitude, longitude, onChange, onAddressResolved }: Props) {
  const [loading, setLoading] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const composeAddress = () =>
    [endereco, cidade && estado ? `${cidade} - ${estado}` : cidade ?? estado, cep, 'Brasil']
      .filter(Boolean)
      .join(', ');

  async function geocode() {
    const address = composeAddress();
    if (!address || address === 'Brasil') {
      toast.error('Preencha endereço, cidade e UF antes de buscar coordenadas');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', { body: { address } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na busca');
      onChange(Number(data.data.latitude), Number(data.data.longitude));
      toast.success('Coordenadas resolvidas');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao buscar coordenadas');
    } finally {
      setLoading(false);
    }
  }

  async function reverseGeocode() {
    if (latitude == null || longitude == null) {
      toast.error('Informe latitude e longitude antes de buscar o endereço');
      return;
    }
    if (!onAddressResolved) return;
    setReversing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', {
        body: { latitude, longitude },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na busca');
      onAddressResolved(data.data as ResolvedAddress);
      toast.success('Endereço preenchido a partir das coordenadas');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao buscar endereço');
    } finally {
      setReversing(false);
    }
  }

  // Auto-trigger uma vez quando campos mínimos preenchidos e não há coords
  useEffect(() => {
    if (autoTriggered) return;
    if (latitude != null && longitude != null) return;
    if (!endereco || !cidade || !estado) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAutoTriggered(true);
      geocode();
    }, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco, cidade, estado, cep]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Coordenadas geográficas
        </Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={geocode} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MapPin className="h-3 w-3 mr-1" />}
            Buscar pelo endereço
          </Button>
          {onAddressResolved && (
            <Button type="button" variant="outline" size="sm" onClick={reverseGeocode} disabled={reversing}>
              {reversing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LocateFixed className="h-3 w-3 mr-1" />}
              Buscar endereço pelas coordenadas
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Input
            type="number"
            step="0.000001"
            placeholder="Latitude (-16.7)"
            value={latitude ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value), longitude)}
          />
        </div>
        <div>
          <Input
            type="number"
            step="0.000001"
            placeholder="Longitude (-49.2)"
            value={longitude ?? ''}
            onChange={(e) => onChange(latitude, e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Resolvido automaticamente a partir do endereço — ou faça o caminho inverso preenchendo lat/lng e clicando em "Buscar endereço pelas coordenadas". Usado pelo RDO para puxar clima/temperatura via Open-Meteo.
      </p>
    </div>
  );
}
