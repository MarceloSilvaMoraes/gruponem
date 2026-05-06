import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = "menu_visibility";

export type MenuVisibility = Record<string, boolean>;

export function useMenuVisibility() {
  return useQuery({
    queryKey: ["app_settings", KEY],
    queryFn: async (): Promise<MenuVisibility> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (error) throw error;
      try {
        return data?.value ? JSON.parse(data.value as string) : {};
      } catch {
        return {};
      }
    },
    staleTime: 30_000,
  });
}

export function useUpdateMenuVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: MenuVisibility) => {
      const stringified = JSON.stringify(value);
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", KEY)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: stringified })
          .eq("key", KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: KEY, value: stringified });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings", KEY] }),
  });
}

export function isItemVisible(visibility: MenuVisibility | undefined, url: string) {
  if (!visibility) return true;
  if (!(url in visibility)) return true;
  return visibility[url] !== false;
}