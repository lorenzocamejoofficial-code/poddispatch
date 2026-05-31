import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

/**
 * Captures a clearinghouse rejection in structured form so we have receipts
 * the next time we need to diagnose why a claim failed. Pasting the raw OA
 * response into the textarea triggers a best-effort parser that pulls out
 * Loop / Segment / Byte — biller can override before saving.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  claimLabel: string;
  onSaved?: () => void;
}

function parseRejection(raw: string): { loop?: string; segment?: string; byte?: number } {
  const out: { loop?: string; segment?: string; byte?: number } = {};
  const loopMatch = raw.match(/LastLoop:\s*(\S+)/i) || raw.match(/Loop[:\s]+(\S+)/i);
  if (loopMatch) out.loop = loopMatch[1].trim();
  const segMatch = raw.match(/RecordType:\s*(\S+)/i) || raw.match(/Segment:\s*([A-Z0-9]+)/i);
  if (segMatch) out.segment = segMatch[1].trim();
  const byteMatch = raw.match(/Byte\s+(\d+)/i);
  if (byteMatch) out.byte = parseInt(byteMatch[1], 10);
  return out;
}

export function RecordRejectionDialog({ open, onOpenChange, claimId, claimLabel, onSaved }: Props) {
  const [raw, setRaw] = useState("");
  const [loop, setLoop] = useState("");
  const [segment, setSegment] = useState("");
  const [byteStr, setByteStr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleRawChange = (v: string) => {
    setRaw(v);
    const parsed = parseRejection(v);
    if (parsed.loop && !loop) setLoop(parsed.loop);
    if (parsed.segment && !segment) setSegment(parsed.segment);
    if (parsed.byte && !byteStr) setByteStr(String(parsed.byte));
  };

  const handleSave = async () => {
    if (!raw.trim()) {
      toast.error("Paste the clearinghouse rejection text first");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("claim_records" as any)
        .update({
          last_rejection_raw: raw,
          last_rejection_loop: loop || null,
          last_rejection_segment: segment || null,
          last_rejection_byte: byteStr ? parseInt(byteStr, 10) : null,
          last_rejection_recorded_at: new Date().toISOString(),
          last_rejection_recorded_by: user?.id ?? null,
          status: "denied",
          denial_reason: raw.slice(0, 500),
        } as any)
        .eq("id", claimId);
      if (error) throw error;
      toast.success("Rejection recorded, diagnostic context saved to claim");
      setRaw(""); setLoop(""); setSegment(""); setByteStr("");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Record Clearinghouse Rejection
          </DialogTitle>
          <DialogDescription>
            Paste the rejection email/screenshot text from Office Ally for{" "}
            <span className="font-medium">{claimLabel}</span>. We'll parse the
            location of the failure so future submissions can be diagnosed
            against the actual EDI bytes that were sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="raw">Full rejection text</Label>
            <Textarea
              id="raw"
              rows={8}
              value={raw}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder={"Example:\nLastLoop:    2300\nRecordType:  DTP\nSegment:     472*D8*20260429\nRow 21, Byte 714\nDescription: Unknown Segment"}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="loop" className="text-xs">Loop</Label>
              <Input id="loop" value={loop} onChange={(e) => setLoop(e.target.value)} placeholder="2300" />
            </div>
            <div>
              <Label htmlFor="segment" className="text-xs">Segment</Label>
              <Input id="segment" value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="DTP" />
            </div>
            <div>
              <Label htmlFor="byte" className="text-xs">Byte offset</Label>
              <Input id="byte" type="number" value={byteStr} onChange={(e) => setByteStr(e.target.value)} placeholder="714" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Record Rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}