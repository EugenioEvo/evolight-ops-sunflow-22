import { create } from 'zustand';

interface OrdemServico {
  id: string;
  numero_os: string;
  data_programada: string;
  status: string;
  [key: string]: any;
}

interface TechnicianStore {
  tecnicoId: string | null;
  ordensServico: OrdemServico[];
  lastFetch: number | null;
  setTecnicoId: (id: string | null) => void;
  setOrdensServico: (os: OrdemServico[]) => void;
  clearCache: () => void;
  shouldRefetch: () => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useTechnicianStore = create<TechnicianStore>((set, get) => ({
  tecnicoId: null,
  ordensServico: [],
  lastFetch: null,
  
  setTecnicoId: (id) => set({ tecnicoId: id }),
  
  setOrdensServico: (os) => set({ 
    ordensServico: os, 
    lastFetch: Date.now() 
  }),
  
  clearCache: () => set({ 
    ordensServico: [], 
    lastFetch: null 
  }),
  
  shouldRefetch: () => {
    const { lastFetch } = get();
    if (!lastFetch) return true;
    return Date.now() - lastFetch > CACHE_DURATION;
  },
}));
