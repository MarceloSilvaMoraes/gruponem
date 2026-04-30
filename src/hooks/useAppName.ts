import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = "app_name";

export function useAppName() {
  return useQuery({
    queryKey: ["app_settings", KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string) || "Suporte";
    },
    staleTime: 60_000,
  });
}

export function useUpdateAppName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", KEY)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value })
          .eq("key", KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: KEY, value });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings", KEY] }),
  });
}