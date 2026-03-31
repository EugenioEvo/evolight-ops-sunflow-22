import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { providerService } from "../services/providerService";
import type { Prestador } from "../types";

export const useProviderData = () => {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const { handleAsyncError } = useErrorHandler();

  const fetchPrestadores = async () => {
    const data = await handleAsyncError(
      () => providerService.fetchAll(),
      { fallbackMessage: 'Erro ao carregar prestadores' }
    );
    if (data) setPrestadores(data as Prestador[]);
    setLoading(false);
  };

  useEffect(() => { fetchPrestadores(); }, []);

  const pendingPrestadores = prestadores.filter(p => !p.ativo);
  const activePrestadores = prestadores.filter(p => p.ativo);

  const filteredPrestadores = activePrestadores.filter(prestador => {
    const matchesSearch = prestador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prestador.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prestador.especialidades && Array.isArray(prestador.especialidades)
        ? prestador.especialidades.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
        : false);
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "pendentes") return false;
    return matchesSearch && prestador.categoria === activeTab;
  });

  const categoryCounts = {
    todos: activePrestadores.length,
    pendentes: pendingPrestadores.length,
    admin: activePrestadores.filter(p => p.categoria === "admin").length,
    engenharia: activePrestadores.filter(p => p.categoria === "engenharia").length,
    supervisao: activePrestadores.filter(p => p.categoria === "supervisao").length,
    tecnico: activePrestadores.filter(p => p.categoria === "tecnico").length,
  };

  return {
    loading, searchTerm, setSearchTerm, activeTab, setActiveTab,
    pendingPrestadores, filteredPrestadores, categoryCounts,
    reload: fetchPrestadores,
  };
};
