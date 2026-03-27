import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

const CHIEF_COMPLAINT_DEFAULTS: Record<string, string> = {
  dialysis: "End-stage renal disease requiring dialysis transport",
  ift: "Interfacility transfer — see Sending Facility card",
  discharge: "Patient discharge transport",
  outpatient_specialty: "Outpatient specialty appointment transport",
  private_pay: "Private pay transport",
  emergency: "Emergency transport — see Assessment card",
};

const TRANSPORT_LABELS: Record<string, string> = {
  dialysis: "Dialysis",
  ift: "IFT",
  discharge: "Discharge",
  outpatient_specialty: "Outpatient",
  outpatient: "Outpatient",
  private_pay: "Private Pay",
  emergency: "Emergency",
};

interface PatientInfoCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function PatientInfoCard({ trip, updateField }: PatientInfoCardProps) {
  const patient = trip.patient;
  const transportType = trip.trip_type || trip.pcr_type || "dialysis";
  const transportLabel = TRANSPORT_LABELS[transportType] || transportType;

  const chiefComplaint = trip.chief_complaint || CHIEF_COMPLAINT_DEFAULTS[transportType] || "";
  const [ccDraft, setCcDraft] = useState(chiefComplaint);

  const handleCcBlur = () => {
    if (ccDraft !== (trip.chief_complaint || "")) {
      updateField("chief_complaint", ccDraft || null);
    }
  };

  // Auth status logic
  const authExpired = patient?.auth_expiration
    ? new Date(patient.auth_expiration) < new Date()
    : false;

  const age = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const fields = patient
    ? [
        { label: "Full Name", value: `${patient.first_name} ${patient.last_name}` },
        { label: "DOB", value: patient.dob || "—" },
        { label: "Age", value: age ? `${age}` : "—" },
        { label: "Sex", value: patient.sex === "M" ? "Male" : patient.sex === "F" ? "Female" : patient.sex === "U" ? "Unknown" : patient.sex || "—" },
        { label: "Weight", value: patient.weight_lbs ? `${patient.weight_lbs} lbs` : "—" },
        { label: "Home Address", value: patient.pickup_address || "—" },
        { label: "Primary Insurance", value: patient.primary_payer || "—" },
        { label: "Member ID", value: patient.member_id || "—" },
        { label: "Secondary Insurance", value: patient.secondary_payer || "None" },
        { label: "Mobility", value: patient.mobility || "—" },
        { label: "Secondary Member ID", value: patient.secondary_member_id || "—" },
      ]
    : [];

  const flags: string[] = [];
  if (patient?.oxygen_required) flags.push("Oxygen Required");
  if (patient?.bariatric) flags.push("Bariatric");
  if (patient?.stair_chair_required) flags.push("Stair Chair");

  return (
    <div className="space-y-3">
      {/* Transport Type */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Transport Type</p>
        <Badge variant="secondary" className="mt-0.5 text-xs">{transportLabel}</Badge>
      </div>

      {/* Editable Chief Complaint */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Chief Complaint
          <PCRTooltip text={PCR_TOOLTIPS.chief_complaint_patient} />
        </p>
        <Input
          value={ccDraft}
          onChange={(e) => setCcDraft(e.target.value)}
          onBlur={handleCcBlur}
          className="h-9 mt-0.5 text-sm"
          placeholder="Reason for transport…"
        />
      </div>

      {/* Demographic fields (read-only) */}
      {!patient ? (
        <p className="text-sm text-muted-foreground">No patient data linked to this trip.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.label}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</p>
                <p className="text-sm font-medium text-foreground">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {flags.map((f) => (
              <Badge key={f} variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                {f}
              </Badge>
            ))}

            {patient.auth_required && !authExpired && (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                Auth Required
                <PCRTooltip text={PCR_TOOLTIPS.auth_status} />
              </Badge>
            )}
            {patient.auth_required && authExpired && (
              <Badge variant="destructive" className="text-xs">
                Auth Expired
                <PCRTooltip text={PCR_TOOLTIPS.auth_status} />
              </Badge>
            )}
            {patient.standing_order && (
              <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                Standing Order on File
              </Badge>
            )}
          </div>

          {patient.notes && (
            <div className="pt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
              <p className="text-sm text-foreground">{patient.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
