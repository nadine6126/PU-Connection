import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, FileText, Loader2, History, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import mammoth from "mammoth";
import { formatDistanceToNow } from "date-fns";

type Result = { summary: string; topics?: string[]; key_points?: string[] };
type HistoryItem = {
  id: string; source_type: string; source_name: string | null;
  input_text: string; summary_text: string;
  topics: string[] | null; key_points: string[] | null; created_at: string;
};

const AISummaryPage = () => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from("ai_summaries").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setHistory((data ?? []) as any);
  };

  useEffect(() => { loadHistory(); }, [user]);

  const extractFromFile = async (file: File): Promise<string> => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "txt" || ext === "md") return await file.text();
    if (ext === "docx") {
      const buf = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
      return value;
    }
    if (ext === "pdf") {
      const pdfjs = await import("pdfjs-dist");
      // @ts-ignore
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let out = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map((it: any) => it.str).join(" ") + "\n";
      }
      return out;
    }
    throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
  };

  const handleFile = async (file: File) => {
    setBusy(true); setFileName(file.name);
    try {
      const extracted = await extractFromFile(file);
      if (extracted.trim().length < 20) throw new Error("Could not extract enough text from the file.");
      setText(extracted);
      toast.success(`Extracted ${extracted.length.toLocaleString()} characters`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to read file");
      setFileName("");
    } finally { setBusy(false); }
  };

  const summarize = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 20) { toast.error("Please provide at least 20 characters."); return; }
    setBusy(true); setResult(null); setViewingId(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-summary", { body: { text: trimmed } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r: Result = data;
      setResult(r);
      // Save to history
      await supabase.from("ai_summaries").insert({
        user_id: user!.id,
        source_type: fileName ? "file" : "manual",
        source_name: fileName || null,
        input_text: trimmed.slice(0, 10000),
        summary_text: r.summary,
        topics: r.topics ?? [],
        key_points: r.key_points ?? [],
      });
      loadHistory();
      toast.success("Summary generated & saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to summarize");
    } finally { setBusy(false); }
  };

  const viewHistory = (h: HistoryItem) => {
    setResult({ summary: h.summary_text, topics: h.topics ?? [], key_points: h.key_points ?? [] });
    setText(h.input_text);
    setFileName(h.source_name ?? "");
    setViewingId(h.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistory = async (id: string) => {
    await supabase.from("ai_summaries").delete().eq("id", id);
    toast.success("Removed from history");
    loadHistory();
    if (viewingId === id) { setResult(null); setViewingId(null); }
  };

  const reset = () => {
    setText(""); setFileName(""); setResult(null); setViewingId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> AI Summary
        </h1>
        <p className="text-muted-foreground">Paste long text or upload a document to get an academic summary. History is saved automatically.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Input</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="cursor-pointer">
              <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} disabled={busy} />
              <Button variant="outline" size="sm" asChild disabled={busy}>
                <span><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload PDF/DOCX/TXT</span>
              </Button>
            </label>
            {fileName && <Badge variant="secondary" className="gap-1"><FileText className="w-3 h-3" />{fileName}</Badge>}
            {(text || result) && (
              <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
            )}
          </div>
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={10}
            placeholder="Paste your text, paragraph, or article here…" disabled={busy} />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters</p>
            <Button onClick={summarize} disabled={busy || text.trim().length < 20}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> : <><Sparkles className="w-4 h-4 mr-2" />Summarize</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Result</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Summary</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.summary}</p>
            </div>
            {result.topics && result.topics.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Topics</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.topics.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            )}
            {result.key_points && result.key_points.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Key Points</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {result.key_points.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="w-4 h-4" />History ({history.length})</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No summaries yet. Generate one above to see it here.</p>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className={`flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors ${viewingId === h.id ? "border-primary bg-accent" : ""}`}>
                  <button onClick={() => viewHistory(h)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{h.source_name ?? h.summary_text.slice(0, 60)}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteHistory(h.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AISummaryPage;
