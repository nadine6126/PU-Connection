import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, History, Plus, Trash2, ExternalLink, Users, BookOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

type Msg = {
  role: "user" | "assistant";
  content: string;
  recommendations?: RecommendationData;
};

type RecommendationData = {
  ai_suggestions: { title: string; description: string; steps: string[] }[];
  internal: {
    type: "study_group" | "qna" | "event";
    title: string;
    description?: string;
    course_name?: string;
    id?: string;
    start_at?: string;
    location_or_link?: string;
    external_register_url?: string;
  }[];
  external: {
    source: "youtube" | "web";
    title: string;
    channel?: string;
    platform?: string;
    description: string;
    url: string;
  }[];
};

type Session = { id: string; title: string; updated_at: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "Hi! 👋 I'm Penny, your PU Academic Hub assistant. Ask me about study groups, Q&A, events, or how to use anything in the web! I can also recommend learning resources if you tell me what you want to learn! 🎓"
};

const LEARN_KEYWORDS = [
  "belajar", "learn", "recommend", "rekomendasi", "saran", "suggest",
  "cara", "how to", "tutorial", "study", "materi", "topik", "topic",
  "mau tau", "want to know", "ingin", "pengen", "gimana", "bagaimana",
  "resources", "resource", "referensi", "reference"
];

const isLearningQuery = (text: string): boolean => {
  const lower = text.toLowerCase();
  return LEARN_KEYWORDS.some(kw => lower.includes(kw));
};

