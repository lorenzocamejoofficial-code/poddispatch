import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ClipboardCheck, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { computeClaimScore, getScoreBgClass, type ClaimScoreResult } from "@/lib/claim-score";
import { BillerPcsPanel } from "@/components/billing/BillerPcsPanel";
interface ChecklistItem {
  label: string;
  passed: boolean;
  detail?: string;
  isWarning?: boolean; // soft warning — does not block submission
}

interface PreSubmitChecklistProps {
  tripId: string;
  patientId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: () => void;
}

export function PreSubmitChecklist({ tripId, patientId, open, onOpenChange, onSubmit }: PreSubmitChecklistProps) {
  const { activeCompanyId } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claimScore, setClaimScore] = useState<ClaimScoreResult | null>(null);
  const [pcsApplicable, setPcsApplicable] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    (async () => {
      const [{ data: trip }, { data: patient }, { data: claimRow }, { data: payerDir }] = await Promise.all([
        supabase
          .from("trip_records" as any)
          .select("*, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_member_id, oneoff_primary_payer)")
          .eq("id", tripId)
          .maybeSingle(),
        patientId
          ? supabase.from("patients").select("*").eq("id", patientId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("claim_records" as any)
          .select("has_emergency_event, emergency_billing_reviewed_at, hcpcs_codes, payer_type, member_id, icd10_codes, pcs_physician_name, pcs_physician_npi, pcs_certification_date, pcs_diagnosis")
          .eq("trip_id", tripId)
          .maybeSingle(),
        activeCompanyId
          ? supabase.from("payer_directory").select("payer_type, timely_filing_days").eq("company_id", activeCompanyId)
          : Promise.resolve({ data: [] }),
      ]);

      if (!trip) {
        setItems([]);
        setLoading(false);
        return;
      }

      const t = trip as any;
      const p = patient as any;
      const claim = claimRow as any;

      // Resolve payer rules from Compliance & QA (payer_billing_rules) first — single source of truth.
      const claimPayerType = String(claim?.payer_type ?? p?.primary_payer ?? "").toLowerCase().trim();
      let payerRulesObj: {
        requires_pcs?: boolean | null;
        requires_signature?: boolean | null;
        requires_timestamps?: boolean | null;
        requires_miles?: boolean | null;
        requires_necessity_note?: boolean | null;
        requires_auth?: boolean | null;
      } | null = null;
      if (activeCompanyId && claimPayerType) {
        const { data: pr } = await supabase
          .from("payer_billing_rules")
          .select("requires_pcs, requires_signature, requires_timestamps, requires_miles, requires_necessity_note, requires_auth")
          .eq("company_id", activeCompanyId)
          .eq("payer_type", claimPayerType)
          .maybeSingle();
        if (pr) payerRulesObj = pr;
      }

      // Default to "required" if a column is null/missing — payer rules default-on for safety.
      const ruleOn = (v: boolean | null | undefined) => v !== false;
      const need = {
        pcs: ruleOn(payerRulesObj?.requires_pcs),
        signature: ruleOn(payerRulesObj?.requires_signature),
        timestamps: ruleOn(payerRulesObj?.requires_timestamps),
        miles: ruleOn(payerRulesObj?.requires_miles),
        necessity: ruleOn(payerRulesObj?.requires_necessity_note),
        auth: ruleOn(payerRulesObj?.requires_auth),
      };

      const isEmergency = (t.pcr_type ?? "").toLowerCase() === "emergency";
      const isUnscheduled = !!t.is_unscheduled;
      const tripTypeLower = String(t.trip_type ?? t.pcr_type ?? "").toLowerCase();
      const isDialysis = tripTypeLower === "dialysis" || tripTypeLower.includes("dialysis");

      // Patient-level PCS satisfies the check (and hides the biller panel) for any
      // run whose patient already has PCS on file and not expired. Most common on
      // dialysis but applies to any standing-PCS patient.
      const patientPcsValid = !!(p?.pcs_on_file && (!p?.pcs_expiration_date || new Date(p.pcs_expiration_date) >= new Date(t.run_date)));
      const pcsSkippable = isEmergency || isUnscheduled || !need.pcs || patientPcsValid;
      // Hide the biller PCS data-entry panel when PCS is already covered by the
      // patient record, when the payer doesn't require it, or for emergency/unscheduled runs.
      setPcsApplicable(need.pcs && !isEmergency && !isUnscheduled && !patientPcsValid);

      // Biller-entered PCS satisfies the PCS check (overrides patient-record PCS)
      const billerPcsComplete = !!(claim?.pcs_physician_name && claim?.pcs_physician_npi && claim?.pcs_certification_date && claim?.pcs_diagnosis);

      // Member ID — for one-off runs, falls back to claim.member_id (which carries from leg.oneoff_member_id) and leg.oneoff_member_id directly
      const effectiveMemberId = (p?.member_id && String(p.member_id).trim())
        || (claim?.member_id && String(claim.member_id).trim())
        || (t.leg?.oneoff_member_id && String(t.leg.oneoff_member_id).trim())
        || "";

      // ICD-10 — read from trip first, fall back to claim record. Dialysis runs
      // auto-apply N18.6 (ESRD) so the check passes without crew action even on
      // older trips that pre-date the auto-apply behavior.
      let effectiveIcd10: string[] = (Array.isArray(t.icd10_codes) && t.icd10_codes.length > 0)
        ? t.icd10_codes
        : (Array.isArray(claim?.icd10_codes) ? claim.icd10_codes : []);
      if (effectiveIcd10.length === 0 && isDialysis) {
        effectiveIcd10 = ["N18.6"];
      }

      // Medical necessity — booleans OR free-text reason from PCR
      const hasNecessity = !!(t.bed_confined || t.cannot_transfer_safely || t.requires_monitoring || t.oxygen_during_transport
        || (t.medical_necessity_reason && String(t.medical_necessity_reason).trim())
        || (t.necessity_notes && String(t.necessity_notes).trim()));

      const checks: ChecklistItem[] = [];

      // PCS — gated by payer rule
      if (need.pcs) {
        checks.push({
          label: "PCS on file and not expired",
          passed: pcsSkippable
            ? true
            : billerPcsComplete
              ? true
              : false,
          detail: isEmergency
            ? "Not required for emergency transport"
            : isUnscheduled
            ? "Same-day unscheduled — PCS not required at submission"
            : patientPcsValid
              ? (p?.pcs_expiration_date ? `On file — expires ${p.pcs_expiration_date}` : "On file, no expiration")
            : billerPcsComplete
              ? `Completed by biller — ${claim.pcs_physician_name}, NPI ${claim.pcs_physician_npi}`
              : "Not on file — use the PCS panel below to enter physician details, or upload a PCS form",
        });
      }

      // Medical necessity — gated by payer rule
      if (need.necessity) {
        checks.push({
          label: "At least one medical necessity criterion checked",
          passed: hasNecessity,
          detail: hasNecessity ? undefined : "Open the PCR Medical Necessity card and check at least one criterion",
        });
      }

      // Timestamps — gated by payer rule
      if (need.timestamps) {
        checks.push({
          label: "All required timestamps present",
          passed: !!(t.dispatch_time && t.at_scene_time && t.left_scene_time && t.arrived_dropoff_at && t.in_service_time),
          detail: [
            !t.dispatch_time && "Dispatch",
            !t.at_scene_time && "At Scene",
            !t.left_scene_time && "Left Scene",
            !t.arrived_dropoff_at && "At Destination",
            !t.in_service_time && "In Service",
          ].filter(Boolean).join(", ") || undefined,
        });
      }

      // Crew signature — gated by payer rule
      if (need.signature) {
        checks.push({
          label: "Crew signature present",
          passed: !!(t.signatures_json && Array.isArray(t.signatures_json) && t.signatures_json.length > 0),
        });
      }

      // Loaded miles + odometers — gated by payer rule
      if (need.miles) {
        checks.push({
          label: "Loaded miles recorded",
          passed: !!(t.loaded_miles && Number(t.loaded_miles) > 0),
          detail: t.loaded_miles ? `${t.loaded_miles} miles` : undefined,
        });
        checks.push({
          label: "Odometer readings present",
          passed: !!(t.odometer_at_scene != null && t.odometer_at_destination != null),
        });
      }

      // Authorization — gated by payer rule
      if (need.auth && p?.auth_required) {
        const hasAuth = !!(p?.prior_auth_number && (!p?.auth_expiration || new Date(p.auth_expiration) >= new Date(t.run_date)));
        checks.push({
          label: "Prior authorization on file and not expired",
          passed: hasAuth,
          detail: hasAuth ? undefined : "Patient requires authorization — add a valid prior auth number on the patient record",
        });
      }

      // HCPCS, modifiers, ICD-10, member ID — always required for any payable claim
      checks.push({
        label: "HCPCS codes assigned",
        passed: !!(claim?.hcpcs_codes && Array.isArray(claim.hcpcs_codes) && claim.hcpcs_codes.length > 0),
        detail: claim?.hcpcs_codes?.length ? claim.hcpcs_codes.join(", ") : undefined,
      });
      checks.push({
        label: "Origin and destination modifiers present",
        passed: !!(t.origin_type && t.destination_type),
        detail: t.origin_type && t.destination_type ? `${t.origin_type} → ${t.destination_type}` : undefined,
      });
      checks.push({
        label: "ICD-10 diagnosis codes present",
        passed: effectiveIcd10.length > 0,
        detail: effectiveIcd10.length > 0 ? effectiveIcd10.join(", ") : "Diagnosis codes required — open the PCR and add at least one ICD-10 code in the Assessment section",
      });
      checks.push({
        label: "Member ID present",
        passed: effectiveMemberId !== "",
        detail: effectiveMemberId !== "" ? effectiveMemberId : "Member ID is missing — update the patient record (or one-off run details) before submitting",
      });

      // Emergency billing decision check — only applies when claim has emergency event
      if (claim?.has_emergency_event) {
        checks.push({
          label: "Emergency billing decision required",
          passed: !!claim.emergency_billing_reviewed_at,
          detail: !claim.emergency_billing_reviewed_at
            ? "This claim involves an emergency event — open the claim detail to review and accept the billing recommendation before submitting"
            : undefined,
        });
      }

      // Timely filing deadline check
      if (t.run_date) {
        const filingMap: Record<string, number> = {};
        for (const pd of payerDir ?? []) {
          if (pd.payer_type) filingMap[pd.payer_type.toLowerCase()] = pd.timely_filing_days ?? 365;
        }
        const filingLimit = filingMap[claimPayerType] ?? 365;
        const dosDate = new Date(t.run_date);
        const deadlineDate = new Date(dosDate.getTime() + filingLimit * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.floor((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          checks.push({
            label: "Timely filing deadline may have passed",
            passed: false,
            isWarning: true,
            detail: `Filing deadline was ${Math.abs(daysRemaining)} days ago based on payer rules (${filingLimit}-day limit). Verify before submitting.`,
          });
        } else if (daysRemaining <= 60) {
          checks.push({
            label: "Timely filing deadline approaching",
            passed: true,
            isWarning: true,
            detail: `${daysRemaining} days remaining based on payer rules (${filingLimit}-day limit)`,
          });
        }
      }

      // Compute claim score (uses same payer rules object)
      setClaimScore(computeClaimScore(t, p, payerRulesObj as any));

      setItems(checks);
      setLoading(false);
    })();
  }, [open, tripId, patientId, activeCompanyId, refreshTick]);

  const allPassed = items.length > 0 && items.every(i => i.passed || i.isWarning);
  const failedCount = items.filter(i => !i.passed && !i.isWarning).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Move claim to submitted
      await supabase
        .from("claim_records" as any)
        .update({ status: "submitted", submitted_at: new Date().toISOString() } as any)
        .eq("trip_id", tripId);

      toast.success("Claim submitted successfully");
      onOpenChange(false);
      onSubmit?.();
    } catch {
      toast.error("Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Pre-Submit Checklist
          </DialogTitle>
          <DialogDescription>
            All items must pass before this claim can be submitted.
          </DialogDescription>
        </DialogHeader>

        {!loading && pcsApplicable && tripId && (
          <BillerPcsPanel
            tripId={tripId}
            patientId={patientId ?? null}
            onCompleted={() => setRefreshTick(t => t + 1)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Running checks…</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Claim Score */}
            {claimScore && (
              <div className={`rounded-md border p-3 space-y-2 ${getScoreBgClass(claimScore.score)}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${claimScore.color}`}>
                    Claim Score: {claimScore.score}% — {claimScore.label}
                  </span>
                </div>
                {claimScore.deductions.length > 0 && (
                  <div className="space-y-1">
                    {claimScore.deductions.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-destructive">−{d.points}</span> {d.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {items.map((item, i) => {
                const isWarn = item.isWarning && !item.passed;
                const isWarnPassed = item.isWarning && item.passed;
                const borderClass = isWarn
                  ? "border-amber-500/30 bg-amber-500/5"
                  : isWarnPassed
                    ? "border-amber-500/30 bg-amber-500/5"
                    : item.passed
                      ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5"
                      : "border-destructive/30 bg-destructive/5";
                return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 ${borderClass}`}
                >
                  {isWarn ? (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : isWarnPassed ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : item.passed ? (
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${isWarn ? "text-destructive" : isWarnPassed ? "text-amber-600" : item.passed ? "text-foreground" : "text-destructive"}`}>
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {!item.passed && !item.isWarning ? "Missing: " : ""}{item.detail}
                      </p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            {allPassed ? (
              <Button className="w-full gap-2" onClick={handleSubmit} disabled={submitting}>
                <CheckCircle className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit Claim"}
              </Button>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xs text-destructive font-medium">
                  {failedCount} item{failedCount > 1 ? "s" : ""} must be resolved before submitting
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
