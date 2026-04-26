import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Mail, Lock, Eye, EyeOff, User, IdCard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const STUDENT_DOMAIN = "@student.president.ac.id";
const ADMIN_DOMAIN = "@admin.president.ac.id";

type Role = "student" | "admin";

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => { if (session) navigate("/dashboard", { replace: true }); }, [session, navigate]);

  const expectedDomain = role === "admin" ? ADMIN_DOMAIN : STUDENT_DOMAIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lcEmail = email.toLowerCase().trim();

    if (!lcEmail.endsWith(expectedDomain)) {
      toast.error(`${role === "admin" ? "Admin" : "Student"} email must end with ${expectedDomain}`);
      return;
    }

    setBusy(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: lcEmail, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        if (role === "student") {
          if (!/^\d{12}$/.test(studentId)) {
            toast.error("Student ID must be 12 digits");
            setBusy(false); return;
          }
        }
        if (!name.trim()) { toast.error("Full name is required"); setBusy(false); return; }

        const { error } = await supabase.auth.signUp({
          email: lcEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              display_name: name.trim(),
              student_id: role === "student" ? studentId : null,
            },
          },
        });
        if (error) throw error;
        await supabase.auth.signOut();
        toast.success("Account created. Please sign in.");
        setIsLogin(true);
        setPassword("");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">PU Academic Hub</span>
          </div>
          <p className="text-muted-foreground text-sm">Your campus learning companion</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4 space-y-3">
            <div className="flex rounded-lg bg-secondary p-1">
              <button type="button" onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Sign In
              </button>
              <button type="button" onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Register
              </button>
            </div>
            <div className="flex rounded-lg border bg-background p-1">
              <button type="button" onClick={() => setRole("student")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${role === "student" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <User className="w-3 h-3" /> Student
              </button>
              <button type="button" onClick={() => setRole("admin")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${role === "admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <Shield className="w-3 h-3" /> Admin
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
                  </div>
                  {role === "student" && (
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Student ID (12 digits)" value={studentId}
                        onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 12))}
                        className="pl-10" maxLength={12} required />
                    </div>
                  )}
                </>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder={`name${expectedDomain}`} value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Password (min 6 chars)"
                  value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : isLogin ? `Sign In as ${role === "admin" ? "Admin" : "Student"}` : `Register as ${role === "admin" ? "Admin" : "Student"}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
