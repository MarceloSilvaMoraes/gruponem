import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TicketWithContact = {
  id: string;
  contact_id: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  subject: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  contacts: {
    id: string;
    phone: string;
    name: string | null;
    profile_pic_url: string | null;
  } | null;
};

export function useTickets(statusFilter?: string, assignedFilter?: string) {
  return useQuery({
    queryKey: ["tickets", statusFilter, assignedFilter],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("*, contacts(*)")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (assignedFilter === "unassigned") {
        query = query.is("assigned_to", null);
      } else if (assignedFilter && assignedFilter !== "all" && assignedFilter !== "mine") {
        query = query.eq("assigned_to", assignedFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TicketWithContact[];
    },
    refetchInterval: 10000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, contacts(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TicketWithContact | null;
    },
  });
}

export function useTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: ["messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: ["ticket-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("status, assigned_to");
      if (error) throw error;
      const stats = {
        total: data.length,
        open: data.filter((t) => t.status === "open").length,
        in_progress: data.filter((t) => t.status === "in_progress").length,
        resolved: data.filter((t) => t.status === "resolved").length,
        closed: data.filter((t) => t.status === "closed").length,
        unassigned: data.filter((t) => !t.assigned_to).length,
      };
      return stats;
    },
    refetchInterval: 10000,
  });
}
