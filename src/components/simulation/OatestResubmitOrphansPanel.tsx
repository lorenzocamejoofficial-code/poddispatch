import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";
import { queueClaimsForSubmission, type QueueResult } from "@/lib/queue-claims-for-submission";
import { supabase } from "@/integrations/supabase/client";

// One-shot resubmission of the four primary OATEST claims that were
// rejected by Office Ally with RC66 (SV107 missing). After the SV107 +
// DTP*573 generator fixes, re-queue these four with a fresh ISA13/GS06.
// Submitting again from the existing generator path proves the fix on
// the wire without ad-hoc scaffolding.
const LORENZO_TEST_COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";
const ORPHAN_PRIMARIES: { id: string; label: string }[] = [
  { id: "27d70fe1-d67b-4480-9345-fc091eef7060", label: "27d70fe1 (medicare, 2026-05-16)" },
  { id: "f510c8d7-8c39-4774-b8e1-5d5a536eacde", label: "f510c8d7 (medicare, 2026-05-16)" },
  { id: "4ce04185-9355-4c01-8214-0c0dad22d2b6", label: "4ce04185 (medicaid, 2026-05-17)" },
  { id: "8124e5e3-7f49-46a4-a692-b61d2ce0c6aa", label: "8124e5e3 (medicare, 2026-05-17)" },
];

export function OatestResubmitOrphansPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(QueueResult & { queueId?: string }) | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const ids = ORPHAN_PRIMARIES.map(p => p.id);
      const res = await queueClaimsForSubmission(ids, LORENZO_TEST_COMPANY_ID, { testMode: true });
      let queueId: string | undefined;
      if (res.ok && res.filename) {
        const { data } = await supabase
          .from("claim_submission_queue" as any)
          .select("id")
          .eq("filename", res.filename)
          .maybeSingle();
        queueId = (data as any)?.id;
      }
      setResult({ ...res, queueId });
      if (res.ok) {
        toast({ title: "Queued", description: `${res.queuedCount} claim(s) → ${res.filename}` });
      } else {
        toast({
          title: "Resubmit failed",
          description: res.error ?? res.setupErrors.join("; ") ?? "Unknown",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Resubmit threw", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-amber-500" />
          Resubmit 4 OATEST orphan primaries (SV107 / DTP*573 fix verification)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Re-queues the four primary claims rejected with RC66 through the standard
          generator → claim_submission_queue → Railway SFTP path. Fresh ISA13 / GS06,
          OATEST envelope (ISA15=T). Expect <strong>999 = IK5*A AK9*A</strong> and
          <strong> 277CA without RC66</strong>. 4ce04185 will still surface RC55
          (Medicaid pre-enrollment, unrelated).
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-0.5">
          {ORPHAN_PRIMARIES.map(p => (
            <li key={p.id} className="font-mono">• {p.label}</li>
          ))}
        </ul>
        <Button size="sm" disabled={busy} onClick={run} className="gap-1">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          Queue 4 resubmissions
        </Button>
        {result && (
          <div className="rounded-md border p-2 text-[11px] space-y-1">
            <div className="flex items-center gap-2">
              {result.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
              <span className="font-semibold">{result.ok ? "Queued" : "Failed"}</span>
              <Badge variant="outline" className="text-[9px]">{result.queuedCount} claim(s)</Badge>
              {result.filename && <span className="font-mono text-muted-foreground">{result.filename}</span>}
            </div>
            {result.queueId && (
              <p className="font-mono text-muted-foreground">queue row: {result.queueId}</p>
            )}
            {result.setupErrors.length > 0 && (
              <ul className="text-destructive">
                {result.setupErrors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
            {result.blocked.length > 0 && (
              <div className="text-destructive">
                <p>Blocked claims:</p>
                {result.blocked.map(b => (
                  <div key={b.claimId} className="font-mono">
                    • {b.claimId}: {b.issues.map(i => i.message).join("; ")}
                  </div>
                ))}
              </div>
            )}
            {result.error && <p className="text-destructive">{result.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}