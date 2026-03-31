import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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
        toast({ title: "Sucesso", description: "Insumo atualizado com sucesso!" });
      } else {
        await supplyService.createInsumo(data);
        toast({ title: "Sucesso", description: "Insumo criado com sucesso!" });
      }
      reload(); setIsInsumoDialogOpen(false); setEditingInsumo(null); insumoForm.reset();
    } catch {
      toast({ title: "Erro", description: "Erro ao salvar insumo.", variant: "destructive" });
    }
  };

  const onSubmitMovimentacao = async (data: MovimentacaoForm) => {
    try {
      if (!selectedInsumo) return;
      if (data.tipo === "saida" && data.quantidade > selectedInsumo.quantidade) {
        toast({ title: "Erro", description: "Quantidade de saída maior que estoque disponível.", variant: "destructive" });
        return;
      }
      await supplyService.createMovimentacao({ ...data, insumo_id: selectedInsumo.id });
      toast({ title: "Sucesso", description: `${data.tipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso!` });
      reload(); setIsMovimentacaoDialogOpen(false); setSelectedInsumo(null); movimentacaoForm.reset();
    } catch {
      toast({ title: "Erro", description: "Erro ao registrar movimentação.", variant: "destructive" });
    }
  };

  const onSubmitResponsavel = async (data: ResponsavelForm) => {
    try {
      await supplyService.createResponsavel(data);
      toast({ title: "Sucesso", description: "Responsável cadastrado com sucesso!" });
      reload(); setIsResponsavelDialogOpen(false); responsavelForm.reset();
    } catch {
      toast({ title: "Erro", description: "Erro ao cadastrar responsável.", variant: "destructive" });
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
      toast({ title: "Sucesso", description: "Insumo excluído com sucesso!" });
      reload();
    } catch {
      toast({ title: "Erro", description: "Erro ao excluir insumo.", variant: "destructive" });
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
