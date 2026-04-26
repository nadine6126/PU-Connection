import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Plus, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";

type EventRow = {
  id: string; posted_by: string; title: string; description: string | null;
  start_at: string; end_at: string | null; location_or_link: string | null;
  event_type: string; status: string;
  rsvp_count?: number; user_rsvped?: boolean;
};

const EventsPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", event_date: "", event_time: "",
    location_or_link: "", event_type: "webinar",
  });
  const [saving, setSaving] = useState(false);

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
      ...e, rsvp_count: counts[e.id] ?? 0, user_rsvped: !!mineMap[e.id],
    })));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async () => {
    if (!form.title || !form.event_date) { toast.error("Title & date required"); return; }
    setSaving(true);
    const start = new Date(`${form.event_date}T${form.event_time || "09:00"}:00`).toISOString();
    const { error } = await supabase.from("events").insert({
      posted_by: user!.id,
      title: form.title, description: form.description || null,
      start_at: start,
      location_or_link: form.location_or_link || null, event_type: form.event_type,
      status: "upcoming",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Event published!");
    setOpen(false);
    setForm({ title: "", description: "", event_date: "", event_time: "", location_or_link: "", event_type: "webinar" });
    load();
  };

  const rsvp = async (ev: EventRow) => {
    if (ev.user_rsvped) {
      await supabase.from("event_rsvps").delete().eq("event_id", ev.id).eq("user_id", user!.id);
      toast.success("RSVP cancelled");
    } else {
      const { error } = await supabase.from("event_rsvps").insert({ event_id: ev.id, user_id: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success("You're registered!");
    }
    load();
  };

  const deleteEvent = async (ev: EventRow) => {
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Event deleted");
    load();
  };

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start_at) >= now);
  const past = events.filter(e => new Date(e.start_at) < now);
  const mine = events.filter(e => e.posted_by === user?.id);

  const renderCard = (ev: EventRow) => (
    <Card key={ev.id} className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{ev.title}</h3>
            <Badge variant="outline" className="text-xs mt-1 capitalize">{ev.event_type}</Badge>
          </div>
        </div>
        {ev.description && <p className="text-sm text-muted-foreground line-clamp-2">{ev.description}</p>}
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />{format(new Date(ev.start_at), "PPP · HH:mm")}</div>
          {ev.location_or_link && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{ev.location_or_link}</div>}
          <div className="flex items-center gap-2"><Users className="w-3 h-3" />{ev.rsvp_count} attending</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={ev.user_rsvped ? "outline" : "default"} className="flex-1" onClick={() => rsvp(ev)}>
            {ev.user_rsvped ? <><CheckCircle2 className="w-3 h-3 mr-1" />Registered</> : "Register"}
          </Button>
          {(isAdmin || ev.posted_by === user?.id) && (
            <Button size="sm" variant="ghost" onClick={() => deleteEvent(ev)}>Delete</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events & Webinars</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Manage campus events." : "Browse upcoming academic events."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Date</Label><Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
                  <div><Label>Time</Label><Input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} /></div>
                </div>
                <div><Label>Location / Link</Label><Input value={form.location_or_link} onChange={e => setForm({ ...form, location_or_link: e.target.value })} placeholder="Hall A or Zoom URL" /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.event_type} onValueChange={v => setForm({ ...form, event_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webinar">Webinar</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="seminar">Seminar</SelectItem>
                      <SelectItem value="meetup">Meetup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Publish"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="mine">Mine ({mine.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No upcoming events.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{upcoming.map(renderCard)}</div>
          )}
        </TabsContent>
        <TabsContent value="past">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{past.map(renderCard)}</div>
        </TabsContent>
        {isAdmin && (
          <TabsContent value="mine">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{mine.map(renderCard)}</div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default EventsPage;
