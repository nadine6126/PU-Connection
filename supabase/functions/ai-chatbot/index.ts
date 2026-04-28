// Edge Function: AI Recommendation — personalized learning recommendations
// Converted from groq.js to Deno-compatible TypeScript Edge Function

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const MODEL = "llama-3.3-70b-versatile";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InternalData {
  study_groups?: unknown[];
  qna?: unknown[];
  events?: unknown[];
}

interface AISuggestion {
  title: string;
  description: string;
  steps: string[];
}

interface InternalItem {
  type: "study_group" | "qna" | "event";
  title: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface ExternalItem {
  source: "youtube" | "web";
  title: string;
  channel?: string;
  platform?: string;
  description: string;
  url: string;
}

interface RecommendationResponse {
  ai_suggestions: AISuggestion[];
  internal: InternalItem[];
  external: ExternalItem[];
}

// ─── Groq helpers ─────────────────────────────────────────────────────────────

async function groqChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number; json?: boolean } = {}
) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 800,
  };
  if (options.json) body.response_format = { type: "json_object" };

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Groq API error (${r.status}): ${t}`);
  }

  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

// ─── extractKeywords ──────────────────────────────────────────────────────────

async function extractKeywords(apiKey: string, userQuery: string): Promise<string[]> {
  const text = await groqChat(
    apiKey,
    [
      {
        role: "system",
        content: `Extract technical learning keywords from the user's question.
Return ONLY a JSON object with two arrays: Indonesian and English keywords.
Max 5 items each. Include both original terms AND their translations.

Example input: "saya ingin belajar machine learning"
Example output: {"id":["machine learning","pembelajaran mesin","python","data"],"en":["machine learning","neural network","python","deep learning","AI"]}

Example input: "I want to learn web development"
Example output: {"id":["pengembangan web","javascript","html","css","react"],"en":["web development","javascript","frontend","html","css"]}

No explanation outside the JSON.`,
      },
      { role: "user", content: userQuery },
    ],
    { temperature: 0.2, max_tokens: 200 }
  );

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const combined = [
      ...(Array.isArray(parsed.id) ? parsed.id : []),
      ...(Array.isArray(parsed.en) ? parsed.en : []),
    ]
      .map((k: string) => k.toLowerCase().trim())
      .filter(Boolean);

    const unique = [...new Set(combined)].slice(0, 10);
    return unique.length > 0 ? unique : [userQuery];
  } catch {
    return [userQuery];
  }
}

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

function buildSystemPrompt(internal: InternalData): string {
  const hasStudyGroups = (internal.study_groups?.length ?? 0) > 0;
  const hasQnA = (internal.qna?.length ?? 0) > 0;
  const hasEvents = (internal.events?.length ?? 0) > 0;
  const hasInternal = hasStudyGroups || hasQnA || hasEvents;

  return `Kamu adalah AI Learning Assistant dari platform PU Connect — platform komunitas kampus Indonesia.
Tugasmu: merekomendasikan cara belajar yang personal dan terstruktur.

${
    hasInternal
      ? `=== DATA INTERNAL PU CONNECT ===

${hasStudyGroups ? `STUDY GROUPS (grup belajar aktif yang bisa di-join):
${JSON.stringify(internal.study_groups, null, 2)}` : "Tidak ada study group yang relevan."}

${hasQnA ? `Q&A KOMUNITAS (pertanyaan & jawaban dari komunitas kampus):
${JSON.stringify(internal.qna, null, 2)}` : "Tidak ada Q&A yang relevan."}

${hasEvents ? `EVENTS (webinar/workshop/seminar yang akan datang):
${JSON.stringify(internal.events, null, 2)}` : "Tidak ada event yang relevan."}`
      : "=== Tidak ada data internal yang relevan ==="
  }

