# Backend — PU Academic Hub

This folder contains the **backend logic** for the project.

> ⚠️ **Important architecture note**
> Lovable's preview sandbox can only run the React frontend, not a Python server.
> So the **actual backend that runs in production** is implemented as **Supabase Edge Functions**
> (Deno/TypeScript) located in `/supabase/functions/`.
>
> The Python file `main.py` in this folder is the **original FastAPI reference** you provided.
> It is kept here so you can:
> - Run it locally yourself (`uvicorn main:app --reload`) if you want a Python backend
> - Read it as a spec — every endpoint here has a matching Edge Function

## File map

| Concern              | Python reference              | Production (deployed)                           |
|----------------------|-------------------------------|-------------------------------------------------|
| AI Summary (Groq)    | `backend/main.py`             | `supabase/functions/ai-summary/index.ts`        |
| AI Chatbot (Groq)    | _(see edge function)_         | `supabase/functions/ai-chatbot/index.ts`        |
| Auth / users         | Supabase Auth (managed)       | Supabase Auth (managed)                         |
| Database / RLS       | `backend/schema.sql`          | Lovable Cloud (auto-deployed migrations)        |
| Realtime chat        | Supabase Realtime             | Supabase Realtime                               |

## Environment

The deployed Edge Functions read `GROQ_API_KEY` from Supabase secrets (already configured).
If you run `main.py` locally, create a `.env.local` here with:

```
GROQ_API_KEY=your_groq_key
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run the Python backend locally (optional)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend does **not** call this Python server by default — it calls the Edge Functions.
To switch, point `supabase.functions.invoke` calls in the frontend to your Python URL.
