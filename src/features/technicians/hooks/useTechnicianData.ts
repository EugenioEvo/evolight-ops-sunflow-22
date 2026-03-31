import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { technicianService } from "../services/technicianService";
import type { Tecnico } from "../types";

export const useTechnicianData = (isAdmin: boolean) => {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await technicianService.fetchAll();
      setTecnicos(data as Tecnico[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  return { tecnicos, loading, reload: loadData };
};
