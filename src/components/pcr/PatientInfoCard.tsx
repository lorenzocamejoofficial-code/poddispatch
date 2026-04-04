import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PayerFieldIndicator } from "@/components/pcr/PayerFieldIndicator";

const TRANSPORT_LABELS: Record<string, string> = {
  dialysis: "Dialysis",
  ift: "IFT",
  discharge: "Discharge",
  outpatient_specialty: "Outpatient",
  outpatient: "Outpatient",
  private_pay: "Private Pay",
  emergency: "Emergency",
};

const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "U", label: "Unknown" },
];

interface PatientInfoCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function PatientInfoCard({ trip, updateField: _updateField }: PatientInfoCardProps) {
  const patient = trip.patient;
  const transportType = trip.trip_type || trip.pcr_type || "dialysis";
  const transportLabel = TRANSPORT_LABELS[transportType] || transportType;
  const primaryPayer = patient?.primary_payer || null;

  // Auth status logic
  const authExpired = patient?.auth_expiration
    ? new Date(patient.auth_expiration) < new Date()
    : false;

  // Pre-fill from patient or show empty for manual entry
  const prefill = (field: string) => patient?.[field] ?? "";

  const age = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

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

      {/* Demographics — always visible, pre-filled if patient linked */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            First Name <PayerFieldIndicator payer={primaryPayer} allPayers />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.first_name || "—"}</p>
          ) : (
            <Input defaultValue="" placeholder="First name" className="h-9 mt-0.5 text-sm" readOnly={false} />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            Last Name <PayerFieldIndicator payer={primaryPayer} allPayers />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.last_name || "—"}</p>
          ) : (
            <Input defaultValue="" placeholder="Last name" className="h-9 mt-0.5 text-sm" readOnly={false} />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            DOB <PayerFieldIndicator payer={primaryPayer} allPayers />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.dob || "—"}</p>
          ) : (
            <Input type="date" defaultValue="" className="h-9 mt-0.5 text-sm" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Age</p>
          <p className="text-sm font-medium text-foreground">{age != null ? `${age}` : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            Sex <PayerFieldIndicator payer={primaryPayer} allPayers />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">
              {patient.sex === "M" ? "Male" : patient.sex === "F" ? "Female" : patient.sex === "U" ? "Unknown" : patient.sex || "—"}
            </p>
          ) : (
            <Select defaultValue="">
              <SelectTrigger className="h-9 mt-0.5 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Weight</p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.weight_lbs ? `${patient.weight_lbs} lbs` : "—"}</p>
          ) : (
            <Input type="number" defaultValue="" placeholder="lbs" className="h-9 mt-0.5 text-sm" />
          )}
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Home Address</p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.pickup_address || "—"}</p>
          ) : (
            <Input defaultValue="" placeholder="Address" className="h-9 mt-0.5 text-sm" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            Primary Insurance <PayerFieldIndicator payer={primaryPayer} medicare medicaid />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.primary_payer || "—"}</p>
          ) : (
            <Input defaultValue="" placeholder="Payer" className="h-9 mt-0.5 text-sm" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
            Member ID <PayerFieldIndicator payer={primaryPayer} medicare medicaid />
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.member_id || "—"}</p>
          ) : (
            <Input defaultValue="" placeholder="Member ID" className="h-9 mt-0.5 text-sm" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Secondary Insurance</p>
          <p className="text-sm font-medium text-foreground">{prefill("secondary_payer") || "None"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Mobility</p>
          <p className="text-sm font-medium text-foreground">{prefill("mobility") || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Secondary Member ID</p>
          <p className="text-sm font-medium text-foreground">{prefill("secondary_member_id") || "—"}</p>
        </div>
      </div>

      {/* Status badges */}
      {(flags.length > 0 || patient?.auth_required || patient?.standing_order) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {flags.map((f) => (
            <Badge key={f} variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
              {f}
            </Badge>
          ))}
          {patient?.auth_required && !authExpired && (
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
              Auth Required
              <PCRTooltip text={PCR_TOOLTIPS.auth_status} />
            </Badge>
          )}
          {patient?.auth_required && authExpired && (
            <Badge variant="destructive" className="text-xs">
              Auth Expired
              <PCRTooltip text={PCR_TOOLTIPS.auth_status} />
            </Badge>
          )}
          {patient?.standing_order && (
            <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
              Standing Order on File
            </Badge>
          )}
        </div>
      )}

      {patient?.notes && (
        <div className="pt-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
          <p className="text-sm text-foreground">{patient.notes}</p>
        </div>
      )}

      {!patient && (
        <p className="text-xs text-muted-foreground italic pt-1">
          No patient record linked — fields above can be documented manually.
        </p>
      )}
    </div>
  );
}
