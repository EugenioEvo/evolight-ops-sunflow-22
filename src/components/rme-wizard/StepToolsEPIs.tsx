import { useState } from "react";
import { ChevronDown, Check, Search, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  category: string;
  item_key: string;
  label: string;
  checked: boolean;
}

interface Props {
  checklistItems: ChecklistItem[];
  updateChecklistItem: (itemId: string, checked: boolean) => void;
  categories: string[];
}

const categoryLabels: Record<string, string> = {
  ferramentas: "Ferramentas",
  epis: "EPIs (Equipamentos de Proteção)",
  medidas_preventivas: "Medidas Preventivas",
};

export const StepToolsEPIs = ({ checklistItems, updateChecklistItem, categories }: Props) => {
  const [openCategories, setOpenCategories] = useState<string[]>(categories);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const getItemsByCategory = (category: string) =>
    checklistItems
      .filter((item) => item.category === category)
      .filter((item) =>
        searchTerm === "" || item.label.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const getCategoryProgress = (category: string) => {
    const items = checklistItems.filter((item) => item.category === category);
    if (items.length === 0) return { checked: 0, total: 0 };
    const checked = items.filter((item) => item.checked).length;
    return { checked, total: items.length };
  };

  const applyPreset = () => {
    // Mark all items as checked (default preset)
    checklistItems
      .filter((item) => categories.includes(item.category))
      .forEach((item) => {
        if (!item.checked) {
          updateChecklistItem(item.id, true);
        }
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Ferramentas, EPIs e Medidas</h2>
          <p className="text-sm text-muted-foreground">
            Itens utilizados e medidas de segurança
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={applyPreset}>
          <Wand2 className="h-4 w-4 mr-2" />
          Preset Padrão
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar item..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {checklistItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Salve o RME primeiro para carregar os checklists</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => {
            const items = getItemsByCategory(category);
            const progress = getCategoryProgress(category);
            const isOpen = openCategories.includes(category);

            return (
              <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-lg border transition-colors",
                      isOpen ? "bg-muted/50 border-primary/30" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                          progress.checked === progress.total && progress.total > 0
                            ? "bg-green-500/20 text-green-600"
                            : "bg-amber-500/20 text-amber-600"
                        )}
                      >
                        {progress.checked === progress.total && progress.total > 0 ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          progress.checked
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{categoryLabels[category] || category}</p>
                        <p className="text-sm text-muted-foreground">
                          {progress.checked} de {progress.total} itens
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-2">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">
                        {searchTerm ? "Nenhum item encontrado" : "Nenhum item nesta categoria"}
                      </p>
                    ) : (
                      items.map((item) => (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            item.checked
                              ? "border-green-500/30 bg-green-500/5"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <Checkbox
                            checked={item.checked}
                            onCheckedChange={(checked) =>
                              updateChecklistItem(item.id, checked === true)
                            }
                          />
                          <span className={cn(item.checked && "text-muted-foreground")}>
                            {item.label}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};
