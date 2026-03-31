import { useState, useEffect } from "react";
import { toast } from "sonner";
import { equipmentService } from "../services/equipmentService";
import type { Equipamento } from "../types";

export function useEquipmentData() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");

  const fetchEquipamentos = async () => {
    try {
      const data = await equipmentService.fetchAll();
      setEquipamentos(data as any);
    } catch (error) {
      toast.error('Erro ao carregar equipamentos');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const data = await equipmentService.fetchClientes();
      setClientes(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchEquipamentos();
    fetchClientes();
  }, []);

  const filteredEquipamentos = equipamentos.filter(eq => {
    const matchesSearch = eq.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.fabricante?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === "todos") return matchesSearch;
    return matchesSearch && eq.tipo === activeTab;
  });

  const tipoCounts = {
    todos: equipamentos.length,
    inversor: equipamentos.filter(e => e.tipo === "inversor").length,
    painel_solar: equipamentos.filter(e => e.tipo === "painel_solar").length,
    bateria: equipamentos.filter(e => e.tipo === "bateria").length,
    outros: equipamentos.filter(e => e.tipo === "outros").length,
  };

  return {
    equipamentos, clientes, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredEquipamentos, tipoCounts, fetchEquipamentos
  };
}
