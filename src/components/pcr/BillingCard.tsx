import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

interface Props { trip: any; updateField?: (field: string, value: any) => Promise<void>; }

export function BillingCard({ trip, updateField }: Props) {
  const patient = trip.patient;
  const autoCalcRef = useRef(false);

  // Fix 11: Auto-calculate loaded miles from odometer readings
  useEffect(() => {
    if (autoCalcRef.current) return;
    const scene = trip.odometer_at_scene;
    const dest = trip.odometer_at_destination;
    if (scene != null && dest != null && dest > scene && updateField) {
      const calculated = dest - scene;
      if (trip.loaded_miles == null || trip.loaded_miles === 0) {
        updateField("loaded_miles", calculated);
        autoCalcRef.current = true;
      }
    }
  }, [trip.odometer_at_scene, trip.odometer_at_destination, trip.loaded_miles, updateField]);

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

  const odomScene = trip.odometer_at_scene;
  const odomDest = trip.odometer_at_destination;
  const autoMiles = (odomScene != null && odomDest != null && odomDest > odomScene) ? odomDest - odomScene : null;
  const isAutoCalc = autoMiles != null && trip.loaded_miles === autoMiles;

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
          {isAutoCalc && (
            <p className="text-[9px] text-muted-foreground">Auto-calculated from odometer readings</p>
          )}
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
