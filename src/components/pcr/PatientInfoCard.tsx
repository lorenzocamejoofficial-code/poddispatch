import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PayerFieldIndicator } from "@/components/pcr/PayerFieldIndicator";
import { UnidentifiedPatientEmergencyCard } from "@/components/pcr/UnidentifiedPatientEmergencyCard";

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
  refetch?: () => Promise<void> | void;
}

export function PatientInfoCard({ trip, updateField: _updateField, refetch }: PatientInfoCardProps) {
  const patient = trip.patient;
  const transportType = trip.trip_type || trip.pcr_type || "dialysis";
  const transportLabel = TRANSPORT_LABELS[transportType] || transportType;
  const primaryPayer = patient?.primary_payer || null;

  // Emergency + no patient on file → full NEMSIS-aligned capture form
  if (!patient && transportType === "emergency") {
    return <UnidentifiedPatientEmergencyCard trip={trip} updateField={_updateField} refetch={refetch} />;
  }

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
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Weight (lbs)</p>
          <Input
            type="number"
            value={trip.weight_lbs ?? patient?.weight_lbs ?? ""}
            placeholder="lbs"
            className="h-9 mt-0.5 text-sm"
            onChange={(e) => _updateField("weight_lbs", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Race</p>
          <p className="text-sm font-medium text-foreground">{prefill("race") || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ethnicity</p>
          <p className="text-sm font-medium text-foreground">{prefill("ethnicity") || "—"}</p>
        </div>
        <div className="col-span-2" data-focus="origin_zip">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {patient ? "Home Address" : "Pickup Address (One-off)"}
          </p>
          {patient ? (
            <p className="text-sm font-medium text-foreground">{patient.pickup_address || "—"}</p>
          ) : (
            <Input
              value={trip.pickup_location ?? ""}
              onChange={(e) => _updateField("pickup_location", e.target.value)}
              placeholder="Street, City, ST ZIP"
              className="h-9 mt-0.5 text-sm"
            />
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

      {patient?.pertinent_history && (() => {
        const ph: any = patient.pertinent_history;
        if (ph.na) {
          return (
            <div className="pt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pertinent History</p>
              <p className="text-sm text-muted-foreground italic">N/A — none pertinent on file</p>
            </div>
          );
        }
        const items: string[] = Array.isArray(ph.items) ? ph.items : [];
        const other: string = ph.other || "";
        if (items.length === 0 && !other.trim()) return null;
        return (
          <div className="pt-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pertinent History</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {items.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px] border-amber-400 text-amber-800 dark:text-amber-300">
                  {k.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
            {other.trim() && <p className="text-sm text-foreground mt-1">{other}</p>}
          </div>
        );
      })()}

      {!patient && (
        <p className="text-xs text-muted-foreground italic pt-1">
          No patient record linked — fields above can be documented manually.
        </p>
      )}
    </div>
  );
}
