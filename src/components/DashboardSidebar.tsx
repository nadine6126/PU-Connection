import {
  LayoutDashboard, Users, MessageCircle, HelpCircle,
  Calendar, CalendarDays, GraduationCap, Settings, LogOut, Shield, Sparkles
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Study Groups", url: "/dashboard/study-groups", icon: Users },
  { title: "Community", url: "/dashboard/community", icon: MessageCircle },
  { title: "Q&A Forum", url: "/dashboard/qa", icon: HelpCircle },
  { title: "Events", url: "/dashboard/events", icon: Calendar },
  { title: "Calendar", url: "/dashboard/calendar", icon: CalendarDays },
  { title: "AI Summary", url: "/dashboard/ai-summary", icon: Sparkles },
];

const bottomItems = [
  { title: "Profile", url: "/dashboard/profile", icon: Settings },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const handleSignOut = async () => { await signOut(); navigate("/login"); };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              {!collapsed && <span className="font-semibold">PU Academic Hub</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-accent" activeClassName="bg-accent text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin" end className="hover:bg-accent" activeClassName="bg-accent text-primary font-medium">
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end className="hover:bg-accent" activeClassName="bg-accent text-primary font-medium">
                  <item.icon className="mr-2 h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
