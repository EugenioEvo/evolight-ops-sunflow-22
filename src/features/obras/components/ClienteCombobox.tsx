import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ClienteOption {
  id: string;
  empresa?: string | null;
  cnpj_cpf?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

interface Props {
  clientes: ClienteOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function ClienteCombobox({ clientes, value, onChange, placeholder = 'Buscar cliente por nome, CNPJ/CPF, cidade...' }: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => clientes.find((c) => c.id === value) ?? null, [clientes, value]);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal min-h-11"
          >
            <span className="truncate">
              {selected ? selected.empresa : <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              if (!search) return 1;
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__sem_cliente__"
                  onSelect={() => { onChange(null); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                  <span className="italic text-muted-foreground">Sem cliente (obra própria)</span>
                </CommandItem>
                {clientes.map((c) => {
                  const search = `${c.empresa ?? ''} ${c.cnpj_cpf ?? ''} ${c.cidade ?? ''} ${c.estado ?? ''}`;
                  return (
                    <CommandItem
                      key={c.id}
                      value={search}
                      onSelect={() => { onChange(c.id); setOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">{c.empresa}</span>
                        <span className="text-xs text-muted-foreground">
                          {[c.cnpj_cpf, c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button type="button" variant="ghost" size="icon" className="min-h-11" onClick={() => onChange(null)} aria-label="Limpar cliente">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
