-- Hapus semua data konten dulu (urutan aman terhadap FK)
TRUNCATE TABLE
  public.chatbot_messages,
  public.chatbot_sessions,
  public.ai_summaries,
  public.calendar_events,
  public.tasks,
  public.event_rsvps,
  public.events,
  public.answers,
  public.questions,
  public.community_posts,
  public.group_messages,
  public.study_group_members,
  public.study_groups,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

-- Hapus semua user auth (ini juga akan trigger cascade kalau ada)
DELETE FROM auth.users;
