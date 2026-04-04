import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BugReportDialogProps {
  currentPath: string;
  userId: string | undefined;
}

export function BugReportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} title="Report an Issue">
      <Bug className="h-4 w-4" />
    </Button>
  );
}

export function BugReportDialog({ currentPath, userId }: BugReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [pagePath, setPagePath] = useState(currentPath);
  const [tryingToDo, setTryingToDo] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    setPagePath(currentPath);
    setTryingToDo("");
    setWhatHappened("");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!tryingToDo.trim() || !whatHappened.trim()) {
      toast.error("Please fill in both fields");
      return;
    }
    setSubmitting(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) {
        toast.error("Could not determine your company");
        return;
      }
      const { error } = await supabase.from("support_tickets").insert({
        company_id: companyId,
        user_id: userId ?? "",
        page_path: pagePath,
        trying_to_do: tryingToDo.trim(),
        what_happened: whatHappened.trim(),
      });
      if (error) throw error;
      toast.success("Report submitted — we will follow up within 24 hours");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <BugReportButton onClick={handleOpen} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bug-page">What page were you on?</Label>
              <Input id="bug-page" value={pagePath} onChange={(e) => setPagePath(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-trying">What were you trying to do?</Label>
              <Textarea id="bug-trying" value={tryingToDo} onChange={(e) => setTryingToDo(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-happened">What happened instead?</Label>
              <Textarea id="bug-happened" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
