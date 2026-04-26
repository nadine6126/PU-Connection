import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Palette, Sun, Moon, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme, ACCENTS, Accent } from "@/hooks/useTheme";
import { toast } from "sonner";

const ProfilePage = () => {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const { mode, accent, setMode, setAccent, resetToDefault } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setForm({ full_name: (data as any)?.full_name ?? "", bio: (data as any)?.bio ?? "" });
      });
  };

  useEffect(() => { load(); }, [user]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ full_name: form.full_name, bio: form.bio })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    load();
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setUploading(false);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success("Avatar updated!");
    load();
  };

  const initials = (form.full_name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account and personalize your experience.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Personal Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={form.full_name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:scale-105 transition disabled:opacity-50">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{form.full_name || "—"}</p>
              <div className="flex gap-1 flex-wrap">
                {roles.map(r => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize text-[10px]">{r}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">Click camera to change photo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={profile?.email ?? user?.email ?? ""} disabled className="mt-1" /></div>
            {profile?.student_id && <div><Label>Student ID</Label><Input value={profile.student_id} disabled className="mt-1" /></div>}
          </div>
          <div><Label>Bio</Label><Textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className="mt-1" placeholder="Tell us about yourself…" /></div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Palette className="w-4 h-4" />Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-sm">Mode</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-w-xs">
              <Button variant={mode === "light" ? "default" : "outline"} onClick={() => setMode("light")} className="gap-2">
                <Sun className="w-4 h-4" /> Light
              </Button>
              <Button variant={mode === "dark" ? "default" : "outline"} onClick={() => setMode("dark")} className="gap-2">
                <Moon className="w-4 h-4" /> Dark
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm">Accent Color</Label>
            <div className="grid grid-cols-4 gap-3 mt-2 max-w-md">
              {(Object.keys(ACCENTS) as Accent[]).map(key => {
                const a = ACCENTS[key];
                const value = mode === "dark" ? a.dark : a.light;
                const selected = accent === key;
                return (
                  <button key={key} onClick={() => setAccent(key)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${selected ? "border-primary bg-accent" : "border-transparent hover:bg-muted"}`}>
                    <div className="w-10 h-10 rounded-full border-2 border-border" style={{ backgroundColor: `hsl(${value})` }} />
                    <span className="text-[11px] text-foreground text-center">{a.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={resetToDefault}>Reset to default</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
