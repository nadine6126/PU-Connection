ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizer_name TEXT,
  ADD COLUMN IF NOT EXISTS organizer_contact TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR NOT NULL DEFAULT 'pending';

-- Allow admins to update any event (for verification)
DROP POLICY IF EXISTS "Owner or admin update event" ON public.events;
CREATE POLICY "Owner or admin update event" ON public.events
  FOR UPDATE TO authenticated
  USING ((auth.uid() = posted_by) OR public.has_role(auth.uid(), 'admin'));

-- Allow admins to change user roles
DROP POLICY IF EXISTS "Admins manage roles insert" ON public.user_roles;
CREATE POLICY "Admins manage roles insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles update" ON public.user_roles;
CREATE POLICY "Admins manage roles update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles delete" ON public.user_roles;
CREATE POLICY "Admins manage roles delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));