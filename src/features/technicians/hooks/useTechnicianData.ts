import { useState, useEffect } from "react";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { technicianService } from "../services/technicianService";
import type { Tecnico } from "../types";

export const useTechnicianData = (isAdmin: boolean) => {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleAsyncError } = useErrorHandler();

  const loadData = async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () => technicianService.fetchAll(),
      { fallbackMessage: 'Erro ao carregar dados' }
    );
    if (data) setTecnicos(data as Tecnico[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  return { tecnicos, loading, reload: loadData };
};
