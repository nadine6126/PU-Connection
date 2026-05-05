import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, ExternalLink, BookmarkPlus, BookmarkCheck, X, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { createPortal } from "react-dom";

type EventRow = {
  id: string; posted_by: string; title: string; description: string | null;
  start_at: string; end_at: string | null; location_or_link: string | null;
  event_type: string; status: string; is_verified: boolean;
  organizer_name: string | null; organizer_contact: string | null;
  external_register_url: string | null; cover_image_url: string | null;
  payment_status: string | null;
  rsvp_count?: number; user_interested?: boolean;
};

const EventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState("upcoming");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [savingCal, setSavingCal] = useState(false);

  const load = async () => {
    const { data: evs } = await supabase.from("events").select("*").order("start_at");
    const ids = ((evs ?? []) as any[]).map((e) => e.id);
    const { data: rsvps } = ids.length
      ? await supabase.from("event_rsvps").select("event_id, user_id").in("event_id", ids)
      : { data: [] as any };
    const counts: Record<string, number> = {};
    const mineMap: Record<string, boolean> = {};
    ((rsvps ?? []) as any[]).forEach((r) => {
      counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
      if (r.user_id === user?.id) mineMap[r.event_id] = true;
    });
    setEvents(((evs ?? []) as any[]).map((e) => ({
      ...e, rsvp_count: counts[e.id] ?? 0, user_interested: !!mineMap[e.id],
    })));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const toggleInterested = async (ev: EventRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (ev.user_interested) {
      await supabase.from("event_rsvps").delete().eq("event_id", ev.id).eq("user_id", user!.id);
      toast.success("Removed from interested");
    } else {
      const { error } = await supabase.from("event_rsvps").insert({ event_id: ev.id, user_id: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Marked as interested!");
    }
    load();
    if (selected?.id === ev.id) setSelected(prev => prev ? { ...prev, user_interested: !prev.user_interested, rsvp_count: (prev.rsvp_count ?? 0) + (prev.user_interested ? -1 : 1) } : null);
  };

  const saveToCalendar = async (ev: EventRow) => {
    if (!user) return;
    setSavingCal(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: `📅 ${ev.title}`,
      start_at: ev.start_at,
      end_at: ev.end_at ?? ev.start_at,
      description: ev.description ?? "",
    });
    setSavingCal(false);
    if (error && error.code !== "23505") { toast.error(error.message); return; }
    toast.success("Saved to your calendar!");
  };

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start_at) >= now);
  const past = events.filter(e => new Date(e.start_at) < now);

  const renderCard = (ev: EventRow) => (
    <Card
      key={ev.id}
      onClick={() => setSelected(ev)}
      className="hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5 duration-200 overflow-hidden"
    >
      {ev.cover_image_url ? (
        <img src={ev.cover_image_url} alt={ev.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Calendar className="w-10 h-10 text-primary/40" />
        </div>
      )}
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-2">{ev.title}</h3>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] capitalize">{ev.event_type}</Badge>
              {ev.is_verified && <Badge className="text-[10px]">✓ Verified</Badge>}
            </div>
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            {format(new Date(ev.start_at), "PPP · HH:mm")}
          </div>
          {ev.location_or_link && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{ev.location_or_link}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{ev.rsvp_count} interested</span>
          </div>
          <button
            onClick={(e) => toggleInterested(ev, e)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${ev.user_interested ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            {ev.user_interested ? <BookmarkCheck className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
            {ev.user_interested ? "Interested" : "Mark interested"}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Events & Webinars</h1>
        <p className="text-muted-foreground text-sm">Browse upcoming academic events and webinars.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">No upcoming events yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{upcoming.map(renderCard)}</div>
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          {past.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">No past events.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{past.map(renderCard)}</div>
          )}
        </TabsContent>
      </Tabs>

      {selected && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-10 p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-2xl mx-4 mb-10"
            onClick={e => e.stopPropagation()}
          >
            {selected.cover_image_url ? (
              <img src={selected.cover_image_url} alt={selected.title} className="w-full h-52 object-cover rounded-t-2xl" />
            ) : (
              <div className="w-full h-52 bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-2xl flex items-center justify-center">
                <Calendar className="w-16 h-16 text-primary/30" />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-xs capitalize">{selected.event_type}</Badge>
                    {selected.is_verified && <Badge className="text-xs">✓ Verified</Badge>}
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0 text-primary" />
                  <span>{format(new Date(selected.start_at), "EEEE, PPP · HH:mm")}</span>
                </div>
                {selected.end_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0 text-primary" />
                    <span>Until {format(new Date(selected.end_at), "HH:mm")}</span>
                  </div>
                )}
                {selected.location_or_link && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0 text-primary" />
                    <span>{selected.location_or_link}</span>
                  </div>
                )}
                {selected.organizer_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 shrink-0 text-primary" />
                    <span>{selected.organizer_name}{selected.organizer_contact ? ` · ${selected.organizer_contact}` : ""}</span>
                  </div>
                )}
              </div>
              {selected.description && (
                <div className="bg-secondary/50 rounded-xl p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{selected.rsvp_count} people interested</span>
              </div>
              <div className="flex gap-2 pt-2">
                {selected.external_register_url ? (
                  <Button className="flex-1" onClick={() => window.open(selected.external_register_url!, "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-2" />Register Now
                  </Button>
                ) : (
                  <Button className="flex-1" disabled variant="outline">Registration link not available</Button>
                )}
                <Button variant="outline" onClick={() => saveToCalendar(selected)} disabled={savingCal} title="Save to calendar">
                  <BookmarkPlus className="w-4 h-4" />
                </Button>
                <Button
                  variant={selected.user_interested ? "default" : "outline"}
                  onClick={(e) => toggleInterested(selected, e)}
                  title={selected.user_interested ? "Remove from interested" : "Mark as interested"}
                >
                  {selected.user_interested ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EventsPage;