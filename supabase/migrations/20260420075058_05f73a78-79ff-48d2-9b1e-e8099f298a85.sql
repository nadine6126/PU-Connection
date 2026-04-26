
-- 1. Tambah kolom student_id & email ke profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_key ON public.profiles(student_id) WHERE student_id IS NOT NULL;

-- 2. Update handle_new_user untuk simpan student_id, email & assign role berdasarkan domain
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email TEXT := new.email;
  v_role app_role := 'student';
BEGIN
  IF v_email LIKE '%@admin.president.ac.id' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, student_id, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(v_email,'@',1)),
    new.raw_user_meta_data->>'student_id',
    v_email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, v_role);
  RETURN new;
END;
$$;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type TEXT NOT NULL DEFAULT 'task',
  reminder_minutes INTEGER DEFAULT 60,
  reminded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own calendar" ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own calendar" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own calendar" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own calendar" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Events (Webinar/campus events)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  event_type TEXT DEFAULT 'webinar',
  is_free BOOLEAN NOT NULL DEFAULT true,
  max_attendees INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved events viewable by all auth"
  ON public.events FOR SELECT TO authenticated
  USING (status = 'approved' OR auth.uid() = organizer_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Organizers & admins create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = organizer_id AND
    (public.has_role(auth.uid(),'organizer') OR public.has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Organizer updates own / admin updates any"
  ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin deletes events"
  ON public.events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Event RSVPs
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RSVPs viewable by auth" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users RSVP self" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel RSVP" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Community posts (Twitter-style)
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  topic TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by auth" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author deletes post" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Realtime for group_messages (set REPLICA IDENTITY FULL & add to publication)
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.community_posts REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
