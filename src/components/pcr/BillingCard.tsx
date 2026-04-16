import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { deriveServiceLevel, deriveHcpcsBaseCode } from "@/lib/transport-context";
import { HCPCS_CODE_DESCRIPTIONS } from "@/lib/billing-utils";

interface Props { trip: any; updateField?: (field: string, value: any) => Promise<void>; readOnly?: boolean; }

export function BillingCard({ trip, updateField, readOnly = false }: Props) {
  const patient = trip.patient;
  const autoCalcRef = useRef(false);

  // Auto-calculate loaded miles from odometer readings
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

  // Derive service level and HCPCS from the run record — single source of truth
  const isEmergency = (trip.pcr_type || trip.trip_type || "").toLowerCase() === "emergency";
  const serviceLevel = deriveServiceLevel(trip.trip_type || trip.pcr_type, trip.service_level);
  const hcpcs = deriveHcpcsBaseCode(serviceLevel, isEmergency);
  const serviceLevelLabel = isEmergency ? `${serviceLevel} Emergency` : serviceLevel;

  const odomScene = trip.odometer_at_scene;
  const odomDest = trip.odometer_at_destination;
  const autoMiles = (odomScene != null && odomDest != null && odomDest > odomScene) ? odomDest - odomScene : null;
  const displayMiles = autoMiles ?? trip.loaded_miles;

  return (
    <div className="space-y-3">
      {readOnly && <p className="text-xs text-muted-foreground italic">Read-only for crew. Biller can edit.</p>}

      {/* Crew-editable odometer fields */}
      {!readOnly && updateField && (
        <div className="space-y-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Odometer Readings</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center">
                At Scene
                <PCRFieldDot filled={odomScene != null} />
              </label>
              <Input
                type="number"
                placeholder="e.g. 45230"
                value={odomScene ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  updateField("odometer_at_scene", val);
                }}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center">
                At Destination
                <PCRFieldDot filled={odomDest != null} />
              </label>
              <Input
                type="number"
                placeholder="e.g. 45242"
                value={odomDest ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  updateField("odometer_at_destination", val);
                }}
                className="h-10"
              />
            </div>
          </div>
          {autoMiles != null && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                Loaded Miles: <span className="text-primary font-bold">{autoMiles}</span>
              </p>
              <p className="text-[9px] text-muted-foreground">Auto-calculated from odometer readings ({odomDest} − {odomScene})</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">HCPCS Code</p>
          <p className="text-sm font-bold text-foreground">{hcpcs}</p>
          <p className="text-[9px] text-muted-foreground">{HCPCS_CODE_DESCRIPTIONS[hcpcs] ?? ""}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Service Level</p>
          <p className="text-sm font-medium text-foreground">{serviceLevelLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Mileage Code</p>
          <p className="text-sm font-medium text-foreground">A0425</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Loaded Miles</p>
          <p className="text-sm font-medium text-foreground">{displayMiles ?? "—"}</p>
          {autoMiles != null && (
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
        {trip.is_unscheduled && (
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">Same-Day / Unscheduled</Badge>
        )}
      </div>
    </div>
  );
}
