import { Button } from "@/components/ui/button";
import { Clock, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Deduplicated unique fields in chronological order

// Deduplicated for validation (unique fields in order)
const UNIQUE_TIME_FIELDS = [
  "dispatch_time",
  "at_scene_time",
  "patient_contact_time",
  "left_scene_time",
  "arrived_dropoff_at",
  "in_service_time",
];

/** Returns set of field names that are out of chronological order */
export function getTimeSequenceWarnings(trip: any): Set<string> {
  const warnings = new Set<string>();
  for (let i = 1; i < UNIQUE_TIME_FIELDS.length; i++) {
    const prevField = UNIQUE_TIME_FIELDS[i - 1];
    const currField = UNIQUE_TIME_FIELDS[i];
    const prevVal = trip?.[prevField];
    const currVal = trip?.[currField];
    if (!prevVal || !currVal) continue;
    const prevTime = new Date(prevVal).getTime();
    const currTime = new Date(currVal).getTime();
    if (currTime < prevTime) {
      warnings.add(currField);
    }
  }
  return warnings;
}

interface TimesCardProps {
  trip: any;
  recordTime: (field: string, status?: string) => Promise<void>;
  updateField: (field: string, value: any) => Promise<void>;
  updateMultipleFields?: (fields: Record<string, any>) => Promise<void>;
  isReadOnly?: boolean;
}

function hasSavedVitals(trip: any): boolean {
  const vitals = trip.vitals_json;
  if (!Array.isArray(vitals) || vitals.length === 0) return false;
  return vitals.some((v: any) => !!v.timestamp && v.saved !== false);
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

const LOCATION_TYPE_OPTIONS = [
  "Residence",
  "SNF",
  "Assisted Living",
  "Hospital",
  "Dialysis Facility",
  "Outpatient Specialty",
  "Other",
];

// Billing-mirror fields: when crew taps these time fields, also write the billing-gate equivalents
const BILLING_MIRROR: Record<string, string> = {
  left_scene_time: "loaded_at",
  arrived_dropoff_at: "dropped_at",
};

export function TimesCard({ trip, recordTime, updateField, updateMultipleFields, isReadOnly = false }: TimesCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [odometerWarning, setOdometerWarning] = useState<string | null>(null);
  const [manualMilesOverride, setManualMilesOverride] = useState(false);

  const sequenceWarnings = getTimeSequenceWarnings(trip);
  const handleClearTimes = async () => {
    const fields = [
      "dispatch_time", "at_scene_time", "patient_contact_time",
      "left_scene_time", "arrived_dropoff_at", "in_service_time",
      "loaded_at", "dropped_at",
    ];
    for (const f of fields) {
      await updateField(f, null);
    }
    await updateField("status", "scheduled");
    await updateField("pcr_status", "not_started");
    toast({ title: "Times cleared" });
  };

  const buttons = [
    { field: "dispatch_time", label: "Dispatched", status: undefined },
    { field: "dispatch_time", label: "En Route", status: "en_route", displayField: "dispatch_time", tooltipKey: "enroute_time" },
    { field: "at_scene_time", label: "At Scene", status: "arrived_pickup" },
    { field: "patient_contact_time", label: "Patient Contact", status: undefined },
    { field: "left_scene_time", label: "Left Scene", status: "loaded" },
    { field: "arrived_dropoff_at", label: "At Destination", status: "arrived_dropoff" },
    { field: "in_service_time", label: "In Service", status: "completed" },
  ];

  const handleTimeTap = async (field: string, status?: string) => {
    // Gate At Destination behind saved vitals
    if (field === "arrived_dropoff_at" && !hasSavedVitals(trip)) {
      toast({
        title: "Vitals required",
        description: "At least one complete vitals set must be saved before marking At Destination.",
        variant: "destructive",
      });
      return;
    }
    await recordTime(field, status);
    // Write billing-mirror field with the same timestamp
    const mirrorField = BILLING_MIRROR[field];
    if (mirrorField) {
      const now = new Date().toISOString();
      await updateField(mirrorField, now);
    }
  };

  const autoCalculateLoadedMiles = (sceneVal: number | null, destVal: number | null) => {
    if (sceneVal !== null && sceneVal !== undefined && destVal !== null && destVal !== undefined && destVal > sceneVal) {
      const miles = destVal - sceneVal;
      setOdometerWarning(null);
      updateField("loaded_miles", parseFloat(miles.toFixed(1)));
    } else if (sceneVal !== null && destVal !== null && destVal <= sceneVal) {
      setOdometerWarning("Check odometer values — destination reading is less than or equal to scene reading.");
    }
  };

  const handleOdometerBlur = async (field: string, rawValue: string) => {
    const val = rawValue !== "" && rawValue !== null && rawValue !== undefined 
      ? parseFloat(rawValue) 
      : null;
    await updateField(field, val);

    const sceneVal = field === "odometer_at_scene" ? val : (trip.odometer_at_scene ?? null);
    const destVal = field === "odometer_at_destination" ? val : (trip.odometer_at_destination ?? null);
    autoCalculateLoadedMiles(sceneVal, destVal);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Times</h4>
          {!isReadOnly && (
            <ConfirmActionDialog
              trigger={
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1">
                  <RotateCcw className="h-3 w-3" />
                  Clear Times
                </Button>
              }
              title="Clear all times?"
              description="Clear all recorded times? This cannot be undone."
              confirmWord="CONFIRM"
              onConfirm={handleClearTimes}
              destructive
            />
          )}
        </div>
        {buttons.map((btn, idx) => {
          const value = trip[btn.field];
          const recorded = !!value;
          const isEditing = editingField === `${btn.field}-${idx}`;
          const ttKey = (btn as any).tooltipKey || TOOLTIP_MAP[btn.field];
          const tooltipText = ttKey ? PCR_TOOLTIPS[ttKey] : undefined;
          const hasSequenceWarning = recorded && sequenceWarnings.has(btn.field);

          return (
            <div key={`${btn.field}-${idx}`} className="space-y-1">
              <div className="flex items-center gap-3">
                <Button
                  variant={recorded ? "outline" : "default"}
                  className={cn(
                    "flex-1 h-14 text-base justify-start gap-3",
                    recorded && !hasSequenceWarning && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
                    hasSequenceWarning && "border-destructive/60 bg-destructive/5 text-destructive dark:border-destructive/40 dark:bg-destructive/10 dark:text-destructive"
                  )}
                  onClick={() => {
                    if (!recorded) handleTimeTap(btn.field, btn.status);
                  }}
                  disabled={recorded}
                >
                  {recorded ? (
                    hasSequenceWarning ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
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
                        const todayDate = new Date();
                        const [h, m] = e.target.value.split(":");
                        todayDate.setHours(parseInt(h), parseInt(m), 0, 0);
                        const iso = todayDate.toISOString();
                        updateField(btn.field, iso);
                        // Also update billing mirror on manual edit
                        const mirrorField = BILLING_MIRROR[btn.field];
                        if (mirrorField) updateField(mirrorField, iso);
                      }
                    }}
                    onBlur={() => setEditingField(null)}
                  />
                )}
              </div>
              {hasSequenceWarning && (
                <p className="text-[11px] text-destructive/80 ml-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  This time is out of sequence — check the recorded time.
                </p>
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

      {/* Origin & Destination Type */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Location Types</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Origin Type</label>
            <Select
              value={trip.origin_type || ""}
              onValueChange={(v) => updateField("origin_type", v)}
            >
              <SelectTrigger className="h-11"><SelectValue placeholder="Select origin type" /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Destination Type</label>
            <Select
              value={trip.destination_type || ""}
              onValueChange={(v) => updateField("destination_type", v)}
            >
              <SelectTrigger className="h-11"><SelectValue placeholder="Select destination type" /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
