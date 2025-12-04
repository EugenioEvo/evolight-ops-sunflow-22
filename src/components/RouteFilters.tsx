import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Filter, Search, User, AlertCircle } from "lucide-react";

interface RouteFiltersProps {
  periodo: string;
  setPeriodo: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  tecnicoFilter: string;
  setTecnicoFilter: (value: string) => void;
  prioridadeFilter: string;
  setPrioridadeFilter: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  tecnicos?: Array<{ id: string; nome: string }>;
}

const RouteFiltersComponent = ({
  periodo,
  setPeriodo,
  statusFilter,
  setStatusFilter,
  tecnicoFilter,
  setTecnicoFilter,
  prioridadeFilter,
  setPrioridadeFilter,
  searchQuery,
  setSearchQuery,
  tecnicos = []
}: RouteFiltersProps) => {
  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Filtros Avançados</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="search" className="text-xs">
            <Search className="inline h-3 w-3 mr-1" />
            Buscar Endereço/Cliente
          </Label>
          <Input
            id="search"
            placeholder="Digite para buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="periodo" className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger id="periodo" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="amanha">Amanhã</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status" className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ordem_servico_gerada">OS Gerada</SelectItem>
              <SelectItem value="em_execucao">Em Execução</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="tecnico" className="text-xs">
            <User className="inline h-3 w-3 mr-1" />
            Técnico
          </Label>
          <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
            <SelectTrigger id="tecnico" className="mt-1">
              <SelectValue placeholder="Todos os técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os técnicos</SelectItem>
              {tecnicos.map(tec => (
                <SelectItem key={tec.id} value={tec.id}>
                  {tec.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="prioridade" className="text-xs">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            Prioridade
          </Label>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger id="prioridade" className="mt-1">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
};

export const RouteFilters = React.memo(RouteFiltersComponent);
