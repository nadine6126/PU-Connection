import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, LogOut, ImagePlus, X, Trash2, Mic, Pause, Play, Square, RotateCcw, Shield, ShieldOff, Check, XCircle, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Message = { id: string; user_id: string; content: string; created_at: string; image_url?: string | null; audio_url?: string | null };
type Member = { user_id: string; full_name: string; avatar_url: string | null; role?: string };
type JoinRequest = { id: string; user_id: string; status: string; created_at: string; full_name?: string; avatar_url?: string | null };

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// ── Image Lightbox Modal ──────────────────────────────────────────────────────
const ImageLightbox = ({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) => {
  const [current, setCurrent] = useState(startIndex);

  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
  const next = () => setCurrent(i => (i + 1) % images.length);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image */}
        <img
          src={images[current]}
          alt="Full size"
          className="w-full max-h-[85vh] object-contain rounded-lg"
        />

        {/* Navigation — hanya tampil jika lebih dari 1 gambar */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Audio Player ──────────────────────────────────────────────────────────────
const AudioPlayer = ({ url, mine }: { url: string; mine: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded-xl min-w-[180px]">
      <audio ref={audioRef} src={url}
        onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={e => setDuration(Math.round(e.currentTarget.duration))}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {playing ? <Square className="w-3 h-3 fill-current" /> : <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className={`h-1 rounded-full overflow-hidden ${mine ? "bg-primary-foreground/20" : "bg-muted"}`}>
          <div className={`h-full rounded-full transition-all ${mine ? "bg-primary-foreground" : "bg-primary"}`} style={{ width: `${progress}%` }} />
        </div>
        <span className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatDuration(duration)}</span>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const StudyGroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [profileMap, setProfileMap] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // ── Lightbox state ──
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollDown = () => setTimeout(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);

  // ── Fetch profil satu user, update profileMap ──
  const fetchAndSetProfile = useCallback(async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof) {
      setProfileMap(prev => ({
        ...prev,
        [userId]: { name: (prof as any).full_name, avatar: (prof as any).avatar_url },
      }));
    }
  }, []);

  const loadAll = async () => {
    if (!id) return;
    const { data: g } = await supabase.from("study_groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);

    const { data: ms } = await supabase.from("study_group_members").select("user_id, role").eq("group_id", id);
    const memberIds = ((ms ?? []) as any[]).map((m) => m.user_id);
    const roles: Record<string, string> = {};
    ((ms ?? []) as any[]).forEach((m: any) => { roles[m.user_id] = m.role ?? "member"; });
    setMemberRoles(roles);

    const map: Record<string, { name: string; avatar: string | null }> = {};

    if (memberIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", memberIds);
      ((profs ?? []) as any[]).forEach((p) => { map[p.user_id] = { name: p.full_name, avatar: p.avatar_url }; });
      setMembers(memberIds.map(uid => ({
        user_id: uid,
        full_name: map[uid]?.name ?? "Member",
        avatar_url: map[uid]?.avatar ?? null,
        role: roles[uid] ?? "member",
      })));
    }

    // ── FIX #1: Pastikan profil user sendiri selalu ada di map ──
    if (user && !map[user.id]) {
      const { data: myProf } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (myProf) map[user.id] = { name: (myProf as any).full_name, avatar: (myProf as any).avatar_url };
    }

    setProfileMap(map);

    const { data: msgs, error } = await supabase.from("group_messages").select("*").eq("group_id", id).order("created_at");
    if (error) { toast.error(error.message); return; }
    setMessages((msgs ?? []) as any);
    scrollDown();

    const { data: reqs } = await supabase.from("study_group_requests")
      .select("*").eq("group_id", id).eq("status", "pending");
    if (reqs && reqs.length > 0) {
      const reqUserIds = reqs.map((r: any) => r.user_id);
      const { data: reqProfs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", reqUserIds);
      const reqMap: Record<string, any> = {};
      ((reqProfs ?? []) as any[]).forEach((p) => { reqMap[p.user_id] = p; });
      setJoinRequests(reqs.map((r: any) => ({
        ...r,
        full_name: reqMap[r.user_id]?.full_name ?? "Student",
        avatar_url: reqMap[r.user_id]?.avatar_url ?? null,
      })));
    } else {
      setJoinRequests([]);
    }
  };

  useEffect(() => { if (user && id) loadAll(); }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`group-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Message;

          // ── FIX #2: Tambah pesan DULU, jangan tunggu fetch profil ──
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          scrollDown();

          // Fetch profil async terpisah hanya jika belum ada
          setProfileMap(prev => {
            if (prev[m.user_id]) return prev; // sudah ada, skip fetch
            fetchAndSetProfile(m.user_id);
            return prev;
          });
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
        (payload) => { setMessages(prev => prev.filter(m => m.id !== payload.old.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members", filter: `group_id=eq.${id}` },
        () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_requests", filter: `group_id=eq.${id}` },
        () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const myRole = memberRoles[user?.id ?? ""] ?? "member";
  const isGroupCreator = group?.creator_id === user?.id;
  const isAdminOrOwner = isGroupCreator || myRole === "admin";

  // ── Kumpulkan semua URL gambar dari pesan untuk lightbox navigation ──
  const allImageUrls = messages.filter(m => m.image_url).map(m => m.image_url as string);

  const openLightbox = (imageUrl: string) => {
    const idx = allImageUrls.indexOf(imageUrl);
    setLightboxImages(allImageUrls);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const handleRequest = async (req: JoinRequest, action: "approved" | "rejected") => {
    const { error: updateError } = await supabase.from("study_group_requests")
      .update({ status: action }).eq("id", req.id);
    if (updateError) { toast.error(updateError.message); return; }

    if (action === "approved") {
      const { error: joinError } = await supabase.from("study_group_members").insert({
        group_id: id, user_id: req.user_id, role: "member",
      });
      if (joinError) { toast.error(joinError.message); return; }
      toast.success(`${req.full_name} has been approved!`);
    } else {
      toast.success(`Request from ${req.full_name} rejected`);
    }
    loadAll();
  };

  const handleToggleAdmin = async (member: Member) => {
    if (!isGroupCreator) { toast.error("Only group owner can manage admins"); return; }
    if (member.user_id === user?.id) { toast.error("Can't change your own role"); return; }
    const newRole = member.role === "admin" ? "member" : "admin";
    const { error } = await supabase.from("study_group_members")
      .update({ role: newRole }).eq("group_id", id).eq("user_id", member.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${member.full_name} is now ${newRole}`);
    loadAll();
  };

  const handleKick = async (member: Member) => {
    if (!isAdminOrOwner) return;
    if (member.user_id === group?.creator_id) { toast.error("Can't kick the owner"); return; }
    const { error } = await supabase.from("study_group_members")
      .delete().eq("group_id", id).eq("user_id", member.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${member.full_name} removed from group`);
    loadAll();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5MB)"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error("Failed to upload image"); return null; }
    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    const path = `${user!.id}/${Date.now()}.webm`;
    const { error } = await supabase.storage.from("chat-audio").upload(path, blob, { contentType: "audio/webm" });
    if (error) { toast.error("Failed to upload audio"); return null; }
    const { data } = supabase.storage.from("chat-audio").getPublicUrl(path);
    return data.publicUrl;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true); setPaused(false); setAudioPreview(null); setAudioBlob(null); setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };

  const pauseRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;
    mr.pause(); setPaused(true);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const resumeRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume(); setPaused(false);
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      mr.stream.getTracks().forEach(t => t.stop());
      setAudioBlob(blob); setAudioPreview(URL.createObjectURL(blob));
    };
    mr.stop(); setRecording(false); setPaused(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) { mr.stream.getTracks().forEach(t => t.stop()); }
    setRecording(false); setPaused(false); setAudioPreview(null); setAudioBlob(null); setRecordSeconds(0);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const sendAudio = async () => {
    if (!audioBlob || !id || !user) return;
    setSending(true);
    const audio_url = await uploadAudio(audioBlob);
    if (audio_url) {
      const { error } = await supabase.from("group_messages").insert({ group_id: id, user_id: user.id, content: "", audio_url });
      if (error) toast.error(error.message);
    }
    setAudioPreview(null); setAudioBlob(null); setRecordSeconds(0); setSending(false);
  };

  const send = async () => {
    const { data: profile } = await supabase.from("profiles")
      .select("is_banned").eq("user_id", user!.id).maybeSingle();
    if (profile?.is_banned) { toast.error("Your account has been banned."); return; }

    if (!text.trim() && !imageFile) return;
    if (!id || !user) return;

    // ── FIX #3: Pastikan profil user sendiri ada sebelum kirim ──
    if (!profileMap[user.id]) {
      await fetchAndSetProfile(user.id);
    }

    setSending(true);
    const content = text.trim();
    setText("");
    let image_url: string | null = null;
    if (imageFile) { image_url = await uploadImage(imageFile); clearImage(); }
    const { error } = await supabase.from("group_messages").insert({ group_id: id, user_id: user.id, content: content || "", image_url });
    setSending(false);
    if (error) { toast.error(error.message); setText(content); }
  };

  const deleteMessage = async (msg: Message) => {
    const isOwner = msg.user_id === user?.id;
    if (!isOwner && !isAdminOrOwner) return;
    const { error } = await supabase.from("group_messages").delete().eq("id", msg.id);
    if (error) { toast.error(error.message); return; }
    if (msg.image_url) {
      const path = msg.image_url.split("/chat-images/")[1];
      if (path) await supabase.storage.from("chat-images").remove([path]);
    }
    if (msg.audio_url) {
      const path = msg.audio_url.split("/chat-audio/")[1];
      if (path) await supabase.storage.from("chat-audio").remove([path]);
    }
  };

  const leaveGroup = async () => {
    if (!id || !user) return;
    const { error } = await supabase.from("study_group_members").delete().eq("group_id", id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Left the group");
    navigate("/dashboard/study-groups");
  };

  if (!group) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-7rem)]">

      {/* ── Lightbox Modal ── */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/study-groups")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground truncate">{group.name}</h1>
              {group.is_private && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">{group.course_name ?? "—"} · {members.length} members</p>
          </div>
        </div>
        {!isGroupCreator && (
          <Button variant="outline" size="sm" onClick={leaveGroup}>
            <LogOut className="w-3 h-3 mr-1" />Leave
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 flex-1 min-h-0">
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hi 👋</p>
            )}
            {messages.map(m => {
              const mine = m.user_id === user?.id;
              const canDelete = mine || isAdminOrOwner;
              const prof = profileMap[m.user_id];
              const name = prof?.name ?? "Member";
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                  onMouseEnter={() => setHoveredMsg(m.id)} onMouseLeave={() => setHoveredMsg(null)}>
                  {!mine && (
                    <Avatar className="w-8 h-8 shrink-0">
                      {prof?.avatar && <AvatarImage src={prof.avatar} alt={name} />}
                      <AvatarFallback className="text-xs bg-secondary">{initials(name)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex items-end gap-1 max-w-[75%] ${mine ? "flex-row-reverse" : "flex-row"}`}>
                    {canDelete && hoveredMsg === m.id && (
                      <button onClick={() => deleteMessage(m)}
                        className="shrink-0 w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors mb-1">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                    <div className={`rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                      {!mine && <p className="text-xs font-medium mb-0.5 opacity-80">{name}</p>}
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt="shared image"
                          className="rounded-lg max-w-full max-h-60 object-cover mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                          // ── DIUBAH: buka lightbox, bukan tab baru ──
                          onClick={() => openLightbox(m.image_url!)}
                        />
                      )}
                      {m.audio_url && <AudioPlayer url={m.audio_url} mine={mine} />}
                      {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                      <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {imagePreview && (
            <div className="px-3 pt-2 shrink-0">
              <div className="relative inline-block">
                <img src={imagePreview} alt="preview" className="h-20 w-20 object-cover rounded-lg border" />
                <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {(recording || audioPreview) && (
            <div className="px-3 py-2 border-t shrink-0 bg-card">
              {recording && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${paused ? "bg-yellow-500" : "bg-destructive animate-pulse"}`} />
                  <span className="text-sm font-medium text-destructive">{formatDuration(recordSeconds)}</span>
                  <span className="text-xs text-muted-foreground flex-1">{paused ? "Paused" : "Recording…"}</span>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={paused ? resumeRecording : pauseRecording}>
                    {paused ? <Play className="w-4 h-4 text-primary" /> : <Pause className="w-4 h-4 text-primary" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={stopRecording}>
                    <Square className="w-4 h-4 fill-destructive text-destructive" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={cancelRecording}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
              {audioPreview && !recording && (
                <div className="flex items-center gap-2">
                  <audio controls src={audioPreview} className="flex-1 h-8" style={{ minWidth: 0 }} />
                  <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => { setAudioPreview(null); setAudioBlob(null); setRecordSeconds(0); }}>
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={cancelRecording}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button size="icon" className="w-8 h-8 shrink-0" onClick={sendAudio} disabled={sending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="border-t p-3 flex gap-2 shrink-0 bg-card">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Send image" disabled={recording || !!audioPreview}>
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…" disabled={sending || recording || !!audioPreview} />
            {!audioPreview && (
              <Button variant={recording ? "destructive" : "ghost"} size="icon"
                onClick={recording ? cancelRecording : startRecording} disabled={sending}>
                <Mic className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={send} disabled={sending || recording || !!audioPreview || (!text.trim() && !imageFile)} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <div className="space-y-4 overflow-y-auto">
          {isAdminOrOwner && joinRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Join Requests ({joinRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {joinRequests.map(req => (
                  <div key={req.id} className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 shrink-0">
                      {req.avatar_url && <AvatarImage src={req.avatar_url} />}
                      <AvatarFallback className="text-[10px] bg-secondary">{initials(req.full_name ?? "S")}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground flex-1 truncate">{req.full_name}</span>
                    <button onClick={() => handleRequest(req, "approved")}
                      className="w-6 h-6 rounded-full bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors">
                      <Check className="w-3 h-3 text-green-600" />
                    </button>
                    <button onClick={() => handleRequest(req, "rejected")}
                      className="w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                      <XCircle className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {group.description && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">About</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {group.description}
                {group.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {group.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 text-sm">
                  <Avatar className="w-7 h-7">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name} />}
                    <AvatarFallback className="text-xs bg-secondary">{initials(m.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-foreground truncate flex-1">{m.full_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.user_id === group.creator_id
                      ? <Badge variant="outline" className="text-[10px]">Owner</Badge>
                      : m.role === "admin"
                      ? <Badge className="text-[10px]">Admin</Badge>
                      : null
                    }
                    {isGroupCreator && m.user_id !== group.creator_id && (
                      <div className="flex gap-0.5">
                        <button onClick={() => handleToggleAdmin(m)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary transition-colors"
                          title={m.role === "admin" ? "Remove admin" : "Make admin"}>
                          {m.role === "admin" ? <ShieldOff className="w-3 h-3 text-muted-foreground" /> : <Shield className="w-3 h-3 text-muted-foreground" />}
                        </button>
                        <button onClick={() => handleKick(m)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors"
                          title="Remove from group">
                          <XCircle className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    )}
                    {!isGroupCreator && myRole === "admin" && m.user_id !== group.creator_id && m.user_id !== user?.id && m.role !== "admin" && (
                      <button onClick={() => handleKick(m)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors"
                        title="Remove from group">
                        <XCircle className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudyGroupDetail;