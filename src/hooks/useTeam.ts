import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  user_id: string;
  display_name: string;
  email: string | null;
  role: "admin" | "attendant";
};

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .order("display_name");
      if (error) throw error;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map<string, "admin" | "attendant">();
      roles.forEach((r: any) => {
        if (r.role === "admin" || roleMap.get(r.user_id) !== "admin") {
          roleMap.set(r.user_id, r.role);
        }
      });

      return profiles
        .filter((p: any) => roleMap.has(p.user_id)) // Only show users who have a role
        .map((p: any) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          email: p.email,
          role: roleMap.get(p.user_id)!,
        })) as TeamMember[];
    },
  });
}

export function useTicketActivity(ticketId: string) {
  return useQuery({
    queryKey: ["ticket-activity", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_activity")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });
}

export function useTicketNotes(ticketId: string) {
  return useQuery({
    queryKey: ["ticket-notes", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });
}

export function useMetricsByMember() {
  return useQuery({
    queryKey: ["metrics-by-member"],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("assigned_to, status, created_at, updated_at");
      if (error) throw error;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name");
      const nameMap = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.user_id, p.display_name])
      );

      const grouped = new Map<
        string,
        { name: string; total: number; open: number; in_progress: number; resolved: number; closed: number; avgMinutes: number; _sum: number; _count: number }
      >();
      tickets.forEach((t: any) => {
        const key = t.assigned_to ?? "__unassigned__";
        const name = t.assigned_to ? nameMap.get(t.assigned_to) ?? "—" : "Não atribuídos";
        const g =
          grouped.get(key) ??
          { name, total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, avgMinutes: 0, _sum: 0, _count: 0 };
        g.total += 1;
        g[t.status as "open" | "in_progress" | "resolved" | "closed"] += 1;
        if (t.status === "resolved" || t.status === "closed") {
          const diff = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 60000;
          g._sum += diff;
          g._count += 1;
        }
        grouped.set(key, g);
      });
      return Array.from(grouped.values()).map((g) => ({
        ...g,
        avgMinutes: g._count ? Math.round(g._sum / g._count) : 0,
      }));
    },
    refetchInterval: 15000,
  });
}