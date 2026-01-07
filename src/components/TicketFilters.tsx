import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface TicketFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  clientes: any[];
  selectedCliente: string;
  onClienteChange: (value: string) => void;
  selectedPrioridade: string;
  onPrioridadeChange: (value: string) => void;
  ufvSolarzOptions?: string[];
  selectedUfvSolarz?: string;
  onUfvSolarzChange?: (value: string) => void;
}

const TicketFilters = ({
  searchTerm,
  onSearchChange,
  clientes,
  selectedCliente,
  onClienteChange,
  selectedPrioridade,
  onPrioridadeChange,
  ufvSolarzOptions = [],
  selectedUfvSolarz = 'todos',
  onUfvSolarzChange,
}: TicketFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Select value={selectedCliente} onValueChange={onClienteChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todos os clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os clientes</SelectItem>
          {clientes.map((cliente) => (
            <SelectItem key={cliente.id} value={cliente.id}>
              {cliente.empresa || cliente.profiles?.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {ufvSolarzOptions.length > 0 && onUfvSolarzChange && (
        <Select value={selectedUfvSolarz} onValueChange={onUfvSolarzChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="UFV/SolarZ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos UFV/SolarZ</SelectItem>
            {ufvSolarzOptions.map((ufv) => (
              <SelectItem key={ufv} value={ufv}>
                {ufv}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedPrioridade} onValueChange={onPrioridadeChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todas as prioridades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as prioridades</SelectItem>
          <SelectItem value="baixa">Baixa</SelectItem>
          <SelectItem value="media">Média</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="critica">Crítica</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default TicketFilters;
