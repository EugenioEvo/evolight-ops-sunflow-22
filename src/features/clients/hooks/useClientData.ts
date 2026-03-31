import { useState, useEffect } from "react";
import { toast } from "sonner";
import { clientService } from "../services/clientService";
import type { Cliente } from "../types";

export function useClientData() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const data = await clientService.fetchAll();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const filteredClientes = clientes.filter(cliente =>
    cliente.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cnpj_cpf.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.ufv_solarz && cliente.ufv_solarz.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return { clientes, loading, searchTerm, setSearchTerm, filteredClientes, fetchClientes };
}
