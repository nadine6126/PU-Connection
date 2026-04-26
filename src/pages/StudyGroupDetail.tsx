import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, LogOut, ImagePlus, X, Trash2, Mic, Pause, Play, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Message = { id: string; user_id: string; content: string; created_at: string; image_url?: string | null; audio_url?: string | null };
type Member = { user_id: string; full_name: string; avatar_url: string | null };

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

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
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={e => setDuration(Math.round(e.currentTarget.duration))}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {playing
          ? <Square className="w-3 h-3 fill-current" />
          : <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        }
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className={`h-1 rounded-full overflow-hidden ${mine ? "bg-primary-foreground/20" : "bg-muted"}`}>
          <div className={`h-full rounded-full transition-all ${mine ? "bg-primary-foreground" : "bg-primary"}`} style={{ width: `${progress}%` }} />
        </div>
        <span className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
};

const StudyGroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);

  // Recording states
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollDown = () => setTimeout(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);

  const loadAll = async () => {
    if (!id) return;
    const { data: g } = await supabase.from("study_groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);
    const { data: ms } = await supabase.from("study_group_members").select("user_id").eq("group_id", id);
    const memberIds = ((ms ?? []) as any[]).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", memberIds);
      const map: Record<string, { name: string; avatar: string | null }> = {};
      ((profs ?? []) as any[]).forEach((p) => { map[p.user_id] = { name: p.full_name, avatar: p.avatar_url }; });
      setProfileMap(map);
      setMembers(memberIds.map(uid => ({ user_id: uid, full_name: map[uid]?.name ?? "Member", avatar_url: map[uid]?.avatar ?? null })));
    }
    const { data: msgs, error } = await supabase
      .from("group_messages").select("*").eq("group_id", id).order("created_at");
    if (error) { toast.error(error.message); return; }
    setMessages((msgs ?? []) as any);
    scrollDown();
  };

  useEffect(() => { if (user && id) loadAll(); }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`group-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          if (!profileMap[m.user_id]) {
            const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", m.user_id).maybeSingle();
            if (data) setProfileMap(p => ({ ...p, [m.user_id]: { name: (data as any).full_name, avatar: (data as any).avatar_url } }));
          }
          scrollDown();
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
        (payload) => { setMessages(prev => prev.filter(m => m.id !== payload.old.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members", filter: `group_id=eq.${id}` },
        () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

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

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setPaused(false);
      setAudioPreview(null);
      setAudioBlob(null);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  // Pause recording
  const pauseRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;
    mr.pause();
    setPaused(true);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  // Resume recording
  const resumeRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume();
    setPaused(false);
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
  };

  // Stop recording → show preview
  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      mr.stream.getTracks().forEach(t => t.stop());
      setAudioBlob(blob);
      setAudioPreview(URL.createObjectURL(blob));
    };
    mr.stop();
    setRecording(false);
    setPaused(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  // Cancel recording
  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) { mr.stream.getTracks().forEach(t => t.stop()); }
    setRecording(false);
    setPaused(false);
    setAudioPreview(null);
    setAudioBlob(null);
    setRecordSeconds(0);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  // Send audio
  const sendAudio = async () => {
    if (!audioBlob || !id || !user) return;
    setSending(true);
    const audio_url = await uploadAudio(audioBlob);
    if (audio_url) {
      const { error } = await supabase.from("group_messages").insert({
        group_id: id, user_id: user.id, content: "", audio_url,
      });
      if (error) toast.error(error.message);
    }
    setAudioPreview(null);
    setAudioBlob(null);
    setRecordSeconds(0);
    setSending(false);
  };

  const send = async () => {
    if (!text.trim() && !imageFile) return;
    if (!id || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    let image_url: string | null = null;
    if (imageFile) { image_url = await uploadImage(imageFile); clearImage(); }
    const { error } = await supabase.from("group_messages").insert({
      group_id: id, user_id: user.id, content: content || "", image_url,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(content); }
  };

  const deleteMessage = async (msg: Message) => {
    const isOwner = msg.user_id === user?.id;
    const isGroupCreator = group?.creator_id === user?.id;
    if (!isOwner && !isGroupCreator) return;
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
  const isGroupCreator = group.creator_id === user?.id;

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/study-groups")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{group.name}</h1>
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
              const canDelete = mine || isGroupCreator;
              const prof = profileMap[m.user_id];
              const name = prof?.name ?? "Member";
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                  onMouseEnter={() => setHoveredMsg(m.id)}
                  onMouseLeave={() => setHoveredMsg(null)}>
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
                        <img src={m.image_url} alt="shared image"
                          className="rounded-lg max-w-full max-h-60 object-cover mb-1 cursor-pointer"
                          onClick={() => window.open(m.image_url!, "_blank")} />
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

          {/* Image preview */}
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

          {/* Recording controls */}
          {(recording || audioPreview) && (
            <div className="px-3 py-2 border-t shrink-0 bg-card">
              {recording && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${paused ? "bg-yellow-500" : "bg-destructive animate-pulse"}`} />
                  <span className="text-sm font-medium text-destructive">{formatDuration(recordSeconds)}</span>
                  <span className="text-xs text-muted-foreground flex-1">{paused ? "Paused" : "Recording…"}</span>
                  {/* Pause / Resume */}
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={paused ? resumeRecording : pauseRecording} title={paused ? "Resume" : "Pause"}>
                    {paused ? <Play className="w-4 h-4 text-primary" /> : <Pause className="w-4 h-4 text-primary" />}
                  </Button>
                  {/* Stop → go to preview */}
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={stopRecording} title="Stop">
                    <Square className="w-4 h-4 fill-destructive text-destructive" />
                  </Button>
                  {/* Cancel */}
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={cancelRecording} title="Cancel">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* Audio preview setelah stop */}
              {audioPreview && !recording && (
                <div className="flex items-center gap-2">
                  <audio controls src={audioPreview} className="flex-1 h-8" style={{ minWidth: 0 }} />
                  {/* Re-record */}
                  <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => { setAudioPreview(null); setAudioBlob(null); setRecordSeconds(0); }} title="Re-record">
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  {/* Cancel */}
                  <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={cancelRecording} title="Cancel">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  {/* Send */}
                  <Button size="icon" className="w-8 h-8 shrink-0" onClick={sendAudio} disabled={sending} title="Send voice note">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Input bar */}
          <div className="border-t p-3 flex gap-2 shrink-0 bg-card">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Send image" disabled={recording || !!audioPreview}>
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…"
              disabled={sending || recording || !!audioPreview} />
            {/* Mic button */}
            {!audioPreview && (
              <Button variant={recording ? "destructive" : "ghost"} size="icon"
                onClick={recording ? cancelRecording : startRecording}
                disabled={sending} title={recording ? "Cancel" : "Record voice note"}>
                <Mic className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={send} disabled={sending || recording || !!audioPreview || (!text.trim() && !imageFile)} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <div className="space-y-4 overflow-y-auto">
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
                  <span className="text-foreground truncate">{m.full_name}</span>
                  {m.user_id === group.creator_id && <Badge variant="outline" className="text-[10px] ml-auto">Owner</Badge>}
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