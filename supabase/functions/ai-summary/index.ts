// Edge Function: AI Summary (mirrors backend/main.py logic, runs in Deno)
// Calls Groq Llama to summarize a long Q&A thread or discussion text.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Provide at least 20 characters of text." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const prompt = `You are an expert academic assistant. Summarize the following discussion thread in clear English.

Return ONLY valid JSON in this shape:
{
  "summary": "concise academic summary, max 150 words",
  "topics": ["topic1", "topic2", "..."],
  "key_points": ["point1", "point2", "..."]
}

Thread:
"""${text.slice(0, 8000)}"""`;

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
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
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content, topics: [], key_points: [] }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-summary error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
