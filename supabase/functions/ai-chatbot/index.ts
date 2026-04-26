// Edge Function: AI Chatbot — quick assistant with platform context
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SYSTEM_PROMPT = `You are PU Hub Assistant, a friendly, concise helper inside the PU Academic Hub web app.
You help students:
- Navigate the platform (Dashboard, Study Groups, Community, Q&A Forum, Events, Calendar, AI Summary, Profile)
- Find or create study groups
- Post in Q&A (anonymously if they want)
- Use AI Summary to summarize text or upload PDF/DOCX
- Track deadlines and reminders in Calendar
Use the user's context (their name, joined groups, upcoming events) to give personalized answers.
Keep answers short (max 4 sentences), friendly, use bullet points when listing options.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from authenticated user
    let contextBlock = "";
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [{ data: prof }, { data: gm }, { data: rsvps }, { data: cals }] = await Promise.all([
            supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
            supabase.from("group_members").select("study_groups(name, subject)").eq("user_id", user.id),
            supabase.from("event_rsvps").select("events(title, event_date)").eq("user_id", user.id),
            supabase.from("calendar_events").select("title, event_date").eq("user_id", user.id)
              .gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").limit(5),
          ]);
          const groups = (gm ?? []).map((g: any) => g.study_groups).filter(Boolean);
          const events = (rsvps ?? []).map((r: any) => r.events).filter(Boolean);
          contextBlock = `\n\nUser context:
- Name: ${prof?.display_name ?? "Student"}
- Joined groups: ${groups.length ? groups.map((g: any) => `${g.name} (${g.subject})`).join(", ") : "none"}
- Upcoming RSVPs: ${events.length ? events.map((e: any) => `${e.title} on ${e.event_date}`).join("; ") : "none"}
- Upcoming reminders: ${(cals ?? []).length ? cals!.map((c: any) => `${c.title} on ${c.event_date}`).join("; ") : "none"}`;
        }
      } catch (e) { console.error("context fetch", e); }
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: SYSTEM_PROMPT + contextBlock }, ...messages.slice(-12)],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("Groq error", r.status, t);
      return new Response(JSON.stringify({ error: `Groq API error (${r.status})` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chatbot error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
