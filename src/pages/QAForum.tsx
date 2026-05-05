import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send, ArrowLeft, ImagePlus, X, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ReportButton } from "@/components/ReportButton";

type Question = {
  id: string; user_id: string | null; title: string; body: string;
  is_anonymous: boolean; created_at: string;
  image_url?: string | null;        // legacy single
  image_urls?: string[] | null;     // new multi
  reply_count?: number; author_name?: string; author_avatar?: string | null;
};

type Answer = {
  id: string; question_id: string; user_id: string; body: string;
  is_anonymous: boolean; created_at: string;
  image_url?: string | null;        // legacy single
  image_urls?: string[] | null;     // new multi
  parent_answer_id?: string | null;
  author_name?: string; author_avatar?: string | null;
  replies?: Answer[];
};

// Helper: normalise both old image_url and new image_urls into one array
const getImages = (item: { image_url?: string | null; image_urls?: string[] | null }): string[] => {
  if (item.image_urls && item.image_urls.length > 0) return item.image_urls;
  if (item.image_url) return [item.image_url];
  return [];
};

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const translateText = async (text: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: { text, targetLang: "English" },
  });
  if (error || !data?.translated) throw new Error("Translation failed");
  return data.translated;
};

// ── IMAGE MODAL ──────────────────────────────────────────────────────────────
const ImageModal = ({ src, onClose }: { src: string; onClose: () => void }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

// ── IMAGE GRID ───────────────────────────────────────────────────────────────
const ImageGrid = ({ urls, onOpen }: { urls: string[]; onOpen: (src: string) => void }) => {
  if (urls.length === 0) return null;
  return (
    <div className={`grid gap-1.5 mt-1 ${urls.length === 1 ? "grid-cols-1" : urls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {urls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`image ${i + 1}`}
          className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity w-full"
          style={{ maxHeight: urls.length === 1 ? "240px" : "140px" }}
          onClick={e => { e.stopPropagation(); onOpen(url); }}
        />
      ))}
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

const TranslateButton = ({ text }: { text: string }) => {
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (translated) { setTranslated(null); return; }
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await translateText(text);
      setTranslated(result);
    } catch {
      toast.error("Translation failed");
    }
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={handleTranslate}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        disabled={loading}
      >
        🌐 {loading ? "Translating…" : translated ? "Show original" : "Translate"}
      </button>
      {translated && (
        <p className="text-sm text-foreground mt-1 italic border-l-2 border-primary/30 pl-2">
          {translated}
        </p>
      )}
    </div>
  );
};

// ── REPLY COMPOSER (multi-image) ─────────────────────────────────────────────
const MAX_IMAGES = 4;

const ReplyComposer = ({
  onSubmit, onCancel, placeholder = "Write a reply…"
}: {
  onSubmit: (body: string, anon: boolean, imageFiles: File[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
}) => {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - imageFiles.length;
    if (remaining <= 0) { toast.error(`Max ${MAX_IMAGES} images`); return; }
    const selected = files.slice(0, remaining);
    const oversized = selected.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length) { toast.error("Each image must be under 5MB"); return; }
    setImageFiles(prev => [...prev, ...selected]);
    setImagePreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== i));
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!text.trim() && imageFiles.length === 0) return;
    setPosting(true);
    await onSubmit(text.trim(), anon, imageFiles);
    setText("");
    setAnon(false);
    setImageFiles([]);
    setImagePreviews([]);
    setPosting(false);
  };

  return (
    <div className="space-y-2 mt-2">
      <Textarea value={text} onChange={e => setText(e.target.value)}
        placeholder={placeholder} rows={2} maxLength={500}
        className="resize-none text-sm" />

      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagePreviews.map((src, i) => (
            <div key={i} className="relative inline-block">
              <img src={src} alt="preview" className="h-20 w-20 object-cover rounded-lg border" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => fileRef.current?.click()}
            title={`Add photos (max ${MAX_IMAGES})`}
            disabled={imageFiles.length >= MAX_IMAGES}
          >
            <ImagePlus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          {imageFiles.length > 0 && (
            <span className="text-xs text-muted-foreground">{imageFiles.length}/{MAX_IMAGES}</span>
          )}
          <div className="flex items-center gap-1.5">
            <Switch checked={anon} onCheckedChange={setAnon} id={`anon-reply-${Math.random()}`} />
            <Label className="text-xs text-muted-foreground cursor-pointer">Anonymous</Label>
          </div>
        </div>
        <div className="flex gap-2">
          {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>}
          <Button size="sm" onClick={handleSubmit} disabled={posting || (!text.trim() && imageFiles.length === 0)} className="h-7 text-xs">
            <Send className="w-3 h-3 mr-1" />{posting ? "Posting…" : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

const uploadImages = async (files: File[], userId: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `qa/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("community-images").upload(path, file);
    if (error) { toast.error("Failed to upload an image"); continue; }
    const { data } = supabase.storage.from("community-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
};

const AnswerItem = ({
  answer, depth = 0, questionId, onReload, currentUserId
}: {
  answer: Answer; depth?: number; questionId: string;
  onReload: () => void; currentUserId?: string;
}) => {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const author = answer.is_anonymous ? "Anonymous" : answer.author_name ?? "Student";
  const images = getImages(answer);

  const handleReply = async (body: string, anon: boolean, imageFiles: File[]) => {
    if (!currentUserId) return;
    const image_urls = imageFiles.length ? await uploadImages(imageFiles, currentUserId) : [];
    const { error } = await supabase.from("answers").insert({
      question_id: questionId, user_id: currentUserId,
      body: body || "", is_anonymous: anon,
      image_urls: image_urls.length ? image_urls : null,
      parent_answer_id: answer.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reply posted!");
    setShowReply(false);
    onReload();
  };

  return (
    <div className={`${depth > 0 ? "ml-8 border-l-2 border-border pl-3" : ""}`}>
      {modalSrc && <ImageModal src={modalSrc} onClose={() => setModalSrc(null)} />}

      <div className="flex gap-2 py-2">
        <Avatar className="w-7 h-7 shrink-0">
          {!answer.is_anonymous && answer.author_avatar && <AvatarImage src={answer.author_avatar} />}
          <AvatarFallback className="text-[10px] bg-secondary">{initials(author)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-medium text-foreground">{author}</span>
            {answer.is_anonymous && <Badge variant="outline" className="text-[10px]">Anon</Badge>}
            <span className="text-muted-foreground">· {formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</span>
          </div>
          {answer.body && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{answer.body}</p>}
          <ImageGrid urls={images} onOpen={setModalSrc} />
          <div className="flex items-center gap-3 pt-0.5 flex-wrap">
            <button onClick={() => setShowReply(!showReply)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Reply
            </button>
            <ReportButton contentType="answer" contentId={answer.id} reportedUserId={answer.user_id} />
            {answer.replies && answer.replies.length > 0 && (
              <button onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {answer.replies.length} {answer.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
            {answer.body && <TranslateButton text={answer.body} />}
          </div>
          {showReply && (
            <ReplyComposer onSubmit={handleReply} onCancel={() => setShowReply(false)} placeholder={`Reply to ${author}…`} />
          )}
        </div>
      </div>
      {showReplies && answer.replies && answer.replies.length > 0 && (
        <div>
          {answer.replies.map(r => (
            <AnswerItem key={r.id} answer={r} depth={depth + 1}
              questionId={questionId} onReload={onReload} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
};

const QuestionThread = ({
  question, onBack, onReload, currentUserId
}: {
  question: Question; onBack: () => void;
  onReload: () => void; currentUserId?: string;
}) => {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const images = getImages(question);

  const loadAnswers = async () => {
    setLoading(true);
    const { data: ans } = await supabase.from("answers").select("*")
      .eq("question_id", question.id).order("created_at");
    const userIds = [...new Set(((ans ?? []) as any[]).map((a) => a.user_id).filter(Boolean))];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
      : { data: [] as any };
    const map: Record<string, { name: string; avatar: string | null }> = {};
    ((profs ?? []) as any[]).forEach((p) => { map[p.user_id] = { name: p.full_name, avatar: p.avatar_url }; });
    const enriched: Answer[] = ((ans ?? []) as any[]).map((a) => ({
      ...a,
      author_name: map[a.user_id]?.name ?? "Student",
      author_avatar: map[a.user_id]?.avatar ?? null,
      replies: [],
    }));
    const topLevel: Answer[] = [];
    const byId: Record<string, Answer> = {};
    enriched.forEach(a => { byId[a.id] = a; });
    enriched.forEach(a => {
      if (a.parent_answer_id && byId[a.parent_answer_id]) {
        byId[a.parent_answer_id].replies!.push(a);
      } else { topLevel.push(a); }
    });
    setAnswers(topLevel);
    setLoading(false);
  };

  useEffect(() => { loadAnswers(); }, [question.id]);

  const handleTopReply = async (body: string, anon: boolean, imageFiles: File[]) => {
    if (!currentUserId) return;
    const image_urls = imageFiles.length ? await uploadImages(imageFiles, currentUserId) : [];
    const { error } = await supabase.from("answers").insert({
      question_id: question.id, user_id: currentUserId,
      body: body || "", is_anonymous: anon,
      image_urls: image_urls.length ? image_urls : null,
      parent_answer_id: null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reply posted!");
    loadAnswers();
    onReload();
  };

  const author = question.is_anonymous ? "Anonymous" : question.author_name ?? "Student";

  return (
    <div className="space-y-4">
      {modalSrc && <ImageModal src={modalSrc} onClose={() => setModalSrc(null)} />}

      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to questions
      </button>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Avatar className="w-10 h-10 shrink-0">
              {!question.is_anonymous && question.author_avatar && <AvatarImage src={question.author_avatar} />}
              <AvatarFallback className="text-xs bg-secondary">{initials(author)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-medium text-foreground">{author}</span>
                {question.is_anonymous && <Badge variant="outline" className="text-[10px]">Anon</Badge>}
                <span className="text-muted-foreground text-xs">· {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}</span>
              </div>
              <p className="text-foreground whitespace-pre-wrap break-words">{question.body}</p>
              <ImageGrid urls={images} onOpen={setModalSrc} />
              <div className="flex items-center gap-3 flex-wrap">
                {question.body && <TranslateButton text={question.body} />}
                <ReportButton contentType="question" contentId={question.id} reportedUserId={question.user_id ?? ""} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Write a reply</p>
          <ReplyComposer onSubmit={handleTopReply} placeholder="Share your answer or thoughts…" />
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading replies…</div>
      ) : answers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No replies yet. Be the first!</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-4 divide-y divide-border">
            {answers.map(a => (
              <AnswerItem key={a.id} answer={a} questionId={question.id}
                onReload={loadAnswers} currentUserId={currentUserId} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const QAForum = () => {
  const [anonymous, setAnonymous] = useState(false);
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [selected, setSelected] = useState<Question | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== i));
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handlePost = async () => {
    const { data: profile } = await supabase.from("profiles")
      .select("is_banned").eq("user_id", user!.id).maybeSingle();
    if (profile?.is_banned) { toast.error("Your account has been banned."); return; }

    const content = text.trim();
    if (!content && imageFiles.length === 0) return;
    if (content.length > 500) { toast.error("Maximum 500 characters"); return; }
    setPosting(true);

    const image_urls = imageFiles.length ? await uploadImages(imageFiles, user!.id) : [];
    setImageFiles([]);
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const title = (content || "📷 Photo").slice(0, 80);
    const { error } = await supabase.from("questions").insert({
      user_id: user!.id, title, body: content, tags: [], is_anonymous: anonymous,
      image_urls: image_urls.length ? image_urls : null,
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Posted!");
    setText("");
    load();
  };

  if (selected) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Q&A Forum</h1>
          <p className="text-muted-foreground text-sm">Ask anything — short and direct, like a tweet.</p>
        </div>
        <QuestionThread question={selected} onBack={() => { setSelected(null); load(); }}
          onReload={load} currentUserId={user?.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {modalSrc && <ImageModal src={modalSrc} onClose={() => setModalSrc(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Q&A Forum</h1>
        <p className="text-muted-foreground text-sm">Ask anything — short and direct, like a tweet.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="What's your question? (max 500 characters)" rows={3} maxLength={500}
            className="resize-none border-0 focus-visible:ring-0 px-0 text-base" />

          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative inline-block">
                  <img src={src} alt="preview" className="h-24 w-24 object-cover rounded-lg border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  const remaining = MAX_IMAGES - imageFiles.length;
                  if (remaining <= 0) { toast.error(`Max ${MAX_IMAGES} images`); return; }
                  const selected = files.slice(0, remaining);
                  const oversized = selected.filter(f => f.size > 5 * 1024 * 1024);
                  if (oversized.length) { toast.error("Each image must be under 5MB"); return; }
                  setImageFiles(prev => [...prev, ...selected]);
                  setImagePreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }} />
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => fileInputRef.current?.click()}
                title={`Add photos (max ${MAX_IMAGES})`}
                disabled={imageFiles.length >= MAX_IMAGES}
              >
                <ImagePlus className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              {imageFiles.length > 0 && (
                <span className="text-xs text-muted-foreground">{imageFiles.length}/{MAX_IMAGES}</span>
              )}
              <Switch checked={anonymous} onCheckedChange={setAnonymous} id="anon" />
              <Label htmlFor="anon" className="text-xs text-muted-foreground cursor-pointer">Anonymous</Label>
              <span className="text-xs text-muted-foreground">{text.length}/500</span>
            </div>
            <Button size="sm" onClick={handlePost} disabled={posting || (!text.trim() && imageFiles.length === 0)}>
              <Send className="w-3 h-3 mr-1" />{posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No questions yet. Be the first to ask!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const author = t.is_anonymous ? "Anonymous" : t.author_name ?? "Student";
            const imgs = getImages(t);
            return (
              <Card key={t.id}
                className="hover:shadow-md transition-shadow cursor-pointer hover:-translate-y-0.5 duration-200"
                onClick={() => setSelected(t)}>
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
                        <span className="text-muted-foreground text-xs">· {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-3">{t.body}</p>
                      {imgs.length > 0 && (
                        <ImageGrid urls={imgs.slice(0, 3)} onOpen={(src) => { setModalSrc(src); }} />
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap"
                        onClick={e => e.stopPropagation()}>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />{t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                        </span>
                        <ReportButton contentType="question" contentId={t.id} reportedUserId={t.user_id ?? ""} />
                        <span className="text-primary text-xs">Click to view thread →</span>
                        {t.body && <TranslateButton text={t.body} />}
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