INSTRUKSI:
- Respons HANYA dalam format JSON (tanpa teks atau backtick di luar JSON)
- Semua teks bisa dalam bahasa Indonesia atau Inggris, sesuaikan dengan bahasa pertanyaan pengguna
- Bagian "internal": WAJIB masukkan SEMUA item dari DATA INTERNAL ke array "internal", jangan ada yang dibuang atau dilewati. Jika memang tidak ada data internal sama sekali, baru boleh array kosong []
- Setiap item di "internal" WAJIB punya field "type" dengan nilai persis: "study_group", "qna", atau "event"
- Bagian "external": rekomendasikan YouTube channel/video dan website/course nyata dengan URL valid
- Bagian "ai_suggestions": 1-2 saran belajar terstruktur

Format JSON wajib:
{
  "ai_suggestions": [
    {
      "title": "string",
      "description": "string (2-3 kalimat)",
      "steps": ["string", "string", "string", "string"]
    }
  ],
  "internal": [
    {
      "type": "study_group" | "qna" | "event",
      "title": "string",
      "description": "string",
      "tags": ["string"],
      "course": "string",
      "slug": "string",
      "best_answer": "string",
      "is_answered": true,
      "upvotes": 0,
      "event_type": "string",
      "start_at": "string",
      "location_or_link": "string",
      "register_url": "string"
    }
  ],
  "external": [
    {
      "source": "youtube" | "web",
      "title": "string",
      "channel": "string",
      "platform": "string",
      "description": "string",
      "url": "string"
    }
  ]
}`;
}

// ─── generateRecommendation ───────────────────────────────────────────────────

async function generateRecommendation(
  apiKey: string,
  userQuery: string,
  internal: InternalData,
  history: { role: string; content: string }[] = []
): Promise<RecommendationResponse> {
  const text = await groqChat(
    apiKey,
    [
      { role: "system", content: buildSystemPrompt(internal) },
      ...history.slice(-6),
      { role: "user", content: userQuery },
    ],
    { temperature: 0.4, max_tokens: 1500, json: true }
  );

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      ai_suggestions: Array.isArray(parsed.ai_suggestions) ? parsed.ai_suggestions.slice(0, 2) : [],
      internal: Array.isArray(parsed.internal) ? parsed.internal.slice(0, 6) : [],
      external: Array.isArray(parsed.external) ? parsed.external.slice(0, 6) : [],
    };
  } catch (err) {
    console.error("[groq] JSON parse error:", err);
    throw new Error("Groq mengembalikan format yang tidak valid");
  }
}

// ─── Fetch internal data from Supabase ────────────────────────────────────────

async function fetchInternalData(
  supabase: ReturnType<typeof createClient>,
  keywords: string[]
): Promise<InternalData> {
  const kw = keywords.slice(0, 5);

  const [{ data: groups }, { data: qna }, { data: events }] = await Promise.all([
    supabase
      .from("study_groups")
      .select("id, name, subject, description, tags, slug")
      .overlaps("tags", kw)
      .limit(4),
    supabase
      .from("qna_posts")
      .select("id, title, body, tags, slug, is_answered, upvotes, best_answer")
      .overlaps("tags", kw)
      .limit(4),
    supabase
      .from("events")
      .select("id, title, description, event_type, start_at, location_or_link, register_url, tags")
      .overlaps("tags", kw)
      .gte("start_at", new Date().toISOString())
      .limit(4),
  ]);

  return {
    study_groups: groups ?? [],
    qna: qna ?? [],
    events: events ?? [],
  };
}

// ─── Edge Function Entry ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, history } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query string is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    // Init Supabase with user auth if available
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );

    // Step 1: Extract keywords from user query
    const keywords = await extractKeywords(GROQ_API_KEY, query);
    console.log("[keywords]", keywords);

    // Step 2: Fetch matching internal data from Supabase
    const internal = await fetchInternalData(supabase, keywords);
    console.log("[internal]", {
      groups: internal.study_groups?.length,
      qna: internal.qna?.length,
      events: internal.events?.length,
    });

    // Step 3: Generate recommendation
    const result = await generateRecommendation(
      GROQ_API_KEY,
      query,
      internal,
      Array.isArray(history) ? history : []
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommendation error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});