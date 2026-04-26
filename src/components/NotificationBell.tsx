import { useEffect, useState } from "react";
import { Bell, Calendar, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format, isWithinInterval, addDays } from "date-fns";

type Notif = {
  id: string;
  kind: "calendar" | "rsvp";
  title: string;
  date: string;
  link: string;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);

  const load = async () => {
    if (!user) return;
    const today = new Date();
    const weekEnd = addDays(today, 7).toISOString();

    const [{ data: cals }, { data: rsvps }] = await Promise.all([
      supabase.from("calendar_events")
        .select("id, title, start_at")
        .eq("user_id", user.id)
        .gte("start_at", today.toISOString())
        .lte("start_at", weekEnd)
        .order("start_at"),
      supabase.from("event_rsvps")
        .select("id, event_id, events(id, title, start_at)")
        .eq("user_id", user.id),
    ]);

    const out: Notif[] = [];
    (cals ?? []).forEach((c: any) => out.push({
      id: `cal-${c.id}`, kind: "calendar", title: c.title,
      date: c.start_at, link: "/dashboard/calendar",
    }));
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
    out.sort((a, b) => a.date.localeCompare(b.date));
    setItems(out);
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [user]);

  const unread = items.length;

  return (
    <Popover>
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
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">Upcoming reminders & events</p>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">You're all caught up 🎉</div>
          ) : (
            <div className="divide-y">
              {items.map(n => (
                <button key={n.id} onClick={() => navigate(n.link)}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {n.kind === "calendar"
                      ? <Calendar className="w-4 h-4 text-primary" />
                      : <CalendarCheck className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.kind === "calendar" ? "Reminder" : "Event RSVP"} · {format(new Date(n.date), "MMM d, yyyy")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
