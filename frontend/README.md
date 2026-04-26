# Frontend — PU Academic Hub

> ⚠️ **Where is the actual UI code?**
> Vite + React projects have a fixed structure at the project root, so the React source code
> stays in **`/src`** (not inside this folder). This `frontend/` folder exists as a documentation
> bookmark to make it obvious what is "frontend" vs "backend" when you browse the repo.

## File map

| Concern                       | Path                                                |
|-------------------------------|-----------------------------------------------------|
| Pages (route components)      | `src/pages/`                                        |
| Reusable components           | `src/components/`                                   |
| UI primitives (shadcn)        | `src/components/ui/`                                |
| Auth context + hooks          | `src/hooks/useAuth.tsx`                             |
| Supabase client               | `src/integrations/supabase/client.ts`               |
| Tailwind tokens (theme)       | `src/index.css`, `tailwind.config.ts`               |
| App entry + routing           | `src/main.tsx`, `src/App.tsx`                       |
| Static assets                 | `public/`, `src/assets/`                            |

## Key pages

- `LandingPage` (`src/pages/Index.tsx`) — public hero & features
- `LoginPage` — sign in / register + demo quick-login (Student/Organizer/Admin)
- `DashboardLayout` — sidebar shell for all logged-in routes
- `DashboardHome` — overview cards
- `StudyGroups` — browse/create/join groups
- `StudyGroupDetail` — realtime chat + members (WhatsApp-style)
- `QAForum` — anonymous Q&A + AI Summary button
- `CommunityPage`, `EventsPage`, `CalendarPage`, `ProfilePage`

## Floating AI Chatbot

Mounted globally in `DashboardLayout` via `src/components/AIChatbot.tsx`.
It calls the `ai-chatbot` Edge Function (Groq Llama).

## Edit checklist

- Change colors / theme → `src/index.css` (HSL tokens) + `tailwind.config.ts`
- Add a new page → create file in `src/pages/`, register route in `src/App.tsx`
- Call backend → `supabase.functions.invoke("function-name", { body })`
