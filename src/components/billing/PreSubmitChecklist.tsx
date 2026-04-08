import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChecklistItem {
  label: string;
  passed: boolean;
  detail?: string;
}

interface PreSubmitChecklistProps {
  tripId: string;
  patientId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: () => void;
}

export function PreSubmitChecklist({ tripId, patientId, open, onOpenChange, onSubmit }: PreSubmitChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    (async () => {
      const [{ data: trip }, { data: patient }, { data: claimRow }] = await Promise.all([
        supabase
          .from("trip_records" as any)
          .select("*")
          .eq("id", tripId)
          .maybeSingle(),
        patientId
          ? supabase.from("patients").select("*").eq("id", patientId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("claim_records" as any)
          .select("has_emergency_event, emergency_billing_reviewed_at, hcpcs_codes")
          .eq("trip_id", tripId)
          .maybeSingle(),
      ]);

      if (!trip) {
        setItems([]);
        setLoading(false);
        return;
      }

      const t = trip as any;
      const p = patient as any;
      const claim = claimRow as any;

      const checks: ChecklistItem[] = [
        {
          label: "PCS on file and not expired",
          passed: !!(p?.pcs_on_file && (!p?.pcs_expiration_date || new Date(p.pcs_expiration_date) >= new Date(t.run_date))),
          detail: p?.pcs_on_file
            ? (p?.pcs_expiration_date ? `Expires ${p.pcs_expiration_date}` : "On file, no expiration")
            : "Not on file",
        },
        {
          label: "At least one medical necessity criterion checked",
          passed: !!(t.bed_confined || t.cannot_transfer_safely || t.requires_monitoring || t.oxygen_during_transport),
        },
        {
          label: "All required timestamps present",
          passed: !!(t.dispatch_time && t.at_scene_time && t.left_scene_time && t.arrived_dropoff_at && t.in_service_time),
          detail: [
            !t.dispatch_time && "Dispatch",
            !t.at_scene_time && "At Scene",
            !t.left_scene_time && "Left Scene",
            !t.arrived_dropoff_at && "At Destination",
            !t.in_service_time && "In Service",
          ].filter(Boolean).join(", ") || undefined,
        },
        {
          label: "Crew signature present",
          passed: !!(t.signatures_json && Array.isArray(t.signatures_json) && t.signatures_json.length > 0),
        },
        {
          label: "Loaded miles recorded",
          passed: !!(t.loaded_miles && Number(t.loaded_miles) > 0),
          detail: t.loaded_miles ? `${t.loaded_miles} miles` : undefined,
        },
        {
          label: "Odometer readings present",
          passed: !!(t.odometer_at_scene != null && t.odometer_at_destination != null),
        },
        {
          label: "HCPCS codes assigned",
          passed: !!(claim?.hcpcs_codes && Array.isArray(claim.hcpcs_codes) && claim.hcpcs_codes.length > 0),
          detail: claim?.hcpcs_codes?.length ? claim.hcpcs_codes.join(", ") : undefined,
        },
        {
          label: "Origin and destination modifiers present",
          passed: !!(t.origin_type && t.destination_type),
          detail: t.origin_type && t.destination_type ? `${t.origin_type} → ${t.destination_type}` : undefined,
        },
        {
          label: "ICD-10 diagnosis codes present",
          passed: !!(t.icd10_codes && Array.isArray(t.icd10_codes) && t.icd10_codes.length > 0),
          detail: t.icd10_codes?.length ? t.icd10_codes.join(", ") : "Diagnosis codes required — open the PCR and add at least one ICD-10 code in the Assessment section",
        },
        {
          label: "Member ID present",
          passed: !!(p?.member_id && String(p.member_id).trim() !== ""),
          detail: !p?.member_id ? "Patient member ID is missing — update the patient record before submitting" : undefined,
        },
      ];

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

      setItems(checks);
      setLoading(false);
    })();
  }, [open, tripId, patientId]);

  const allPassed = items.length > 0 && items.every(i => i.passed);
  const failedCount = items.filter(i => !i.passed).length;

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Pre-Submit Checklist
          </DialogTitle>
          <DialogDescription>
            All items must pass before this claim can be submitted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Running checks…</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 ${
                    item.passed
                      ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${item.passed ? "text-foreground" : "text-destructive"}`}>
                      {item.label}
                    </p>
                    {item.detail && !item.passed && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Missing: {item.detail}
                      </p>
                    )}
                    {item.detail && item.passed && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                    )}
                  </div>
                </div>
              ))}
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
