import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import StudyGroups from "./pages/StudyGroups";
import StudyGroupDetail from "./pages/StudyGroupDetail";
import CommunityPage from "./pages/CommunityPage";
import QAForum from "./pages/QAForum";
import EventsPage from "./pages/EventsPage";
import CalendarPage from "./pages/CalendarPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboard from "./pages/AdminDashboard";
import AISummaryPage from "./pages/AISummaryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<DashboardHome />} />
                <Route path="study-groups" element={<StudyGroups />} />
                <Route path="study-groups/:id" element={<StudyGroupDetail />} />
                <Route path="community" element={<CommunityPage />} />
                <Route path="qa" element={<QAForum />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="ai-summary" element={<AISummaryPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="admin" element={<AdminDashboard />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
