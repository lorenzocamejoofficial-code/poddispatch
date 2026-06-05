import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, ShieldCheck, Loader2, AlertTriangle, CheckCircle2, UserPlus, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Insurance Tools header for the Patients page.
 *
 * Two sibling tools that live next to Export CSV / Add Patient:
 *  • Verify Insurance — known payer + member ID → real-time eligibility.
 *  • Discover Coverage — name + DOB → finds every active policy and
 *    lets the user promote each into Primary / Secondary / Tertiary
 *    slots (Coordination-of-Benefits order suggested).
 *
 * Both call the same edge functions used elsewhere (`check-eligibility`
 * and `discover-coverage`). Until Office Ally REST is configured, the
 * action buttons stay disabled with a tooltip — same pattern as the
 * per-row Check Eligibility button on the patient list.
 */

export type DiscoveredPolicy = {
  payer_name: string;
  payer_id?: string;
  member_id: string;
  group_number?: string;
  rank?: "primary" | "secondary" | "tertiary" | "unknown";
  is_active?: boolean;
  coverage_start?: string;
  coverage_end?: string;
};

export type PrefillPayload = {
  first_name?: string;
  last_name?: string;
  dob?: string;
  primary_payer?: string;
  member_id?: string;
  secondary_payer?: string;
  secondary_member_id?: string;
  secondary_group_number?: string;
  secondary_payer_id?: string;
  tertiary_payer?: string;
  tertiary_member_id?: string;
  tertiary_group_number?: string;
  tertiary_payer_id?: string;
};

type Props = {
  configured: boolean;
  canUse: boolean;
  /** Called when the user promotes a discovered policy into a slot and we need
   *  the Add Patient form to open pre-filled (no matching patient was found). */
  onPrefillNewPatient: (data: PrefillPayload) => void;
  /** Called after successfully attaching a discovered policy to an existing
   *  patient — parent can refetch its patient list. */
  onPatientUpdated?: () => void;
};

