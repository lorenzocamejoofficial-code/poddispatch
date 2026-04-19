import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BH_AUTHORIZATION_TYPES,
  BH_BEHAVIORAL_ASSESSMENT,
  BH_RESTRAINT_TYPES,
} from "@/lib/pcr-dropdowns";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { cn } from "@/lib/utils";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

export function BehavioralHealthCard({
  trip,
  updateField,
  requiredFields = ["bh_authorization_type", "bh_behavioral_assessment"],
}: Props) {
  const isReq = (f: string) => requiredFields.includes(f);
  const filled = (f: string) => {
    const v = trip[f];
    if (Array.isArray(v)) return v.length > 0;
    return !!v && String(v).trim() !== "";
  };
  const isInvoluntary =
    typeof trip.bh_authorization_type === "string" &&
    trip.bh_authorization_type.toLowerCase().includes("involuntary");

  const assessmentArr: string[] = Array.isArray(trip.bh_behavioral_assessment)
    ? trip.bh_behavioral_assessment
    : [];
  const toggleAssessment = (val: string) => {
    const next = assessmentArr.includes(val)
      ? assessmentArr.filter((v) => v !== val)
      : [...assessmentArr, val];
    updateField("bh_behavioral_assessment", next);
  };

  return (
    <div className="space-y-5 p-4">
      {/* Authorization */}
      <div>
        <Label className="text-sm font-medium flex items-center">
          Transport Authorization Type
          {isReq("bh_authorization_type") && (
            <PCRFieldDot filled={filled("bh_authorization_type")} />
          )}
        </Label>
        <Select
          value={trip.bh_authorization_type || ""}
          onValueChange={(v) => updateField("bh_authorization_type", v)}
        >
          <SelectTrigger
            className={cn(
              "mt-1.5 h-11",
              isReq("bh_authorization_type") &&
                (filled("bh_authorization_type")
                  ? "border-emerald-400"
                  : "border-destructive/50")
            )}
          >
            <SelectValue placeholder="Select authorization..." />
          </SelectTrigger>
          <SelectContent>
            {BH_AUTHORIZATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Involuntary section */}
      {isInvoluntary && (
        <div className="space-y-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Involuntary Hold Documentation
          </p>
          <div className="flex items-center justify-between">
            <Label className="text-sm">1013 / 2013 form received</Label>
            <Switch
              checked={!!trip.bh_1013_received}
              onCheckedChange={(v) => updateField("bh_1013_received", v)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Authorizing Facility</Label>
            <Input
              className="h-10 mt-1"
              defaultValue={trip.bh_authorizing_facility || ""}
              onBlur={(e) => updateField("bh_authorizing_facility", e.target.value || null)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Authorizing Physician Name</Label>
              <Input
                className="h-10 mt-1"
                defaultValue={trip.bh_authorizing_physician_name || ""}
                onBlur={(e) =>
                  updateField("bh_authorizing_physician_name", e.target.value || null)
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Physician NPI</Label>
              <Input
                className="h-10 mt-1"
                defaultValue={trip.bh_authorizing_physician_npi || ""}
                onBlur={(e) =>
                  updateField("bh_authorizing_physician_npi", e.target.value || null)
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">1013 Signed Date / Time</Label>
            <Input
              type="datetime-local"
              className="h-10 mt-1"
              defaultValue={
                trip.bh_form_signed_at
                  ? new Date(trip.bh_form_signed_at).toISOString().slice(0, 16)
                  : ""
              }
              onBlur={(e) =>
                updateField(
                  "bh_form_signed_at",
                  e.target.value ? new Date(e.target.value).toISOString() : null
                )
              }
            />
          </div>
        </div>
      )}

      {/* Law enforcement */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Law enforcement present</Label>
          <Switch
            checked={!!trip.bh_law_enforcement_present}
            onCheckedChange={(v) => updateField("bh_law_enforcement_present", v)}
          />
        </div>
        {trip.bh_law_enforcement_present && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Officer Name</Label>
              <Input
                className="h-10 mt-1"
                defaultValue={trip.bh_officer_name || ""}
                onBlur={(e) => updateField("bh_officer_name", e.target.value || null)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Badge #</Label>
              <Input
                className="h-10 mt-1"
                defaultValue={trip.bh_officer_badge || ""}
                onBlur={(e) => updateField("bh_officer_badge", e.target.value || null)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agency</Label>
              <Input
                className="h-10 mt-1"
                defaultValue={trip.bh_officer_agency || ""}
                onBlur={(e) => updateField("bh_officer_agency", e.target.value || null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Behavioral assessment */}
      <div>
        <Label className="text-sm font-medium flex items-center">
          Behavioral Assessment at Time of Contact
          {isReq("bh_behavioral_assessment") && (
            <PCRFieldDot filled={assessmentArr.length > 0} />
          )}
        </Label>
        <div
          className={cn(
            "mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3",
            isReq("bh_behavioral_assessment") &&
              (assessmentArr.length > 0 ? "border-emerald-400" : "border-destructive/50")
          )}
        >
          {BH_BEHAVIORAL_ASSESSMENT.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={assessmentArr.includes(opt)}
                onCheckedChange={() => toggleAssessment(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Restraints */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Restraints required</Label>
          <Switch
            checked={!!trip.restraints_applied}
            onCheckedChange={(v) => updateField("restraints_applied", v)}
          />
        </div>
        {trip.restraints_applied && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Restraint Type</Label>
              <Select
                value={trip.bh_restraint_type || ""}
                onValueChange={(v) => updateField("bh_restraint_type", v)}
              >
                <SelectTrigger className="h-10 mt-1">
                  <SelectValue placeholder="Select restraint type..." />
                </SelectTrigger>
                <SelectContent>
                  {BH_RESTRAINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason for Restraint</Label>
              <Textarea
                rows={2}
                defaultValue={trip.bh_restraint_reason || ""}
                onBlur={(e) => updateField("bh_restraint_reason", e.target.value || null)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time Restraints Applied</Label>
              <Input
                type="datetime-local"
                className="h-10 mt-1"
                defaultValue={
                  trip.bh_restraint_applied_at
                    ? new Date(trip.bh_restraint_applied_at).toISOString().slice(0, 16)
                    : ""
                }
                onBlur={(e) =>
                  updateField(
                    "bh_restraint_applied_at",
                    e.target.value ? new Date(e.target.value).toISOString() : null
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Neurovascular checks documented</Label>
              <Switch
                checked={!!trip.bh_neurovascular_checks_documented}
                onCheckedChange={(v) =>
                  updateField("bh_neurovascular_checks_documented", v)
                }
              />
            </div>
            {trip.bh_neurovascular_checks_documented && (
              <div>
                <Label className="text-xs text-muted-foreground">Check Times</Label>
                <Input
                  className="h-10 mt-1"
                  placeholder="e.g., 14:05, 14:25, 14:45"
                  defaultValue={trip.bh_neurovascular_check_times || ""}
                  onBlur={(e) =>
                    updateField("bh_neurovascular_check_times", e.target.value || null)
                  }
                />
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Patient Response to Restraints</Label>
              <Textarea
                rows={2}
                defaultValue={trip.bh_patient_response_to_restraints || ""}
                onBlur={(e) =>
                  updateField("bh_patient_response_to_restraints", e.target.value || null)
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Medications */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Last Known Psychiatric Medications</Label>
          <Textarea
            className="mt-1"
            rows={2}
            defaultValue={trip.bh_psych_medications || ""}
            onBlur={(e) => updateField("bh_psych_medications", e.target.value || null)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Recent medication changes (past 7 days)</Label>
          <Switch
            checked={!!trip.bh_recent_medication_changes}
            onCheckedChange={(v) => updateField("bh_recent_medication_changes", v)}
          />
        </div>
        {trip.bh_recent_medication_changes && (
          <Textarea
            rows={2}
            placeholder="Describe recent medication changes..."
            defaultValue={trip.bh_recent_medication_changes_detail || ""}
            onBlur={(e) =>
              updateField("bh_recent_medication_changes_detail", e.target.value || null)
            }
          />
        )}
      </div>

      {/* Receiving */}
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Receiving Psychiatric Facility
        </p>
        <div>
          <Label className="text-xs text-muted-foreground">Facility Name</Label>
          <Input
            className="h-10 mt-1"
            defaultValue={trip.bh_receiving_facility || ""}
            onBlur={(e) => updateField("bh_receiving_facility", e.target.value || null)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Receiving Clinician</Label>
            <Input
              className="h-10 mt-1"
              defaultValue={trip.bh_receiving_clinician || ""}
              onBlur={(e) => updateField("bh_receiving_clinician", e.target.value || null)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Report Given To</Label>
            <Input
              className="h-10 mt-1"
              defaultValue={trip.bh_report_given_to || ""}
              onBlur={(e) => updateField("bh_report_given_to", e.target.value || null)}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Time of Report</Label>
          <Input
            type="datetime-local"
            className="h-10 mt-1"
            defaultValue={
              trip.bh_report_time
                ? new Date(trip.bh_report_time).toISOString().slice(0, 16)
                : ""
            }
            onBlur={(e) =>
              updateField(
                "bh_report_time",
                e.target.value ? new Date(e.target.value).toISOString() : null
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
