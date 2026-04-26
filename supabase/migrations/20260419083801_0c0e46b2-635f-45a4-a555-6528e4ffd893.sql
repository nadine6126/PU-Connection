-- ROLES ENUM + TABLE (separate from profiles for security)
create type public.app_role as enum ('admin', 'organizer', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'student',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Anyone authenticated can read roles"
  on public.user_roles for select to authenticated using (true);

-- TIMESTAMP TRIGGER
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- PROFILES
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null default 'Student',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = user_id);

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- STUDY GROUPS
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  subject text not null,
  description text,
  tags text[] default '{}',
  max_members int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.study_groups enable row level security;

create policy "Groups viewable by authenticated"
  on public.study_groups for select to authenticated using (true);
create policy "Authenticated can create groups"
  on public.study_groups for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owner can update group"
  on public.study_groups for update to authenticated using (auth.uid() = owner_id);
create policy "Owner can delete group"
  on public.study_groups for delete to authenticated using (auth.uid() = owner_id);

create trigger trg_groups_updated before update on public.study_groups
  for each row execute function public.update_updated_at_column();

-- GROUP MEMBERS
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.study_groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
alter table public.group_members enable row level security;

create policy "Members viewable by authenticated"
  on public.group_members for select to authenticated using (true);
create policy "User can join group"
  on public.group_members for insert to authenticated with check (auth.uid() = user_id);
create policy "User can leave group"
  on public.group_members for delete to authenticated using (auth.uid() = user_id);

-- HELPER: is member?
create or replace function public.is_group_member(_group uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id=_group and user_id=_user)
$$;

-- AUTO-ADD OWNER AS MEMBER ON GROUP CREATE
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger trg_owner_member after insert on public.study_groups
  for each row execute function public.add_owner_as_member();

-- GROUP MESSAGES
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.study_groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.group_messages enable row level security;

create policy "Members can read messages"
  on public.group_messages for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy "Members can post messages"
  on public.group_messages for insert to authenticated
  with check (auth.uid() = user_id and public.is_group_member(group_id, auth.uid()));
create policy "Author can delete own message"
  on public.group_messages for delete to authenticated using (auth.uid() = user_id);

create index idx_group_messages_group on public.group_messages(group_id, created_at);

-- Q&A THREADS
create table public.qa_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text not null,
  is_anonymous boolean not null default false,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.qa_threads enable row level security;

create policy "Threads viewable by authenticated"
  on public.qa_threads for select to authenticated using (true);
create policy "Users create threads"
  on public.qa_threads for insert to authenticated with check (auth.uid() = user_id);
create policy "Author updates thread"
  on public.qa_threads for update to authenticated using (auth.uid() = user_id);
create policy "Author deletes thread"
  on public.qa_threads for delete to authenticated using (auth.uid() = user_id);

create trigger trg_threads_updated before update on public.qa_threads
  for each row execute function public.update_updated_at_column();

-- Q&A REPLIES
create table public.qa_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.qa_threads(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.qa_replies enable row level security;

create policy "Replies viewable by authenticated"
  on public.qa_replies for select to authenticated using (true);
create policy "Users create replies"
  on public.qa_replies for insert to authenticated with check (auth.uid() = user_id);
create policy "Author deletes reply"
  on public.qa_replies for delete to authenticated using (auth.uid() = user_id);

-- REALTIME
alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.group_members;
alter table public.group_messages replica identity full;
alter table public.group_members replica identity full;