import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supplyService } from "../services/supplyService";
import { insumoSchema, saidaSchema } from "../types";
import type { InsumoForm, SaidaForm, Insumo } from "../types";

export const useSupplyActions = (reload: () => void) => {
  const { user, profile } = useAuth();
  const [isInsumoDialogOpen, setIsInsumoDialogOpen] = useState(false);
  const [isSaidaDialogOpen, setIsSaidaDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const { handleError } = useErrorHandler();

  const isTecnico = profile?.roles?.includes('tecnico_campo');

  const insumoForm = useForm<InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      nome: "", categoria: "", unidade: "unidade",
      estoque_minimo: 10, estoque_critico: 5,
      localizacao: "", fornecedor: "", observacoes: "", retornavel: false,
    },
  });

  const saidaForm = useForm<SaidaForm>({
    resolver: zodResolver(saidaSchema),
    defaultValues: { tipo: "insumo", quantidade: 1, tecnico_id: "", ordem_servico_id: "", observacoes: "" },
  });

  const onSubmitInsumo = async (data: InsumoForm) => {
    try {
      if (editingInsumo) {
        await supplyService.updateInsumo(editingInsumo.id, data);
        toast.success("Insumo atualizado!");
      } else {
        await supplyService.createInsumo(data);
        toast.success("Insumo criado!");
      }
      reload(); setIsInsumoDialogOpen(false); setEditingInsumo(null); insumoForm.reset();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao salvar insumo." });
    }
  };

  const onSubmitSaida = async (data: SaidaForm) => {
    try {
      if (!user?.id) {
        toast.error("Sessão inválida.");
        return;
      }
      if (data.tipo === "insumo" && !data.insumo_id) {
        toast.error("Selecione o insumo.");
        return;
      }
      if (data.tipo === "kit" && !data.kit_id) {
        toast.error("Selecione o KIT.");
        return;
      }
      // se for insumo avulso, snapshot da flag retornavel
      let retornavel = false;
      if (data.tipo === "insumo" && data.insumo_id) {
        const { data: ins } = await supabase.from('insumos').select('retornavel').eq('id', data.insumo_id).maybeSingle();
        retornavel = !!(ins as any)?.retornavel;
      } else {
        retornavel = true; // KITs são retornáveis por natureza
      }

      await supplyService.createSaida({
        insumo_id: data.tipo === "insumo" ? data.insumo_id : undefined,
        kit_id: data.tipo === "kit" ? data.kit_id : undefined,
        quantidade: data.quantidade,
        retornavel,
        tecnico_id: data.tecnico_id,
        ordem_servico_id: data.ordem_servico_id,
        registrado_por: user.id,
        observacoes: data.observacoes,
      });
      toast.success("Saída registrada! Aguardando validação do BackOffice.");
      reload(); setIsSaidaDialogOpen(false); saidaForm.reset();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao registrar saída." });
    }
  };

  const handleEditInsumo = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    insumoForm.reset({
      nome: insumo.nome, categoria: insumo.categoria, unidade: insumo.unidade,
      preco: insumo.preco, estoque_minimo: insumo.estoque_minimo, estoque_critico: insumo.estoque_critico,
      localizacao: insumo.localizacao, fornecedor: insumo.fornecedor, observacoes: insumo.observacoes,
      retornavel: !!insumo.retornavel,
    });
    setIsInsumoDialogOpen(true);
  };

  const handleDeleteInsumo = async (id: string) => {
    try {
      await supplyService.deleteInsumo(id);
      toast.success("Insumo excluído!");
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao excluir insumo." });
    }
  };

  const handleSaida = (insumo: Insumo) => {
    setSelectedInsumo(insumo);
    saidaForm.reset({
      tipo: "insumo",
      insumo_id: insumo.id,
      quantidade: 1,
      tecnico_id: "",
      ordem_servico_id: "",
      observacoes: "",
    });
    setIsSaidaDialogOpen(true);
  };

  return {
    insumoForm, saidaForm,
    isInsumoDialogOpen, setIsInsumoDialogOpen,
    isSaidaDialogOpen, setIsSaidaDialogOpen,
    editingInsumo, selectedInsumo,
    onSubmitInsumo, onSubmitSaida,
    handleEditInsumo, handleDeleteInsumo, handleSaida,
    isTecnico,
  };
};
