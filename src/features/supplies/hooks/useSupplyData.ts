import { useState, useEffect } from "react";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { supplyService } from "../services/supplyService";
import type { Insumo, Movimentacao, Responsavel } from "../types";
import { getEstoqueStatus } from "../types";

export const useSupplyData = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const { handleAsyncError } = useErrorHandler();

  const loadData = async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () => supplyService.loadAll(),
      { fallbackMessage: 'Erro ao carregar dados.' }
    );
    if (data) {
      setInsumos(data.insumos as Insumo[]);
      setResponsaveis(data.responsaveis as Responsavel[]);
      setMovimentacoes(data.movimentacoes as Movimentacao[]);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredInsumos = insumos.filter((insumo) => {
    const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "estoque-baixo") {
      const status = getEstoqueStatus(insumo.quantidade, insumo.estoque_minimo, insumo.estoque_critico);
      return matchesSearch && (status === "baixo" || status === "critico");
    }
    return matchesSearch && insumo.categoria === activeTab;
  });

  const categoriaCounts: Record<string, number> = {
    todos: insumos.length,
    paineis_solares: insumos.filter(i => i.categoria === "paineis_solares").length,
    inversores: insumos.filter(i => i.categoria === "inversores").length,
    estruturas_montagem: insumos.filter(i => i.categoria === "estruturas_montagem").length,
    cabos_conectores: insumos.filter(i => i.categoria === "cabos_conectores").length,
    equipamentos_medicao: insumos.filter(i => i.categoria === "equipamentos_medicao").length,
    ferramentas: insumos.filter(i => i.categoria === "ferramentas").length,
    componentes_eletricos: insumos.filter(i => i.categoria === "componentes_eletricos").length,
    manutencao: insumos.filter(i => i.categoria === "manutencao").length,
    "estoque-baixo": insumos.filter(i => {
      const status = getEstoqueStatus(i.quantidade, i.estoque_minimo, i.estoque_critico);
      return status === "baixo" || status === "critico";
    }).length,
  };

  return {
    insumos, movimentacoes, responsaveis, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredInsumos, categoriaCounts, reload: loadData,
  };
};