export function InsuranceToolsHeader({ configured, canUse, onPrefillNewPatient, onPatientUpdated }: Props) {
  return (
    <>
      <VerifyInsuranceButton configured={configured} canUse={canUse} />
      <DiscoverCoverageButton
        configured={configured}
        canUse={canUse}
        onPrefillNewPatient={onPrefillNewPatient}
        onPatientUpdated={onPatientUpdated}
      />
    </>
  );
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

/* ──────────────────────── Discover Coverage ──────────────────────── */

function DiscoverCoverageButton({
  configured, canUse, onPrefillNewPatient, onPatientUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [running, setRunning] = useState(false);
  const [policies, setPolicies] = useState<DiscoveredPolicy[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    setFirstName(""); setLastName(""); setDob("");
    setPolicies(null); setEmpty(false); setErrorMsg(null); setRunning(false);
  };

  const run = async () => {
    if (!firstName.trim() || !lastName.trim() || !dob) {
      toast.error("Enter first name, last name, and DOB");
      return;
    }
    setRunning(true);
    setPolicies(null); setEmpty(false); setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("discover-coverage", {
        body: { first_name: firstName, last_name: lastName, dob },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data?.policies)) {
        const list = sortByCOB(data.policies as DiscoveredPolicy[]);
        setPolicies(list);
        setEmpty(list.length === 0);
      } else if (data?.success && Array.isArray(data?.coverages)) {
        const list = sortByCOB(data.coverages as DiscoveredPolicy[]);
        setPolicies(list);
        setEmpty(list.length === 0);
      } else {
        setErrorMsg(data?.error ?? "Discovery returned no policies.");
        setEmpty(true);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Discovery failed");
      setEmpty(true);
    }
    setRunning(false);
  };

  const promote = async (slot: "primary" | "secondary" | "tertiary", p: DiscoveredPolicy) => {
    // Match-or-create by (first_name + last_name + dob), exact match.
    const { data: matches } = await supabase
      .from("patients")
      .select("id, first_name, last_name, dob")
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .eq("dob", dob)
      .limit(2);

    const match = (matches ?? [])[0];

    if (match) {
      const updates: Record<string, any> =
        slot === "primary"
          ? { primary_payer: p.payer_name, member_id: p.member_id }
          : slot === "secondary"
            ? {
                secondary_payer: p.payer_name,
                secondary_member_id: p.member_id,
                secondary_group_number: p.group_number ?? null,
                secondary_payer_id: p.payer_id ?? null,
              }
            : {
                tertiary_payer: p.payer_name,
                tertiary_member_id: p.member_id,
                tertiary_group_number: p.group_number ?? null,
                tertiary_payer_id: p.payer_id ?? null,
              };
      const { error: upErr } = await supabase
        .from("patients")
        .update(updates)
        .eq("id", (match as any).id);
      if (upErr) {
        toast.error("Couldn't update patient: " + upErr.message);
        return;
      }
      toast.success(`Set as ${slot} on existing patient ${match.first_name} ${match.last_name}`);
      onPatientUpdated?.();
      return;
    }

    // No match → prefill Add Patient form and close the discover dialog.
    const payload: PrefillPayload = {
      first_name: firstName,
      last_name: lastName,
      dob,
    };
    if (slot === "primary") {
      payload.primary_payer = p.payer_name;
      payload.member_id = p.member_id;
    } else if (slot === "secondary") {
      payload.secondary_payer = p.payer_name;
      payload.secondary_member_id = p.member_id;
      payload.secondary_group_number = p.group_number;
      payload.secondary_payer_id = p.payer_id;
    } else {
      payload.tertiary_payer = p.payer_name;
      payload.tertiary_member_id = p.member_id;
      payload.tertiary_group_number = p.group_number;
      payload.tertiary_payer_id = p.payer_id;
    }
    onPrefillNewPatient(payload);
    setOpen(false);
    reset();
  };

  const addManually = (selfPay: boolean) => {
    onPrefillNewPatient({
      first_name: firstName,
      last_name: lastName,
      dob,
      ...(selfPay ? { primary_payer: "Self-Pay" } : {}),
    });
    setOpen(false);
    reset();
  };

  const trigger = (
    <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
      <Search className="h-3.5 w-3.5" />
      Discover Coverage
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Discover Coverage</DialogTitle>
            <DialogDescription>
              Search Office Ally for every active policy this patient has. Results are sorted in Coordination-of-Benefits order. You decide which one is Primary, Secondary, or Tertiary.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><Label>Last Name *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div><Label>DOB *</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>

            <div className="flex justify-end">
              {configured ? (
                <Button onClick={run} disabled={running} className="gap-1.5">
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Run Discovery
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button disabled className="gap-1.5">
                          <Search className="h-3.5 w-3.5" />
                          Run Discovery
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Activate Office Ally Insurance Discovery in Settings to enable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {policies && policies.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {policies.map((p, i) => (
                  <div key={`${p.payer_name}-${p.member_id}-${i}`} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{p.payer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Member ID: {p.member_id}{p.group_number ? ` · Group ${p.group_number}` : ""}
                        </div>
                        {(p.coverage_start || p.coverage_end) && (
                          <div className="text-[11px] text-muted-foreground">
                            {p.coverage_start ?? "?"} → {p.coverage_end ?? "open"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {p.is_active === true && (
                          <Badge variant="outline" className="text-[10px] border-[hsl(var(--status-green))]/40 text-[hsl(var(--status-green))]">Active</Badge>
                        )}
                        {p.is_active === false && (
                          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Inactive</Badge>
                        )}
                        {p.rank && p.rank !== "unknown" && (
                          <Badge className="text-[10px] gap-1"><Crown className="h-2.5 w-2.5" />Suggested: {p.rank}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => promote("primary", p)}>Use as Primary</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => promote("secondary", p)}>Use as Secondary</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => promote("tertiary", p)}>Use as Tertiary</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {empty && (
              <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">No active coverage found</div>
                    <div className="text-xs text-muted-foreground">
                      {errorMsg ?? "We couldn't find coverage for this patient under the payer network we query."} This usually means one of:
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        <li>The patient is self-pay</li>
                        <li>The name or DOB doesn't match payer records exactly</li>
                        <li>Their coverage is with a payer outside our discovery network</li>
                      </ul>
                      You can still add the patient and enter insurance manually, or mark them as self-pay.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addManually(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Add as Self-Pay
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addManually(false)}>
                    <UserPlus className="h-3.5 w-3.5" /> Add Manually
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Sort by Coordination of Benefits: Medicare → Medicaid → commercial → others. */
function sortByCOB(list: DiscoveredPolicy[]): DiscoveredPolicy[] {
  const score = (p: DiscoveredPolicy) => {
    const r = (p.rank ?? "").toLowerCase();
    if (r === "primary") return 0;
    if (r === "secondary") return 1;
    if (r === "tertiary") return 2;
    const n = (p.payer_name ?? "").toLowerCase();
    if (n.includes("medicare")) return 0;
    if (n.includes("medicaid")) return 1;
    return 3;
  };
  return [...list].sort((a, b) => score(a) - score(b));
}