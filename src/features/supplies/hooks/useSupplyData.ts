import { useState, useEffect } from "react";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { supplyService } from "../services/supplyService";
import type { Insumo, InsumoSaida, InsumoDevolucao, Kit } from "../types";
import { getEstoqueStatus } from "../types";

export const useSupplyData = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [saidas, setSaidas] = useState<InsumoSaida[]>([]);
  const [devolucoes, setDevolucoes] = useState<InsumoDevolucao[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const { handleAsyncError } = useErrorHandler();

  const loadData = async () => {
    setLoading(true);
    const [data, kitsData] = await Promise.all([
      handleAsyncError(() => supplyService.loadAll(), { fallbackMessage: 'Erro ao carregar dados.' }),
      handleAsyncError(() => supplyService.loadKits(), { fallbackMessage: 'Erro ao carregar kits.' }),
    ]);
    if (data) {
      setInsumos(data.insumos as Insumo[]);
      setSaidas(data.saidas as InsumoSaida[]);
      setDevolucoes(data.devolucoes as InsumoDevolucao[]);
    }
    if (kitsData) setKits(kitsData as Kit[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredInsumos = insumos.filter((insumo) => {
    const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "retornaveis") return matchesSearch && insumo.retornavel;
    if (activeTab === "estoque-baixo") {
      const status = getEstoqueStatus(insumo.quantidade, insumo.estoque_minimo, insumo.estoque_critico);
      return matchesSearch && (status === "baixo" || status === "critico");
    }
    return matchesSearch && insumo.categoria === activeTab;
  });

  const categoriaCounts: Record<string, number> = {
    todos: insumos.length,
    retornaveis: insumos.filter(i => i.retornavel).length,
    "estoque-baixo": insumos.filter(i => {
      const status = getEstoqueStatus(i.quantidade, i.estoque_minimo, i.estoque_critico);
      return status === "baixo" || status === "critico";
    }).length,
  };

  return {
    insumos, saidas, devolucoes, kits, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredInsumos, categoriaCounts, reload: loadData,
  };
};
