import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AIChatbot } from "@/components/AIChatbot";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const DashboardLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("Student");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string };
    const metaName = meta.display_name || meta.full_name;
    const emailPrefix = user.email?.split("@")[0] ?? "Student";
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const profName = data?.full_name && data.full_name !== "Student" ? data.full_name : null;
        setName(profName || metaName || emailPrefix);
        if (data?.avatar_url) setAvatar(data.avatar_url);
      });
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => navigate("/dashboard/profile")}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring transition hover:opacity-80"
                aria-label="Open profile settings"
                title="Profile settings"
              >
                <Avatar className="w-8 h-8">
                  {avatar && <AvatarImage src={avatar} alt={name} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">{initials(name)}</AvatarFallback>
                </Avatar>
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AIChatbot />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
