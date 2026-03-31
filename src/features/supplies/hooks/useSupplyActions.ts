import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { supplyService } from "../services/supplyService";
import { insumoSchema, movimentacaoSchema, responsavelSchema } from "../types";
import type { InsumoForm, MovimentacaoForm, ResponsavelForm, Insumo } from "../types";

export const useSupplyActions = (reload: () => void) => {
  const [isInsumoDialogOpen, setIsInsumoDialogOpen] = useState(false);
  const [isMovimentacaoDialogOpen, setIsMovimentacaoDialogOpen] = useState(false);
  const [isResponsavelDialogOpen, setIsResponsavelDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [movimentacaoTipo, setMovimentacaoTipo] = useState<"entrada" | "saida">("entrada");
  const { handleError } = useErrorHandler();

  const insumoForm = useForm<InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: { nome: "", categoria: "", unidade: "unidade", estoque_minimo: 10, estoque_critico: 5, localizacao: "", fornecedor: "", observacoes: "" },
  });

  const movimentacaoForm = useForm<MovimentacaoForm>({
    resolver: zodResolver(movimentacaoSchema),
    defaultValues: { tipo: "entrada", quantidade: 1, responsavel_id: "", motivo: "", observacoes: "" },
  });

  const responsavelForm = useForm<ResponsavelForm>({
    resolver: zodResolver(responsavelSchema),
    defaultValues: { nome: "", tipo: "funcionario", contato: "", observacoes: "" },
  });

  const onSubmitInsumo = async (data: InsumoForm) => {
    try {
      if (editingInsumo) {
        await supplyService.updateInsumo(editingInsumo.id, data);
        toast.success("Insumo atualizado com sucesso!");
      } else {
        await supplyService.createInsumo(data);
        toast.success("Insumo criado com sucesso!");
      }
      reload(); setIsInsumoDialogOpen(false); setEditingInsumo(null); insumoForm.reset();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao salvar insumo." });
    }
  };

  const onSubmitMovimentacao = async (data: MovimentacaoForm) => {
    try {
      if (!selectedInsumo) return;
      if (data.tipo === "saida" && data.quantidade > selectedInsumo.quantidade) {
        toast.error("Quantidade de saída maior que estoque disponível.");
        return;
      }
      await supplyService.createMovimentacao({ tipo: data.tipo, quantidade: data.quantidade, responsavel_id: data.responsavel_id, motivo: data.motivo, observacoes: data.observacoes, insumo_id: selectedInsumo.id });
      toast.success(`${data.tipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso!`);
      reload(); setIsMovimentacaoDialogOpen(false); setSelectedInsumo(null); movimentacaoForm.reset();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao registrar movimentação." });
    }
  };

  const onSubmitResponsavel = async (data: ResponsavelForm) => {
    try {
      await supplyService.createResponsavel(data);
      toast.success("Responsável cadastrado com sucesso!");
      reload(); setIsResponsavelDialogOpen(false); responsavelForm.reset();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao cadastrar responsável." });
    }
  };

  const handleEditInsumo = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    insumoForm.reset({
      nome: insumo.nome, categoria: insumo.categoria, unidade: insumo.unidade,
      preco: insumo.preco, estoque_minimo: insumo.estoque_minimo, estoque_critico: insumo.estoque_critico,
      localizacao: insumo.localizacao, fornecedor: insumo.fornecedor, observacoes: insumo.observacoes,
    });
    setIsInsumoDialogOpen(true);
  };

  const handleDeleteInsumo = async (id: string) => {
    try {
      await supplyService.deleteInsumo(id);
      toast.success("Insumo excluído com sucesso!");
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: "Erro ao excluir insumo." });
    }
  };

  const handleMovimentacao = (insumo: Insumo, tipo: "entrada" | "saida") => {
    setSelectedInsumo(insumo);
    setMovimentacaoTipo(tipo);
    movimentacaoForm.setValue("tipo", tipo);
    setIsMovimentacaoDialogOpen(true);
  };

  return {
    insumoForm, movimentacaoForm, responsavelForm,
    isInsumoDialogOpen, setIsInsumoDialogOpen,
    isMovimentacaoDialogOpen, setIsMovimentacaoDialogOpen,
    isResponsavelDialogOpen, setIsResponsavelDialogOpen,
    editingInsumo, selectedInsumo, movimentacaoTipo,
    onSubmitInsumo, onSubmitMovimentacao, onSubmitResponsavel,
    handleEditInsumo, handleDeleteInsumo, handleMovimentacao,
  };
};
