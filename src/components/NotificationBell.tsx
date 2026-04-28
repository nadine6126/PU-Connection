import { useEffect, useState } from "react";
import { Bell, Calendar, CalendarCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format, addDays, isWithinInterval } from "date-fns";

type Notif = {
  id: string;
  kind: "calendar" | "rsvp" | "join_request";
  title: string;
  date: string;
  link: string;
  read?: boolean;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("notif_read_ids");
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const today = new Date();
    const weekEnd = addDays(today, 7).toISOString();

    const [{ data: cals }, { data: rsvps }, { data: ownedGroups }] = await Promise.all([
      supabase.from("calendar_events")
        .select("id, title, start_at")
        .eq("user_id", user.id)
        .gte("start_at", today.toISOString())
        .lte("start_at", weekEnd)
        .order("start_at"),
      supabase.from("event_rsvps")
        .select("id, event_id, events(id, title, start_at)")
        .eq("user_id", user.id),
      supabase.from("study_groups")
        .select("id, name")
        .eq("creator_id", user.id),
    ]);

    const out: Notif[] = [];

    // Calendar reminders
    (cals ?? []).forEach((c: any) => out.push({
      id: `cal-${c.id}`, kind: "calendar", title: c.title,
      date: c.start_at, link: "/dashboard/calendar",
    }));

    // Event RSVPs
    (rsvps ?? []).forEach((r: any) => {
      const e = r.events;
      if (!e) return;
      const d = new Date(e.start_at);
      if (isWithinInterval(d, { start: today, end: addDays(today, 14) })) {
        out.push({
          id: `rsvp-${r.id}`, kind: "rsvp", title: e.title,
          date: e.start_at, link: "/dashboard/events",
        });
      }
    });

    // Join requests untuk group yang user adalah owner
    // Cek juga group yang user adalah admin
    const { data: adminGroups } = await supabase
      .from("study_group_members")
      .select("group_id, study_groups(id, name)")
      .eq("user_id", user.id)
      .eq("role", "admin");

    const allManagedGroupIds = [
      ...((ownedGroups ?? []) as any[]).map((g: any) => g.id),
      ...((adminGroups ?? []) as any[]).map((g: any) => g.group_id),
    ];

    if (allManagedGroupIds.length > 0) {
      const { data: requests } = await supabase
        .from("study_group_requests")
        .select("id, group_id, user_id, created_at, study_groups(name), profiles(full_name)")
        .eq("status", "pending")
        .in("group_id", allManagedGroupIds)
        .order("created_at", { ascending: false });

      ((requests ?? []) as any[]).forEach((req: any) => {
        out.push({
          id: `req-${req.id}`,
          kind: "join_request",
          title: `${req.profiles?.full_name ?? "Someone"} wants to join ${req.study_groups?.name ?? "your group"}`,
          date: req.created_at,
          link: `/dashboard/study-groups/${req.group_id}`,
        });
      });
    }

    out.sort((a, b) => b.date.localeCompare(a.date));
    setItems(out);
  };

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [user]);

  // Realtime listener untuk join requests baru
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-requests")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_group_requests" },
        () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_group_requests" },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markAllRead = () => {
    const allIds = new Set(items.map(i => i.id));
    setReadIds(allIds);
    try { localStorage.setItem("notif_read_ids", JSON.stringify([...allIds])); } catch {}
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Mark semua sebagai read saat buka popover
      markAllRead();
    }
  };

  const handleClick = (notif: Notif) => {
    setOpen(false);
    navigate(notif.link);
  };

  const unread = items.filter(i => !readIds.has(i.id)).length;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">Upcoming reminders & events</p>
          </div>
          {items.length > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">You're all caught up 🎉</div>
          ) : (
            <div className="divide-y">
              {items.map(n => {
                const isRead = readIds.has(n.id);
                return (
                  <button key={n.id} onClick={() => handleClick(n)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex gap-3 items-start ${!isRead ? "bg-primary/5" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.kind === "join_request" ? "bg-orange-500/10" : "bg-primary/10"}`}>
                      {n.kind === "calendar" && <Calendar className="w-4 h-4 text-primary" />}
                      {n.kind === "rsvp" && <CalendarCheck className="w-4 h-4 text-primary" />}
                      {n.kind === "join_request" && <Users className="w-4 h-4 text-orange-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-foreground line-clamp-2">{n.title}</p>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.kind === "calendar" && "Reminder"}
                        {n.kind === "rsvp" && "Event RSVP"}
                        {n.kind === "join_request" && "Join Request"}
                        {" · "}{format(new Date(n.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};