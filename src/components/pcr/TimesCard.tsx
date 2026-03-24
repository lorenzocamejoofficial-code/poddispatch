import { Button } from "@/components/ui/button";
import { Clock, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

interface TimesCardProps {
  trip: any;
  recordTime: (field: string, status?: string) => Promise<void>;
  updateField: (field: string, value: any) => Promise<void>;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

const TOOLTIP_MAP: Record<string, string> = {
  dispatch_time: "dispatch_time",
  at_scene_time: "at_scene_time",
  patient_contact_time: "patient_contact_time",
  left_scene_time: "left_scene_time",
  arrived_dropoff_at: "arrived_destination_time",
  in_service_time: "in_service_time",
};

export function TimesCard({ trip, recordTime, updateField }: TimesCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [odometerWarning, setOdometerWarning] = useState<string | null>(null);
  const [manualMilesOverride, setManualMilesOverride] = useState(false);

  const buttons = [
    { field: "dispatch_time", label: "Dispatched", status: undefined },
    { field: "dispatch_time", label: "En Route", status: "en_route", displayField: "dispatch_time", tooltipKey: "enroute_time" },
    { field: "at_scene_time", label: "At Scene", status: "arrived_pickup" },
    { field: "patient_contact_time", label: "Patient Contact", status: undefined },
    { field: "left_scene_time", label: "Left Scene", status: "loaded" },
    { field: "arrived_dropoff_at", label: "At Destination", status: "arrived_dropoff" },
    { field: "in_service_time", label: "In Service", status: "completed" },
  ];

  const autoCalculateLoadedMiles = (sceneVal: number | null, destVal: number | null) => {
    if (sceneVal && destVal && sceneVal > 0 && destVal > 0) {
      const miles = destVal - sceneVal;
      if (miles > 0) {
        setOdometerWarning(null);
        updateField("loaded_miles", parseFloat(miles.toFixed(1)));
      } else {
        setOdometerWarning("Check odometer values — destination reading is less than scene reading.");
      }
    }
  };

  const handleOdometerBlur = (field: string, rawValue: string) => {
    const val = rawValue ? parseFloat(rawValue) : null;
    updateField(field, val);

    const sceneVal = field === "odometer_at_scene" ? val : (trip.odometer_at_scene ?? null);
    const destVal = field === "odometer_at_destination" ? val : (trip.odometer_at_destination ?? null);
    autoCalculateLoadedMiles(sceneVal, destVal);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {buttons.map((btn, idx) => {
          const value = trip[btn.field];
          const recorded = !!value;
          const isEditing = editingField === `${btn.field}-${idx}`;
          const ttKey = (btn as any).tooltipKey || TOOLTIP_MAP[btn.field];
          const tooltipText = ttKey ? PCR_TOOLTIPS[ttKey] : undefined;

          return (
            <div key={`${btn.field}-${idx}`} className="flex items-center gap-3">
              <Button
                variant={recorded ? "outline" : "default"}
                className={`flex-1 h-14 text-base justify-start gap-3 ${recorded ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : ""}`}
                onClick={() => {
                  if (!recorded) recordTime(btn.field, btn.status);
                }}
                disabled={recorded}
              >
                {recorded ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                <span className="flex-1 text-left flex items-center">
                  {btn.label}
                  {tooltipText && <PCRTooltip text={tooltipText} />}
                </span>
                {recorded && <span className="text-sm font-mono">{fmtTime(value)}</span>}
              </Button>
              {recorded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setEditingField(isEditing ? null : `${btn.field}-${idx}`)}
                >
                  Edit
                </Button>
              )}
              {isEditing && (
                <Input
                  type="time"
                  className="w-28 h-10"
                  defaultValue={value ? new Date(value).toTimeString().slice(0, 5) : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      const today = new Date();
                      const [h, m] = e.target.value.split(":");
                      today.setHours(parseInt(h), parseInt(m), 0, 0);
                      updateField(btn.field, today.toISOString());
                    }
                  }}
                  onBlur={() => setEditingField(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mileage & Vehicle Section */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Mileage & Vehicle</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block flex items-center">
              Vehicle / Unit # <PCRTooltip text={PCR_TOOLTIPS.vehicle_id} />
            </label>
            <Input
              defaultValue={trip.vehicle_id || ""}
              placeholder="Unit #"
              className="h-11"
              onBlur={(e) => updateField("vehicle_id", e.target.value || null)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block flex items-center">
              Odometer at Scene <PCRTooltip text={PCR_TOOLTIPS.odometer_at_scene} />
            </label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_at_scene ?? ""}
              placeholder="0.0"
              className="h-11"
              onBlur={(e) => handleOdometerBlur("odometer_at_scene", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block flex items-center">
              Odometer at Destination <PCRTooltip text={PCR_TOOLTIPS.odometer_at_destination} />
            </label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_at_destination ?? ""}
              placeholder="0.0"
              className="h-11"
              onBlur={(e) => handleOdometerBlur("odometer_at_destination", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block flex items-center">
              Odometer at In Service <PCRTooltip text={PCR_TOOLTIPS.odometer_in_service} />
            </label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_in_service ?? ""}
              placeholder="0.0"
              className="h-11"
              onBlur={(e) => updateField("odometer_in_service", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>

        {/* Odometer warning */}
        {odometerWarning && (
          <p className="text-xs text-destructive mt-2">{odometerWarning}</p>
        )}

        {/* Loaded Miles (calculated) */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center">
              Loaded Miles (calculated)
            </label>
            {!manualMilesOverride && (
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2"
                onClick={() => setManualMilesOverride(true)}
              >
                Override
              </button>
            )}
          </div>
          {manualMilesOverride ? (
            <div className="mt-1">
              <Input
                type="number"
                step="0.1"
                defaultValue={trip.loaded_miles ?? ""}
                placeholder="Enter miles"
                className="h-11 w-40"
                onBlur={(e) => {
                  updateField("loaded_miles", e.target.value ? parseFloat(e.target.value) : null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1 italic">Manually entered</p>
            </div>
          ) : (
            <p className="text-sm font-mono text-foreground mt-1">
              {trip.loaded_miles != null ? `${trip.loaded_miles} mi` : "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
