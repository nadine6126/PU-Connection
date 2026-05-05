import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Trash2, Heart, ImagePlus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { createPortal } from "react-dom";

type Post = {
  id: string; user_id: string; body: string; category: string;
  upvotes_count: number; created_at: string;
  image_url?: string | null;
  author_name?: string; author_avatar?: string | null;
  user_has_liked?: boolean;
};

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
const PRESET_CATEGORIES = ["general", "tips", "networking", "announcement"];

const translateText = async (text: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: { text, targetLang: "English" },
  });
  if (error || !data?.translated) throw new Error("Translation failed");
  return data.translated;
};

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

const CommunityPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: ps } = await supabase
      .from("community_posts").select("*")
      .order("created_at", { ascending: false }).limit(100);
    const userIds = [...new Set(((ps ?? []) as any[]).map((p) => p.user_id))];
    const postIds = ((ps ?? []) as any[]).map((p) => p.id);

    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
      : { data: [] as any };

    const { data: likes } = user && postIds.length
      ? await supabase.from("community_post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : { data: [] as any };

    const profileMap: Record<string, { name: string; avatar: string | null }> = {};
    ((profs ?? []) as any[]).forEach((p) => { profileMap[p.user_id] = { name: p.full_name, avatar: p.avatar_url }; });

    const likedPostIds = new Set(((likes ?? []) as any[]).map((l) => l.post_id));

    setPosts(((ps ?? []) as any[]).map((p) => ({
      ...p,
      author_name: profileMap[p.user_id]?.name ?? "Student",
      author_avatar: profileMap[p.user_id]?.avatar ?? null,
      user_has_liked: likedPostIds.has(p.id),
    })));
  };

  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    const ch = supabase.channel("community").on("postgres_changes",
      { event: "*", schema: "public", table: "community_posts" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

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
    const path = `community/${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("community-images").upload(path, file);
    if (error) { toast.error("Failed to upload image"); return null; }
    const { data } = supabase.storage.from("community-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePost = async () => {
    const { data: profile } = await supabase.from("profiles")
      .select("is_banned").eq("user_id", user!.id).maybeSingle();
    if (profile?.is_banned) { toast.error("Your account has been banned."); return; }

    if (!text.trim() && !imageFile) return;
    setPosting(true);

    const finalCategory = isCustom ? (customCategory.trim() || "general") : category;

    let image_url: string | null = null;
    if (imageFile) { image_url = await uploadImage(imageFile); clearImage(); }

    const { error } = await supabase.from("community_posts").insert({
      user_id: user!.id, body: text.trim(), category: finalCategory, image_url,
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    setCustomCategory("");
    setIsCustom(false);
    setCategory("general");
    toast.success("Posted!");
  };

  const handleLike = async (p: Post) => {
    if (!user) { toast.error("Please login to like"); return; }
    setPosts(prev => prev.map(post =>
      post.id === p.id
        ? { ...post, user_has_liked: !post.user_has_liked, upvotes_count: post.upvotes_count + (post.user_has_liked ? -1 : 1) }
        : post
    ));
    if (p.user_has_liked) {
      const { error } = await supabase.from("community_post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
      if (error) { toast.error(error.message); load(); return; }
    } else {
      const { error } = await supabase.from("community_post_likes").insert({ post_id: p.id, user_id: user.id });
      if (error) { toast.error(error.message); load(); return; }
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("community_posts").delete().eq("id", id);
    toast.success("Deleted");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Community</h1>
        <p className="text-muted-foreground text-sm">Share & network with other students.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="What's on your mind?" rows={3} maxLength={500}
            className="resize-none border-0 focus-visible:ring-0 px-0 text-base" />

          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="preview" className="h-32 w-32 object-cover rounded-lg border" />
              <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} title="Add photo">
                <ImagePlus className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Select value={isCustom ? "custom" : category} onValueChange={v => {
                if (v === "custom") { setIsCustom(true); setCategory("custom"); }
                else { setIsCustom(false); setCategory(v); setCustomCategory(""); }
              }}>
                <SelectTrigger className="w-[150px] text-sm h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESET_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  <SelectItem value="custom">✏️ Custom…</SelectItem>
                </SelectContent>
              </Select>
              {isCustom && (
                <Input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Topic name…" className="h-8 text-sm w-32" maxLength={30} />
              )}
            </div>
            <span className="text-xs text-muted-foreground">{text.length}/500</span>
          </div>

          <div className="flex items-center justify-end border-t pt-3">
            <Button size="sm" onClick={handlePost} disabled={posting || (!text.trim() && !imageFile)}>
              <Send className="w-3 h-3 mr-1" />{posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No posts yet. Be the first!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <Card key={p.id}>
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    {p.author_avatar && <AvatarImage src={p.author_avatar} alt={p.author_name} />}
                    <AvatarFallback className="text-xs bg-secondary">{initials(p.author_name ?? "S")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-medium text-foreground">{p.author_name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{p.category}</Badge>
                      <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      {p.user_id === user?.id && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    {p.body && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{p.body}</p>}

                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt="post image"
                        className="rounded-xl max-w-full max-h-80 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setPreviewImg(p.image_url!)}
                      />
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <button onClick={() => handleLike(p)}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                        title={p.user_has_liked ? "Unlike" : "Like"}>
                        <Heart className={`w-4 h-4 transition-all duration-200 ${p.user_has_liked ? "fill-red-500 text-red-500 scale-110" : "group-hover:text-red-400"}`} />
                        <span className={p.user_has_liked ? "text-red-500" : ""}>{p.upvotes_count}</span>
                      </button>
                      {p.body && <TranslateButton text={p.body} />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {previewImg && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-sm"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={previewImg}
              alt="preview"
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CommunityPage;