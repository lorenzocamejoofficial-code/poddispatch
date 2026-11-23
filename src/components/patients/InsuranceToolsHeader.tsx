import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Live eligibility tool; coverage discovery lives on the patient Coverage tab. */
type Props = { configured: boolean; canUse: boolean };
export function InsuranceToolsHeader({ configured, canUse }: Props) {
  return <VerifyInsuranceButton configured={configured} canUse={canUse} />;
}

/* ───────────────────────── Verify Insurance ───────────────────────── */

function VerifyInsuranceButton({ configured, canUse }: { configured: boolean; canUse: boolean }) {
  const [open, setOpen] = useState(false);
  const [payer, setPayer] = useState("");
  const [memberId, setMemberId] = useState("");
  const [dob, setDob] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; summary: string; raw?: string }>(null);

  const reset = () => {
    setPayer(""); setMemberId(""); setDob(""); setFirstName(""); setLastName("");
    setResult(null); setRunning(false);
  };

  const run = async () => {
    if (!payer.trim() || !memberId.trim() || !dob || !firstName.trim() || !lastName.trim()) {
      toast.error("Fill in patient name, DOB, payer, and member ID");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-eligibility", {
        body: { first_name: firstName, last_name: lastName, dob, payer, member_id: memberId },
      });
      if (error) throw error;
      if (data?.is_eligible === true) {
        setResult({ ok: true, summary: data?.summary ?? "Coverage active." });
      } else if (data?.is_eligible === false) {
        setResult({ ok: false, summary: data?.summary ?? "Coverage inactive on this date." });
      } else {
        setResult({ ok: false, summary: data?.summary ?? data?.error ?? "Inconclusive response from payer." });
      }
    } catch (e: any) {
      setResult({ ok: false, summary: e?.message ?? "Verification failed" });
    }
    setRunning(false);
  };

  const trigger = (
    <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
      <ShieldCheck className="h-3.5 w-3.5" />
      Verify Insurance
    </Button>
  );

  return (
    <>
      {!canUse ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild><span tabIndex={0}>{trigger}</span></TooltipTrigger>
            <TooltipContent>Owners and billers only</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : trigger}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Insurance</DialogTitle>
            <DialogDescription>
              Real-time 270/271 eligibility check. Enter the patient's name, DOB, payer, and member ID to confirm coverage is active.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><Label>Last Name *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div><Label>DOB *</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div><Label>Payer *</Label><Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="e.g. Medicare, BCBS GA, Peach State" /></div>
            <div><Label>Member ID *</Label><Input value={memberId} onChange={(e) => setMemberId(e.target.value)} /></div>

            {result && (
              <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                result.ok
                  ? "border-[hsl(var(--status-green))]/40 bg-[hsl(var(--status-green))]/5"
                  : "border-destructive/40 bg-destructive/5"
              }`}>
                {result.ok
                  ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] mt-0.5 flex-shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="font-medium text-foreground">
                    {result.ok ? "Coverage active" : "Coverage inactive"}
                  </div>
                  <div className="text-xs text-muted-foreground">{result.summary}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              {configured ? (
                <Button onClick={run} disabled={running} className="gap-1.5">
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Run Verification
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button disabled className="gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Run Verification
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Activate Office Ally clearinghouse in Settings to enable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

