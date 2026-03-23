import { Button } from "@/components/ui/button";
import { Clock, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface TimesCardProps {
  trip: any;
  recordTime: (field: string, status?: string) => Promise<void>;
  updateField: (field: string, value: any) => Promise<void>;
}

const TIME_BUTTONS = [
  { field: "dispatch_time", label: "Dispatched", status: undefined, auto: true },
  { field: "dispatch_time", label: "En Route", status: "en_route", auto: false },
  { field: "at_scene_time", label: "At Scene", status: "arrived_pickup", auto: false },
  { field: "patient_contact_time", label: "Patient Contact", status: undefined, auto: false },
  { field: "left_scene_time", label: "Left Scene", status: "loaded", auto: false },
  { field: "arrived_dropoff_at", label: "At Destination", status: "arrived_dropoff", auto: false },
  { field: "in_service_time", label: "In Service", status: "completed", auto: false },
];

function fmtTime(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

export function TimesCard({ trip, recordTime, updateField }: TimesCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const buttons = [
    { field: "dispatch_time", label: "Dispatched", status: undefined },
    { field: "dispatch_time", label: "En Route", status: "en_route", displayField: "dispatch_time" },
    { field: "at_scene_time", label: "At Scene", status: "arrived_pickup" },
    { field: "patient_contact_time", label: "Patient Contact", status: undefined },
    { field: "left_scene_time", label: "Left Scene", status: "loaded" },
    { field: "arrived_dropoff_at", label: "At Destination", status: "arrived_dropoff" },
    { field: "in_service_time", label: "In Service", status: "completed" },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {buttons.map((btn, idx) => {
          const value = trip[btn.field];
          const recorded = !!value;
          const isEditing = editingField === `${btn.field}-${idx}`;

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
                <span className="flex-1 text-left">{btn.label}</span>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vehicle / Unit #</label>
            <Input
              defaultValue={trip.vehicle_id || ""}
              placeholder="Unit #"
              onBlur={(e) => updateField("vehicle_id", e.target.value || null)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Odometer at Scene</label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_at_scene ?? ""}
              placeholder="0.0"
              onBlur={(e) => updateField("odometer_at_scene", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Odometer at Destination</label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_at_destination ?? ""}
              placeholder="0.0"
              onBlur={(e) => updateField("odometer_at_destination", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Odometer at In Service</label>
            <Input
              type="number"
              step="0.1"
              defaultValue={trip.odometer_in_service ?? ""}
              placeholder="0.0"
              onBlur={(e) => updateField("odometer_in_service", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
