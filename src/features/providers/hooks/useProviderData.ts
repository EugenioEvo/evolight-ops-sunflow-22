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

  // Banco de RH: categorias operacionais externas (O&M + EPC).
  // Admin e engenharia são staff interno — gerenciados em /usuarios.
  const OPERATIONAL_CATEGORIES = ['tecnico', 'supervisao', 'lider', 'eletromecanico', 'sup_eletromecanico', 'lider_eletromecanico'];
  const operationalPrestadores = prestadores.filter(p =>
    OPERATIONAL_CATEGORIES.includes(p.categoria)
  );

  const pendingPrestadores = operationalPrestadores.filter(p =>
    (p as any).status_candidatura === 'pendente'
  );
  const rejectedPrestadores = operationalPrestadores.filter(p =>
    (p as any).status_candidatura === 'rejeitado'
  );
  const activePrestadores = operationalPrestadores.filter(p =>
    (p as any).status_candidatura === 'aprovado'
  );

  const matchSearch = (prestador: any) =>
    prestador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prestador.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(prestador.especialidades)
      ? prestador.especialidades.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
      : false);

  const filteredPrestadores = activePrestadores.filter(prestador => {
    if (!matchSearch(prestador)) return false;
    if (activeTab === "todos") return true;
    if (activeTab === "pendentes" || activeTab === "rejeitados") return false;
    return prestador.categoria === activeTab;
  });

  const filteredPending = pendingPrestadores.filter(matchSearch);
  const filteredRejected = rejectedPrestadores.filter(matchSearch);

  const categoryCounts = {
    todos: activePrestadores.length,
    pendentes: pendingPrestadores.length,
    rejeitados: rejectedPrestadores.length,
    tecnico: activePrestadores.filter(p => p.categoria === "tecnico").length,
    supervisao: activePrestadores.filter(p => p.categoria === "supervisao").length,
    lider: activePrestadores.filter(p => p.categoria === "lider").length,
    eletromecanico: activePrestadores.filter(p => p.categoria === "eletromecanico").length,
    sup_eletromecanico: activePrestadores.filter(p => p.categoria === "sup_eletromecanico").length,
    lider_eletromecanico: activePrestadores.filter(p => p.categoria === "lider_eletromecanico").length,
  };

  return {
    loading, searchTerm, setSearchTerm, activeTab, setActiveTab,
    pendingPrestadores: filteredPending,
    rejectedPrestadores: filteredRejected,
    filteredPrestadores,
    categoryCounts,
    reload: fetchPrestadores,
  };
};
