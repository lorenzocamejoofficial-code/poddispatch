import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PatientInfoCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function PatientInfoCard({ trip, updateField }: PatientInfoCardProps) {
  const patient = trip.patient;
  if (!patient) return <p className="text-sm text-muted-foreground">No patient data linked to this trip.</p>;

  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const fields = [
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
  ];

  const flags: string[] = [];
  if (patient.oxygen_required) flags.push("Oxygen Required");
  if (patient.bariatric) flags.push("Bariatric");
  if (patient.stair_chair_required) flags.push("Stair Chair");
  if (patient.standing_order) flags.push("Standing Order");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</p>
            <p className="text-sm font-medium text-foreground">{f.value}</p>
          </div>
        ))}
      </div>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {flags.map((f) => (
            <Badge key={f} variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
              {f}
            </Badge>
          ))}
        </div>
      )}

      {patient.notes && (
        <div className="pt-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
          <p className="text-sm text-foreground">{patient.notes}</p>
        </div>
      )}
    </div>
  );
}
