import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Stats = { groups: number; events: number; calendar: number; qa: number };
type Group = { id: string; name: string; course_name: string | null; member_count: number };

const DashboardHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("Student");
  const [stats, setStats] = useState<Stats>({ groups: 0, events: 0, calendar: 0, qa: 0 });
  const [myGroups, setMyGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string };
      const metaName = meta.display_name || meta.full_name;
      const emailPrefix = user.email?.split("@")[0] ?? "Student";
      const profName = prof?.full_name && prof.full_name !== "Student" ? prof.full_name : null;
      const fullDisplay = profName || metaName || emailPrefix;
      const display = fullDisplay.split(" ")[0]; // ambil nama depan saja
      setName(display);

      // Backfill profile if missing or stale
      if (!prof) {
        await supabase.from("profiles").insert({
          user_id: user.id,
          full_name: metaName || emailPrefix,
          email: user.email,
        });
      } else if ((prof.full_name === "Student" || !prof.full_name) && metaName) {
        await supabase.from("profiles").update({ full_name: metaName }).eq("user_id", user.id);
      }

      const { data: gm } = await supabase.from("study_group_members").select("group_id").eq("user_id", user.id);
      const groupIds = (gm ?? []).map((g: any) => g.group_id);

      let groups: Group[] = [];
      if (groupIds.length) {
        const { data: gs } = await supabase
          .from("study_groups")
          .select("id, name, course_name, study_group_members(user_id)")
          .in("id", groupIds);
        groups = (gs ?? []).map((g: any) => ({
          id: g.id, name: g.name, course_name: g.course_name,
          member_count: g.study_group_members?.length ?? 0,
        }));
      }
      setMyGroups(groups.slice(0, 4));

      const today = new Date().toISOString();
      const [{ count: rsvpCount }, { count: calCount }, { count: qaCount }] = await Promise.all([
        supabase.from("event_rsvps").select("event_id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("calendar_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("start_at", today),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setStats({
        groups: groupIds.length,
        events: rsvpCount ?? 0,
        calendar: calCount ?? 0,
        qa: qaCount ?? 0,
      });
    })();
  }, [user]);

  const cards = [
    { label: "My Study Groups", value: stats.groups, icon: Users, hint: stats.groups === 0 ? "Join one to get started" : "Active memberships", to: "/dashboard/study-groups" },
    { label: "My RSVPs", value: stats.events, icon: BookOpen, hint: stats.events === 0 ? "Browse events" : "Events you're attending", to: "/dashboard/events" },
    { label: "Upcoming Reminders", value: stats.calendar, icon: Calendar, hint: stats.calendar === 0 ? "Add a deadline" : "On your calendar", to: "/dashboard/calendar" },
    { label: "My Questions", value: stats.qa, icon: MessageCircle, hint: stats.qa === 0 ? "Ask anything" : "Posted in Q&A", to: "/dashboard/qa" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {name}! 👋</h1>
        <p className="text-muted-foreground">Here's your activity at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => (
          <Card key={s.label} onClick={() => navigate(s.to)} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Your Study Groups</CardTitle></CardHeader>
        <CardContent>
          {myGroups.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              You haven't joined any study group yet.{" "}
              <button onClick={() => navigate("/dashboard/study-groups")} className="text-primary hover:underline">Browse groups →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {myGroups.map((group) => (
                <div key={group.id} onClick={() => navigate(`/dashboard/study-groups/${group.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                  <div>
                    <p className="font-medium text-foreground">{group.name}</p>
                    <p className="text-sm text-muted-foreground">{group.course_name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {group.member_count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardHome;