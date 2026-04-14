import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { getDenialTranslation, type DenialTranslation } from "@/lib/denial-code-translations";
import { logAuditEvent } from "@/lib/audit-logger";

/* ---------- denial-specific checklists ---------- */
interface ChecklistItem {
  id: string;
  label: string;
}

function getChecklistForDenial(code: string, translation: DenialTranslation | null): ChecklistItem[] {
  switch (code) {
    case "CO-16":
      return [
        { id: "icd10", label: "Verify ICD-10 codes are present on the trip record" },
        { id: "member_id", label: "Verify member ID matches the insurance card" },
        { id: "timestamps", label: "Verify all required timestamps are present (dispatch, scene, left scene, arrived, in service)" },
        { id: "origin_dest", label: "Verify origin and destination types are set" },
        { id: "med_necessity", label: "Verify medical necessity is documented" },
      ];
    case "CO-4":
      return [
        { id: "transport_type", label: "Verify the transport type matches what was billed" },
        { id: "hcpcs", label: "Verify the HCPCS code is correct for the transport" },
        { id: "pos", label: "Verify the place of service code is 41 for ambulance" },
      ];
    case "CO-5":
      return [
        { id: "origin_code", label: "Verify origin modifier matches the pickup location type" },
        { id: "dest_code", label: "Verify destination modifier matches the dropoff location type" },
        { id: "pos", label: "Verify the place of service code is 41 for ambulance" },
      ];
    case "CO-97":
      return [
        { id: "dup_check", label: "Check whether this claim was already paid under a different claim number" },
        { id: "verify_dup", label: "Verify the claim is not a duplicate" },
      ];
    case "CO-29":
      return [
        { id: "orig_submit", label: "Verify the original submission date" },
        { id: "exception", label: "Check whether a timely filing exception applies (COB delay, eligibility issue)" },
        { id: "doc_exception", label: "Document the exception reason" },
      ];
    case "PR-1":
      return [
        { id: "deductible", label: "Verify deductible amount with payer" },
        { id: "secondary", label: "Check whether patient has secondary insurance that covers deductible" },
        { id: "gen_secondary", label: "Generate secondary claim if applicable" },
      ];
    case "PR-2":
      return [
        { id: "coinsurance", label: "Verify coinsurance percentage with payer" },
        { id: "secondary", label: "Check whether patient has secondary insurance" },
        { id: "bill_patient", label: "Generate patient responsibility statement if no secondary" },
      ];
    case "PR-3":
      return [
        { id: "copay", label: "Verify copayment amount with payer" },
        { id: "secondary", label: "Check whether patient has secondary insurance" },
        { id: "bill_patient", label: "Generate patient responsibility statement if no secondary" },
      ];
    case "CO-15":
    case "CO-197":
      return [
        { id: "auth_number", label: "Obtain a valid prior authorization number" },
        { id: "verify_auth", label: "Verify authorization covers the date of service" },
        { id: "attach_auth", label: "Add authorization number to the claim record" },
      ];
    case "CO-11":
      return [
        { id: "icd10_review", label: "Review ICD-10 codes against the transport type" },
        { id: "hcpcs_match", label: "Verify HCPCS code matches the diagnosis" },
        { id: "update_codes", label: "Update codes if incorrect" },
      ];
    case "CO-50":
      return [
        { id: "med_nec", label: "Review medical necessity documentation" },
        { id: "add_docs", label: "Add supporting clinical documentation" },
        { id: "appeal_prep", label: "Prepare appeal letter with medical justification" },
      ];
    default: {
      // Generate generic steps from translation
      const items: ChecklistItem[] = [];
      if (translation?.action_required) {
        items.push({ id: "action", label: translation.action_required });
      }
      if (translation?.typical_resolution === "fix_and_resubmit") {
        items.push({ id: "review_data", label: "Review all claim data for accuracy" });
        items.push({ id: "fix_issue", label: "Correct the identified issue" });
      } else if (translation?.typical_resolution === "appeal") {
        items.push({ id: "gather_docs", label: "Gather supporting documentation for appeal" });
        items.push({ id: "submit_appeal", label: "Submit appeal within required timeframe" });
      } else if (translation?.typical_resolution === "bill_patient") {
        items.push({ id: "check_secondary", label: "Check for secondary insurance coverage" });
        items.push({ id: "patient_stmt", label: "Generate patient responsibility statement" });
      } else if (translation?.typical_resolution === "bill_secondary") {
        items.push({ id: "bill_sec", label: "Submit claim to secondary payer" });
      } else {
        items.push({ id: "review", label: "Review the denial reason and determine next steps" });
      }
      return items;
    }
  }
}

/* ---------- editable field configs per denial ---------- */
const FIELDS_FOR_DENIAL: Record<string, string[]> = {
  "CO-16": ["icd10_codes", "member_id", "dispatch_time", "at_scene_time", "left_scene_time", "arrived_dropoff_at", "in_service_time"],
  "CO-4": ["hcpcs_codes", "service_level"],
  "CO-5": ["origin_type", "destination_type"],
  "CO-11": ["icd10_codes", "hcpcs_codes"],
  "CO-55": ["hcpcs_codes"],
  "CO-56": ["origin_type", "destination_type"],
};

/* ---------- timely filing ---------- */
function getTimelyFilingDeadline(runDate: string, filingDays: number = 365): Date {
  const d = new Date(runDate + "T00:00:00");
  d.setDate(d.getDate() + filingDays);
  return d;
}

function getDeadlineBadgeColor(daysRemaining: number): string {
  if (daysRemaining > 60) return "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30";
  if (daysRemaining > 30) return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

/* ---------- component ---------- */

export interface DenialRecoveryClaimInput {
  id: string;
  trip_id: string;
  patient_name: string;
  denial_code: string | null;
  denial_reason: string | null;
  run_date: string;
  total_charge: number | null;
  payer_name: string | null;
  payer_type: string | null;
  member_id: string | null;
  resubmission_count: number | null;
  resubmitted_at: string | null;
  submitted_at: string | null;
  company_id: string | null;
}

interface DenialRecoveryEngineProps {
  claim: DenialRecoveryClaimInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const LOCATION_TYPES = ["residence", "dialysis_facility", "hospital", "snf", "assisted_living", "doctors_office", "other"];

export function DenialRecoveryEngine({ claim, open, onOpenChange, onComplete }: DenialRecoveryEngineProps) {
  const { user, activeCompanyId } = useAuth();
  const translation = claim.denial_code ? getDenialTranslation(claim.denial_code) : null;
  const checklist = useMemo(() => getChecklistForDenial(claim.denial_code ?? "", translation), [claim.denial_code, translation]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [tripData, setTripData] = useState<Record<string, any> | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [resubHistory, setResubHistory] = useState<any[]>([]);

  // Timely filing
  const deadline = getTimelyFilingDeadline(claim.run_date);
  const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Load trip data for editable fields
  useEffect(() => {
    if (!open || !claim.trip_id) return;
    supabase
      .from("trip_records" as any)
      .select("*")
      .eq("id", claim.trip_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTripData(data as any);
          const fields: Record<string, string> = {};
          const editableFields = FIELDS_FOR_DENIAL[claim.denial_code ?? ""] ?? [];
          for (const f of editableFields) {
            const val = (data as any)[f];
            fields[f] = Array.isArray(val) ? val.join(", ") : (val?.toString() ?? "");
          }
          setEditFields(fields);
        }
      });
  }, [open, claim.trip_id, claim.denial_code]);

  // Load resubmission history
  useEffect(() => {
    if (!open) return;
    supabase
      .from("ar_followup_notes")
      .select("id, note_text, created_by_name, created_at")
      .eq("claim_id", claim.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setResubHistory((data ?? []).filter((n: any) => n.note_text?.startsWith("[RESUBMIT]")));
      });
  }, [open, claim.id]);

  // Reset state when claim changes
  useEffect(() => {
    if (open) {
      setChecked({});
      setCorrectionNotes("");
    }
  }, [open, claim.id]);

  const allChecked = checklist.length > 0 && checklist.every(c => checked[c.id]);

  const getProfileName = async () => {
    if (!user) return "Unknown";
    const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    return data?.full_name ?? user.email ?? "Unknown";
  };

  const saveFieldCorrections = async () => {
    if (!tripData || !claim.trip_id) return;
    const editableFields = FIELDS_FOR_DENIAL[claim.denial_code ?? ""] ?? [];
    if (editableFields.length === 0) return;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    const changes: Record<string, { old: any; new: any }> = {};

    for (const f of editableFields) {
      const oldVal = (tripData as any)[f];
      let newVal: any = editFields[f] ?? "";

      if (f.endsWith("_codes")) {
        newVal = newVal.split(",").map((s: string) => s.trim()).filter(Boolean);
      } else if (newVal === "") {
        newVal = null;
      }

      const oldStr = Array.isArray(oldVal) ? oldVal.join(", ") : (oldVal?.toString() ?? "");
      const newStr = Array.isArray(newVal) ? newVal.join(", ") : (newVal?.toString() ?? "");

      if (oldStr !== newStr) {
        changes[f] = { old: oldVal, new: newVal };
        updates[f] = newVal;
      }
    }

    if (Object.keys(changes).length > 0) {
      await supabase.from("trip_records" as any).update(updates).eq("id", claim.trip_id);

      // Log to billing_overrides like BillerPCROverridePanel
      await supabase.from("billing_overrides").insert({
        trip_id: claim.trip_id,
        override_reason: `Denial recovery correction: ${correctionNotes || "Field update for resubmission"}`,
        overridden_by: user?.id,
        user_id: user?.id,
        reason: correctionNotes || "Denial recovery field correction",
        snapshot: { changes },
        previous_blockers_snapshot: { denial_code: claim.denial_code, changes },
      });

      await logAuditEvent({
        action: "edit",
        tableName: "trip_records",
        recordId: claim.trip_id,
        oldData: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
        newData: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
        notes: `Denial recovery correction for ${claim.denial_code}: ${correctionNotes}`,
      });
    }

    return Object.keys(changes).length;
  };

  const handleSaveProgress = async () => {
    setSaving(true);
    const name = await getProfileName();
    const checkedItems = checklist.filter(c => checked[c.id]).map(c => c.label);
    const noteText = `[PROGRESS] Denial recovery for ${claim.denial_code}. Checklist completed: ${checkedItems.length}/${checklist.length}. ${correctionNotes ? `Notes: ${correctionNotes}` : ""}`;

    await supabase.from("ar_followup_notes").insert({
      claim_id: claim.id,
      company_id: activeCompanyId,
      note_text: noteText,
      created_by: user?.id,
      created_by_name: name,
    });

    toast.success("Progress saved");
    setSaving(false);
  };

  const handleMarkReady = async () => {
    if (!allChecked) {
      toast.error("Complete all checklist items before resubmitting");
      return;
    }
    if (!correctionNotes.trim()) {
      toast.error("Correction notes are required before resubmission");
      return;
    }

    setSaving(true);

    // Save field corrections
    const changesCount = await saveFieldCorrections();

    // Update claim status
    await supabase.from("claim_records").update({
      status: "needs_correction",
      resubmission_count: (claim.resubmission_count ?? 0) + 1,
      resubmitted_at: new Date().toISOString(),
    } as any).eq("id", claim.id);

    // Log resubmission note
    const name = await getProfileName();
    const noteText = `[RESUBMIT] Denial ${claim.denial_code} — ${correctionNotes}${changesCount ? ` — ${changesCount} field(s) corrected` : ""}`;
    await supabase.from("ar_followup_notes").insert({
      claim_id: claim.id,
      company_id: activeCompanyId,
      note_text: noteText,
      created_by: user?.id,
      created_by_name: name,
    });

    // Auto-complete denial_unworked biller_tasks for this claim
    await supabase
      .from("biller_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
        dismiss_reason: "Auto-completed when claim was marked for resubmission.",
      } as any)
      .eq("claim_id", claim.id)
      .eq("task_type", "denial_unworked")
      .in("status", ["pending", "in_progress"]);

    await logAuditEvent({
      action: "edit",
      tableName: "claim_records",
      recordId: claim.id,
      oldData: { status: "denied", resubmission_count: claim.resubmission_count },
      newData: { status: "needs_correction", resubmission_count: (claim.resubmission_count ?? 0) + 1 },
      notes: `Denial recovery resubmission: ${correctionNotes}`,
    });

    toast.success("Claim marked ready for resubmission");
    setSaving(false);
    onOpenChange(false);
    onComplete();
  };

  const editableFields = FIELDS_FOR_DENIAL[claim.denial_code ?? ""] ?? [];
  const FIELD_LABELS: Record<string, string> = {
    icd10_codes: "ICD-10 Codes",
    hcpcs_codes: "HCPCS Codes",
    member_id: "Member ID",
    service_level: "Service Level",
    origin_type: "Origin Type",
    destination_type: "Destination Type",
    dispatch_time: "Dispatch Time",
    at_scene_time: "At Scene Time",
    left_scene_time: "Left Scene Time",
    arrived_dropoff_at: "Arrived at Destination",
    in_service_time: "In Service Time",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Denial Recovery Engine
          </DialogTitle>
          <DialogDescription>
            Guided recovery workflow for denied claim
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Claim header */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{claim.patient_name}</p>
              <Badge variant="outline" className={getDeadlineBadgeColor(daysRemaining)}>
                <Clock className="h-3 w-3 mr-1" />
                {daysRemaining} days to filing deadline
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>DOS: {claim.run_date}</span>
              <span>Payer: {claim.payer_name ?? "—"}</span>
              <span>Billed: ${(claim.total_charge ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Denial info */}
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-1.5">
            <p className="text-sm font-medium text-destructive">
              {claim.denial_code ?? "Unknown Denial"}
            </p>
            <p className="text-sm">
              {translation?.plain_english_explanation ?? claim.denial_reason ?? "No details available"}
            </p>
            {translation?.action_required && (
              <p className="text-xs text-muted-foreground">{translation.action_required}</p>
            )}
          </div>

          <Separator />

          {/* Recovery Checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recovery Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map(item => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={!!checked[item.id]}
                    onCheckedChange={v => setChecked(prev => ({ ...prev, [item.id]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className={`text-sm ${checked[item.id] ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.values(checked).filter(Boolean).length}/{checklist.length} completed
            </p>
          </div>

          {/* Editable claim fields */}
          {editableFields.length > 0 && tripData && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Claim Field Corrections</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editableFields.map(field => (
                    <div key={field}>
                      <Label className="text-xs">{FIELD_LABELS[field] ?? field}</Label>
                      {(field === "origin_type" || field === "destination_type") ? (
                        <Select
                          value={editFields[field] ?? ""}
                          onValueChange={v => setEditFields(prev => ({ ...prev, [field]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATION_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="capitalize text-xs">
                                {t.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={editFields[field] ?? ""}
                          onChange={e => setEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Correction Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Correction Notes (required for resubmission)</Label>
            <Textarea
              value={correctionNotes}
              onChange={e => setCorrectionNotes(e.target.value)}
              placeholder="Document what was changed and why..."
              className="min-h-[80px]"
            />
          </div>

          {/* Resubmission History */}
          {resubHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Resubmission History</h3>
                <div className="space-y-1.5">
                  {claim.submitted_at && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      Original submission: {new Date(claim.submitted_at).toLocaleDateString()}
                    </div>
                  )}
                  {resubHistory.map((n: any, i: number) => (
                    <div key={n.id} className="flex items-start gap-2 text-xs">
                      <div className="h-2 w-2 rounded-full bg-[hsl(var(--status-yellow))] mt-1.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground">
                          Resubmission #{i + 1} — {new Date(n.created_at).toLocaleDateString()}
                        </span>
                        <p className="text-foreground">{n.note_text.replace("[RESUBMIT] ", "")}</p>
                        <p className="text-muted-foreground">{n.created_by_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={handleSaveProgress}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Progress
            </Button>
            <Button
              className="flex-1"
              disabled={saving || !allChecked || !correctionNotes.trim()}
              onClick={handleMarkReady}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Mark Ready to Resubmit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Timely Filing Badge (reusable) ---------- */
export function TimelyFilingBadge({ runDate, payerType, companyId }: { runDate: string; payerType?: string | null; companyId?: string | null }) {
  const [filingDays, setFilingDays] = useState(365);
  const [payerLabel, setPayerLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!payerType || !companyId) return;
    supabase
      .from("payer_directory")
      .select("payer_name, timely_filing_days")
      .eq("company_id", companyId)
      .eq("payer_type", payerType.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFilingDays(data.timely_filing_days ?? 365);
          setPayerLabel(data.payer_name);
        }
      });
  }, [payerType, companyId]);

  const deadline = getTimelyFilingDeadline(runDate, filingDays);
  const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const tooltipText = payerLabel ? `${payerLabel}: ${filingDays} days from DOS` : `Default: ${filingDays} days from DOS`;

  return (
    <Badge variant="outline" className={`text-[10px] ${getDeadlineBadgeColor(daysRemaining)}`} title={tooltipText}>
      <Clock className="h-3 w-3 mr-1" />
      {daysRemaining}d to file
    </Badge>
  );
}

/* ---------- Resubmission History panel (reusable) ---------- */
export function ResubmissionHistory({ claimId, submittedAt }: { claimId: string; submittedAt: string | null }) {
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("ar_followup_notes")
      .select("id, note_text, created_by_name, created_at")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setNotes((data ?? []).filter((n: any) => n.note_text?.startsWith("[RESUBMIT]")));
      });
  }, [claimId]);

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">Resubmission History</h4>
      <div className="space-y-1.5">
        {submittedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            Original: {new Date(submittedAt).toLocaleDateString()}
          </div>
        )}
        {notes.map((n: any, i: number) => (
          <div key={n.id} className="flex items-start gap-2 text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-yellow))] mt-1.5 shrink-0" />
            <span className="text-muted-foreground">
              #{i + 1} {new Date(n.created_at).toLocaleDateString()} — {n.note_text.replace("[RESUBMIT] ", "").slice(0, 80)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
