import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Question = {
  id: string; user_id: string | null; title: string; body: string;
  is_anonymous: boolean; created_at: string;
  reply_count?: number; author_name?: string; author_avatar?: string | null;
};

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const QAForum = () => {
  const [anonymous, setAnonymous] = useState(false);
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data: ts } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    const userIds = [...new Set(((ts ?? []) as any[]).map((t) => t.user_id).filter(Boolean))];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
      : { data: [] as any };
    const map: Record<string, { name: string; avatar: string | null }> = {};
    ((profs ?? []) as any[]).forEach((p) => { map[p.user_id] = { name: p.full_name, avatar: p.avatar_url }; });

    const { data: replies } = await supabase.from("answers").select("question_id");
    const counts: Record<string, number> = {};
    ((replies ?? []) as any[]).forEach((r) => { counts[r.question_id] = (counts[r.question_id] ?? 0) + 1; });

    setItems(((ts ?? []) as any[]).map((t) => ({
      ...t,
      reply_count: counts[t.id] ?? 0,
      author_name: t.user_id ? map[t.user_id]?.name ?? "Student" : "Student",
      author_avatar: t.user_id ? map[t.user_id]?.avatar ?? null : null,
    })));
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handlePost = async () => {
    const content = text.trim();
    if (!content) return;
    if (content.length > 500) { toast.error("Maximum 500 characters"); return; }
    setPosting(true);
    const title = content.slice(0, 80);
    const { error } = await supabase.from("questions").insert({
      user_id: user!.id, title, body: content, tags: [], is_anonymous: anonymous,
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Posted!");
    setText(""); load();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Q&A Forum</h1>
        <p className="text-muted-foreground text-sm">Ask anything — short and direct, like a tweet.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="What's your question? (max 500 characters)" rows={3} maxLength={500}
            className="resize-none border-0 focus-visible:ring-0 px-0 text-base" />
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={anonymous} onCheckedChange={setAnonymous} id="anon" />
              <Label htmlFor="anon" className="text-xs text-muted-foreground cursor-pointer">Anonymous</Label>
              <span className="text-xs text-muted-foreground ml-2">{text.length}/500</span>
            </div>
            <Button size="sm" onClick={handlePost} disabled={posting || !text.trim()}>
              <Send className="w-3 h-3 mr-1" />{posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No questions yet. Be the first to ask!
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const author = t.is_anonymous ? "Anonymous" : t.author_name ?? "Student";
            return (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      {!t.is_anonymous && t.author_avatar && <AvatarImage src={t.author_avatar} alt={author} />}
                      <AvatarFallback className="text-xs bg-secondary">{initials(author)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">{author}</span>
                        {t.is_anonymous && <Badge variant="outline" className="text-[10px]">Anon</Badge>}
                        <span className="text-muted-foreground text-xs">· {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{t.body}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.reply_count} replies</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QAForum;
