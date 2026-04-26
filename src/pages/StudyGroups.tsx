import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Group = {
  id: string; name: string; course_name: string | null; description: string | null;
  tags: string[] | null; max_members: number; creator_id: string;
  member_count?: number; is_member?: boolean;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) + "-" + Math.random().toString(36).slice(2, 6);

const StudyGroups = () => {
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", course_name: "", description: "", tags: "", max_members: 20 });
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data: gs, error } = await supabase
      .from("study_groups")
      .select("*, study_group_members(user_id)")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const enriched: Group[] = (gs ?? []).map((g: any) => ({
      ...g,
      member_count: g.study_group_members?.length ?? 0,
      is_member: g.study_group_members?.some((m: any) => m.user_id === user?.id) ?? false,
    }));
    setGroups(enriched);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async () => {
    if (!form.name || !form.course_name) { toast.error("Name and course required"); return; }
    setCreating(true);
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const { data, error } = await supabase.from("study_groups").insert({
      creator_id: user!.id, name: form.name, course_name: form.course_name,
      description: form.description, tags, max_members: form.max_members,
      slug: slugify(form.name),
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Group created!");
    setOpen(false);
    setForm({ name: "", course_name: "", description: "", tags: "", max_members: 20 });
    if (data) navigate(`/dashboard/study-groups/${data.id}`);
  };

  const handleJoin = async (g: Group) => {
    const { error } = await supabase.from("study_group_members").insert({ group_id: g.id, user_id: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined group!");
    navigate(`/dashboard/study-groups/${g.id}`);
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.course_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Study Groups</h1>
          <p className="text-muted-foreground">Find or create study groups for your courses.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Create Group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a Study Group</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. DSA Weekly Practice" /></div>
              <div><Label>Course Name</Label><Input value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} placeholder="e.g. CS201 Algorithms" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Computer Science, Coding" /></div>
              <div><Label>Max Members</Label><Input type="number" value={form.max_members} onChange={e => setForm({ ...form, max_members: parseInt(e.target.value) || 20 })} min={2} max={100} /></div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create Group"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search groups or courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading groups…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No groups yet. Create the first one!
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="pt-6 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-1">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">{group.course_name ?? "—"}</p>
                  </div>
                  {group.description && <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>}
                  {group.tags && group.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {group.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-3 h-3" /> {group.member_count}/{group.max_members}
                  </div>
                  {group.is_member ? (
                    <Button size="sm" onClick={() => navigate(`/dashboard/study-groups/${group.id}`)}>
                      <MessageCircle className="w-3 h-3 mr-1" />Open Chat
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleJoin(group)}
                      disabled={(group.member_count ?? 0) >= group.max_members}>
                      Join
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyGroups;
