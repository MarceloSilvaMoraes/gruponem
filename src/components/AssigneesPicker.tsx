import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  excludeUserId?: string | null;
  placeholder?: string;
}

export function AssigneesPicker({ value, onChange, excludeUserId, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const { data: team } = useTeam();

  const options = useMemo(
    () => (team ?? []).filter((m) => m.user_id !== excludeUserId),
    [team, excludeUserId],
  );

  const selected = useMemo(
    () => options.filter((m) => value.includes(m.user_id)),
    [options, value],
  );

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 opacity-70" />
              {selected.length === 0
                ? placeholder ?? "Adicionar co-atendentes..."
                : `${selected.length} co-atendente(s)`}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar membro..." />
            <CommandList>
              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((m) => {
                  const checked = value.includes(m.user_id);
                  return (
                    <CommandItem
                      key={m.user_id}
                      value={`${m.display_name} ${m.email ?? ""}`}
                      onSelect={() => toggle(m.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{m.display_name}</span>
                        {m.email && (
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <Badge key={m.user_id} variant="secondary" className="gap-1 pr-1">
              {m.display_name}
              <button
                type="button"
                onClick={() => toggle(m.user_id)}
                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remover ${m.display_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}