// Card komponen untuk rekomendasi
const RecommendationCards = ({ data, onNavigate }: { data: RecommendationData; onNavigate: (path: string) => void }) => {
  return (
    <div className="space-y-3 mt-2">
      {/* AI Suggestions */}
      {data.ai_suggestions.length > 0 && (
        <div className="space-y-2">
          {data.ai_suggestions.map((s, i) => (
            <div key={i} className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              {s.steps.length > 0 && (
                <ol className="space-y-0.5">
                  {s.steps.map((step, j) => (
                    <li key={j} className="text-xs text-foreground flex gap-1.5">
                      <span className="text-primary font-medium shrink-0">{j + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Internal — Study Groups, Q&A, Events */}
      {data.internal.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">From PU Academic Hub</p>
          {data.internal.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                if (item.type === "study_group") onNavigate("/dashboard/study-groups");
                else if (item.type === "qna") onNavigate("/dashboard/qa");
                else if (item.type === "event") onNavigate("/dashboard/events");
              }}
              className="w-full text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl p-2.5 transition-colors flex gap-2 items-start"
            >
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                {item.type === "study_group" && <Users className="w-3 h-3 text-primary" />}
                {item.type === "qna" && <BookOpen className="w-3 h-3 text-primary" />}
                {item.type === "event" && <Calendar className="w-3 h-3 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                {item.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>}
                {item.type === "event" && item.start_at && (
                  <p className="text-[10px] text-muted-foreground">{new Date(item.start_at).toLocaleDateString()}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* External — YouTube & Web */}
      {data.external.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">External Resources</p>
          {data.external.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-start bg-secondary/50 hover:bg-secondary border border-border rounded-xl p-2.5 transition-colors"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.source === "youtube" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                {item.source === "youtube"
                  ? <svg className="w-3 h-3 fill-red-500" viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" /></svg>
                  : <ExternalLink className="w-3 h-3 text-blue-500" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.channel || item.platform}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export const AIChatbot = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, [messages, open]);

  const loadSessions = async () => {
    if (!user) return;
    const { data } = await supabase.from("chatbot_sessions").select("id, title, updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
    setSessions((data ?? []) as any);
  };

  useEffect(() => { if (open) loadSessions(); }, [open, user]);

  const loadSession = async (id: string) => {
    const { data } = await supabase.from("chatbot_messages").select("role, content")
      .eq("session_id", id).order("created_at");
    const msgs = ((data ?? []) as any[]).map((m) => ({ role: m.role, content: m.content })) as Msg[];
    setMessages(msgs.length ? msgs : [WELCOME]);
    setCurrentSession(id);
    setShowHistory(false);
  };

  const newChat = () => {
    setMessages([WELCOME]);
    setCurrentSession(null);
    setShowHistory(false);
  };

  const deleteSession = async (id: string) => {
    await supabase.from("chatbot_sessions").delete().eq("id", id);
    if (currentSession === id) newChat();
    loadSessions();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !user) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      let sid = currentSession;
      if (!sid) {
        const { data: s, error: sErr } = await supabase.from("chatbot_sessions")
          .insert({ user_id: user.id, title: text.slice(0, 60) }).select("id").single();
        if (sErr) throw sErr;
        sid = (s as any).id;
        setCurrentSession(sid);
      }

      await supabase.from("chatbot_messages").insert({
        session_id: sid!, user_id: user.id, role: "user", content: text
      });

      // Deteksi apakah learning query
      const isLearn = isLearningQuery(text);

      let reply = "";
      let recommendations: RecommendationData | undefined;

      if (isLearn) {
        // Panggil ai-recommendation
        const { data: recData, error: recError } = await supabase.functions.invoke("ai-recommendation", {
          body: { query: text, history: messages.filter(m => m.role !== "assistant" || !m.recommendations).map(m => ({ role: m.role, content: m.content })) },
        });

        if (!recError && recData) {
          recommendations = recData as RecommendationData;
          // Buat reply text dari ai_suggestions
          if (recommendations.ai_suggestions.length > 0) {
            reply = recommendations.ai_suggestions[0].description;
          } else {
            reply = "Here are some resources I found for you! 🎓";
          }
        } else {
          // Fallback ke chatbot biasa kalau recommendation gagal
          const { data, error } = await supabase.functions.invoke("ai-chatbot", { body: { messages: next } });
          if (error) throw error;
          reply = data.reply ?? "…";
        }
      } else {
        // Query biasa → Penny chatbot
        const { data, error } = await supabase.functions.invoke("ai-chatbot", { body: { messages: next } });
        if (error) throw error;
        reply = data.reply ?? "…";
      }

      const assistantMsg: Msg = { role: "assistant", content: reply, recommendations };
      setMessages([...next, assistantMsg]);

      await supabase.from("chatbot_messages").insert({
        session_id: sid!, user_id: user.id, role: "assistant", content: reply
      });
      await supabase.from("chatbot_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid!);
      loadSessions();
    } catch (e: any) {
      toast.error(e.message ?? "Chatbot error");
      setMessages([...next, { role: "assistant", content: "Sorry, I had trouble responding. Try again in a moment." }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-card border rounded-2xl shadow-2xl flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">Penny AI ✨</p>
                <p className="text-[10px] text-muted-foreground">Your PU Academic Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={newChat} title="New chat">
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(s => !s)} title="History">
                <History className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showHistory ? (
            <ScrollArea className="flex-1 p-2">
              {sessions.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">No chat history yet.</p>
              ) : (
                <div className="space-y-1">
                  {sessions.map(s => (
                    <div key={s.id} className={`flex items-center gap-1 p-2 rounded hover:bg-accent group ${currentSession === s.id ? "bg-accent" : ""}`}>
                      <button onClick={() => loadSession(s.id)} className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}</p>
                      </button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteSession(s.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
              <div ref={scrollRef} className="space-y-3 max-h-full overflow-y-auto">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[90%]">
                      <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                        {m.content}
                      </div>
                      {m.recommendations && (
                        <RecommendationCards
                          data={m.recommendations}
                          onNavigate={(path) => { navigate(path); setOpen(false); }}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-2xl px-3 py-2 text-sm text-muted-foreground animate-pulse">
                      Penny is thinking…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {!showHistory && (
            <div className="border-t p-3 flex gap-2">
              <Input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                placeholder="Ask anything'" disabled={busy} />
              <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
};