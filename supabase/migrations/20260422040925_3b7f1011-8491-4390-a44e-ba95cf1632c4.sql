-- ============================================================
-- DROP existing schema (clean slate)
-- ============================================================
DROP TABLE IF EXISTS public.group_messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.study_groups CASCADE;
DROP TABLE IF EXISTS public.qa_replies CASCADE;
DROP TABLE IF EXISTS public.qa_threads CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;
DROP TABLE IF EXISTS public.event_rsvps CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_owner_as_member() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================
-- LOOKUPS
-- ============================================================
CREATE TABLE public.faculties (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faculties readable by all auth" ON public.faculties FOR SELECT TO authenticated USING (true);

CREATE TABLE public.majors (
  id         SERIAL PRIMARY KEY,
  faculty_id INTEGER NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL
);
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Majors readable by all auth" ON public.majors FOR SELECT TO authenticated USING (true);

-- ============================================================
-- ROLES (separate table to avoid privilege escalation)
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin','student');

CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles readable by auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username        VARCHAR(50) UNIQUE,
  email           VARCHAR(100),
  full_name       VARCHAR(100) NOT NULL DEFAULT 'Student',
  avatar_url      TEXT,
  bio             TEXT,
  faculty_id      INTEGER REFERENCES public.faculties(id) ON DELETE SET NULL,
  major_id        INTEGER REFERENCES public.majors(id) ON DELETE SET NULL,
  student_id      VARCHAR(20),
  dashboard_color CHAR(7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-PROVISION profile + role on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := NEW.email;
  v_role public.app_role := 'student';
BEGIN
  IF v_email LIKE '%@admin.president.ac.id' THEN v_role := 'admin'; END IF;
  INSERT INTO public.profiles (user_id, full_name, email, student_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(v_email,'@',1)),
    v_email,
    NEW.raw_user_meta_data->>'student_id'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STUDY GROUPS
-- ============================================================
CREATE TABLE public.study_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(120) UNIQUE,
  description     TEXT,
  cover_image_url TEXT,
  course_name     VARCHAR(100),
  faculty_id      INTEGER REFERENCES public.faculties(id) ON DELETE SET NULL,
  creator_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  max_members     INTEGER NOT NULL DEFAULT 20,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups viewable by auth" ON public.study_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can create groups" ON public.study_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator updates group" ON public.study_groups FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Creator deletes group" ON public.study_groups FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.study_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.study_group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      VARCHAR(15) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','moderator','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by auth" ON public.study_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "User can join group" ON public.study_group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can leave group" ON public.study_group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = _group AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.study_group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_add_owner AFTER INSERT ON public.study_groups FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE TABLE public.group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.group_messages FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members post messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Author deletes message" ON public.group_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- ============================================================
-- Q&A (anonymous-capable)
-- ============================================================
CREATE TABLE public.questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         VARCHAR(300) NOT NULL,
  body          TEXT NOT NULL,
  tags          TEXT[] DEFAULT '{}',
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  is_answered   BOOLEAN NOT NULL DEFAULT false,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  views_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions viewable by auth" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author updates question" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Author deletes question" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  is_accepted   BOOLEAN NOT NULL DEFAULT false,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers viewable by auth" ON public.answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create answers" ON public.answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author deletes answer" ON public.answers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_answers_updated BEFORE UPDATE ON public.answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- COMMUNITY
-- ============================================================
CREATE TABLE public.community_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       VARCHAR(15) NOT NULL DEFAULT 'general' CHECK (category IN ('tips','networking','general','announcement')),
  title          VARCHAR(300),
  body           TEXT NOT NULL,
  image_url      TEXT,
  is_pinned      BOOLEAN NOT NULL DEFAULT false,
  upvotes_count  INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by auth" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author updates post" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Author deletes post" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE public.events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL,
  description           TEXT,
  cover_image_url       TEXT,
  event_type            VARCHAR(15) NOT NULL DEFAULT 'webinar' CHECK (event_type IN ('webinar','workshop','seminar','meetup')),
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  location_or_link      TEXT,
  external_register_url TEXT,
  status                VARCHAR(10) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by auth" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin or self create event" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Owner or admin update event" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin delete event" ON public.events FOR DELETE TO authenticated USING (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RSVPs viewable by auth" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users RSVP self" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel RSVP" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TASKS / CALENDAR
-- ============================================================
CREATE TABLE public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES public.study_groups(id) ON DELETE SET NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  priority    VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status      VARCHAR(15) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  reminder_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.calendar_events (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id   UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  event_id  UUID REFERENCES public.events(id) ON DELETE SET NULL,
  group_id  UUID REFERENCES public.study_groups(id) ON DELETE SET NULL,
  title     VARCHAR(200) NOT NULL,
  description TEXT,
  start_at  TIMESTAMPTZ NOT NULL,
  end_at    TIMESTAMPTZ,
  type      VARCHAR(15) NOT NULL DEFAULT 'custom' CHECK (type IN ('task','group_meeting','webinar','custom','exam','assignment')),
  color     CHAR(7),
  reminder_minutes INTEGER DEFAULT 60,
  reminded  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own calendar" ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own calendar" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own calendar" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own calendar" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AI HISTORY (summaries + chatbot)
-- ============================================================
CREATE TABLE public.ai_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type     VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','file','question','discussion')),
  source_name     TEXT,
  input_text      TEXT NOT NULL,
  summary_text    TEXT NOT NULL,
  topics          TEXT[] DEFAULT '{}',
  key_points      TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own summaries" ON public.ai_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create summaries" ON public.ai_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own summaries" ON public.ai_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chatbot_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL DEFAULT 'New chat',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sessions" ON public.chatbot_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create sessions" ON public.chatbot_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.chatbot_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.chatbot_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.chatbot_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chatbot_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.chatbot_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.chatbot_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.chatbot_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_groups_creator ON public.study_groups(creator_id);
CREATE INDEX idx_group_members_user ON public.study_group_members(user_id);
CREATE INDEX idx_group_messages_group ON public.group_messages(group_id, created_at);
CREATE INDEX idx_questions_user ON public.questions(user_id);
CREATE INDEX idx_answers_question ON public.answers(question_id);
CREATE INDEX idx_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX idx_events_start ON public.events(start_at);
CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, due_date);
CREATE INDEX idx_calendar_user_start ON public.calendar_events(user_id, start_at);
CREATE INDEX idx_summaries_user ON public.ai_summaries(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_session ON public.chatbot_messages(session_id, created_at);

-- ============================================================
-- SEED faculties + majors only (no user data)
-- ============================================================
INSERT INTO public.faculties (name) VALUES
  ('Faculty of Business'),
  ('Faculty of Computer Science'),
  ('Faculty of Engineering'),
  ('Faculty of Social Science and Education'),
  ('Faculty of Law'),
  ('Faculty of Medicine'),
  ('Faculty of Art, Design and Architecture');

INSERT INTO public.majors (faculty_id, name) VALUES
  (1,'Accounting'),(1,'Business Administration'),(1,'Management'),(1,'Actuarial Science'),(1,'Agribusiness'),
  (2,'Informatics'),(2,'Information Systems'),
  (3,'Mechanical Engineering'),(3,'Electrical Engineering'),(3,'Industrial Engineering'),(3,'Environmental Engineering'),(3,'Civil Engineering'),
  (4,'International Relations'),(4,'Communication'),(4,'Elementary Teacher Education'),
  (5,'Law'),
  (6,'Medicine'),
  (7,'Interior Design'),(7,'Architecture'),(7,'Visual Communication Design');

-- ============================================================
-- STORAGE: avatars bucket (public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);