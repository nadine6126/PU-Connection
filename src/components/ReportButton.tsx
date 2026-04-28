import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  contentType: "community_post" | "question" | "answer" | "group_message";
  contentId: string;
  reportedUserId: string;
};

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

export const ReportButton = ({ contentType, contentId, reportedUserId }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user || user.id === reportedUserId) return null;

  const handleSubmit = async () => {
    if (!reason) { toast.error("Please select a reason"); return; }
    setSubmitting(true);

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      content_type: contentType,
      content_id: contentId,
      reason,
      status: "pending",
    });

    setSubmitting(false);

    if (error?.code === "23505") {
      toast.error("You already reported this content");
      setOpen(false);
      return;
    }
    if (error) { toast.error(error.message); return; }

    // Cek apakah sudah 3 reports → alert admin via toast (realtime akan handle di admin)
    const { count } = await supabase.from("reports")
      .select("*", { count: "exact", head: true })
      .eq("content_id", contentId)
      .eq("status", "pending");

    toast.success("Report submitted. Thank you!");
    setOpen(false);
    setReason("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
        title="Report this content"
      >
        <Flag className="w-3 h-3" />
        Report
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Why are you reporting this? We'll review it and take action if needed.
            </p>
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};