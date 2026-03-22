import { Badge } from "@/components/ui/badge";

interface Props { trip: any; }

export function BillingCard({ trip }: Props) {
  const patient = trip.patient;
  const eq = trip.equipment_used_json || {};

  // Auto-derive HCPCS
  let hcpcs = "A0428"; // BLS default
  let serviceLevel = "BLS";
  const transportType = (trip.trip_type || "").toLowerCase();
  if (transportType.includes("emergency")) {
    hcpcs = "A0427";
    serviceLevel = "ALS1 Emergency";
  } else if (transportType.includes("ift") || transportType.includes("als")) {
    hcpcs = "A0426";
    serviceLevel = "ALS1";
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground italic">Read-only for crew. Biller can edit.</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">HCPCS Code</p>
          <p className="text-sm font-bold text-foreground">{hcpcs}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Service Level</p>
          <p className="text-sm font-medium text-foreground">{serviceLevel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Mileage Code</p>
          <p className="text-sm font-medium text-foreground">A0425</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Loaded Miles</p>
          <p className="text-sm font-medium text-foreground">{trip.loaded_miles ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Primary Payer</p>
          <p className="text-sm font-medium text-foreground">{patient?.primary_payer || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Secondary Payer</p>
          <p className="text-sm font-medium text-foreground">{patient?.secondary_payer || "None"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {patient?.auth_required && (
          <Badge variant="outline" className="text-xs">PCS Required</Badge>
        )}
        {patient?.standing_order && (
          <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">Standing Order</Badge>
        )}
      </div>
    </div>
  );
}
