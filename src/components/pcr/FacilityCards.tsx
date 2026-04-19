import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DISPOSITIONS, DISCHARGE_DESTINATION_TYPES } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { ICD10Picker } from "@/components/pcr/ICD10Picker";
import { cn } from "@/lib/utils";

interface Props { trip: any; updateField: (f: string, v: any) => Promise<void>; tripType?: string; requiredFields?: string[]; }

export function SendingFacilityCard({ trip, updateField, tripType, requiredFields = ["facility_name", "pcs_attached"] }: Props) {
  const sf = trip.sending_facility_json || {};
  const update = (k: string, v: any) => updateField("sending_facility_json", { ...sf, [k]: v });
  const isDischarge = tripType === "discharge";

  const isReq = (f: string) => requiredFields.includes(f);
  const facilityFilled = !!sf.facility_name && sf.facility_name.trim() !== "";
  const pcsFilled = !!trip.pcs_attached;

  return (
    <div className="space-y-3">
      {/* PCS toggle — all transport types */}
      <div className={cn(
        "flex items-center justify-between rounded-md border p-3",
        isReq("pcs_attached") ? (pcsFilled ? "border-emerald-400" : "border-destructive/50") : "border-border"
      )}>
        <div className="space-y-0.5">
          <Label className="text-sm font-medium flex items-center">
            PCS Obtained
            <PCRTooltip text={PCR_TOOLTIPS.pcs_obtained} />
            {isReq("pcs_attached") && <PCRFieldDot filled={pcsFilled} />}
          </Label>
          <p className="text-[10px] text-muted-foreground">Physician Certification Statement obtained at sending facility</p>
        </div>
        <Switch
          checked={!!trip.pcs_attached}
          onCheckedChange={(v) => updateField("pcs_attached", v)}
        />
      </div>
      {!trip.pcs_attached && (
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠ PCS required for claim submission</p>
      )}

      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1 flex items-center">
          Sending Facility Name
          {isReq("facility_name") && <PCRFieldDot filled={facilityFilled} />}
        </label>
        <Input value={sf.facility_name || ""} onChange={(e) => update("facility_name", e.target.value)}
          className={cn("h-10", isReq("facility_name") ? (facilityFilled ? "border-emerald-400" : "border-destructive/50") : "")} />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Sending Physician Name</label>
        <Input value={sf.physician_name || ""} onChange={(e) => update("physician_name", e.target.value)} className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Physician NPI</label>
        <Input value={sf.physician_npi || ""} onChange={(e) => update("physician_npi", e.target.value)} className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">
          {isDischarge ? "Discharge Reason" : "Diagnosis / Reason for Transfer"}
        </label>
        <Textarea value={sf.diagnosis || ""} onChange={(e) => update("diagnosis", e.target.value)} rows={2} />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Receiving Facility</label>
        <Input value={sf.receiving_facility || ""} onChange={(e) => update("receiving_facility", e.target.value)} className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Transfer of Care Notes</label>
        <Textarea value={sf.transfer_notes || ""} onChange={(e) => update("transfer_notes", e.target.value)} rows={2} />
      </div>

      {/* Discharge-specific fields */}
      {isDischarge && (
        <>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Discharge Instructions Received
                <PCRTooltip text={PCR_TOOLTIPS.discharge_instructions} />
              </Label>
            </div>
            <Switch
              checked={!!trip.discharge_instructions_received}
              onCheckedChange={(v) => updateField("discharge_instructions_received", v)}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Destination Type</label>
            <Select value={trip.destination_type || ""} onValueChange={(v) => updateField("destination_type", v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {DISCHARGE_DESTINATION_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

export function HospitalOutcomeCard({ trip, updateField, updateMultipleFields, requiredFields = ["disposition"] }: Props & { updateMultipleFields?: (fields: Record<string, any>) => Promise<void> }) {
  const ho = trip.hospital_outcome_json || {};
  const update = (k: string, v: any) => updateField("hospital_outcome_json", { ...ho, [k]: v });

  // Fix 6: disposition is canonically the top-level `disposition` column on
  // trip_records. We mirror it into hospital_outcome_json.disposition for
  // display continuity, but checklist + field-requirements read only top-level.
  const updateDisposition = (v: string) => {
    if (updateMultipleFields) {
      updateMultipleFields({
        disposition: v,
        hospital_outcome_json: { ...ho, disposition: v },
      });
    } else {
      // Fall back to two writes if the parent didn't pass updateMultipleFields.
      updateField("disposition", v);
      updateField("hospital_outcome_json", { ...ho, disposition: v });
    }
  };

  const isReq = (f: string) => (requiredFields || []).includes(f);
  const dispositionFilled = !!trip.disposition && trip.disposition.trim() !== "";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Time Admitted to ER</label>
        <div className="flex gap-2">
          <Input type="time" value={ho.time_admitted || ""} onChange={(e) => update("time_admitted", e.target.value)} className="h-10 flex-1" />
          {ho.time_admitted && (
            <button
              type="button"
              onClick={() => update("time_admitted", "")}
              className="h-10 px-3 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Chief Complaint at Arrival</label>
        <Input value={ho.chief_complaint || ""} onChange={(e) => update("chief_complaint", e.target.value)} className="h-10" />
      </div>
      <div>
        <ICD10Picker
          selectedCodes={Array.isArray(ho.icd10_codes) ? ho.icd10_codes : (ho.icd10_codes ? String(ho.icd10_codes).split(",").map((c: string) => c.trim()).filter(Boolean) : [])}
          onCodesChange={(codes) => update("icd10_codes", codes)}
          maxCodes={4}
          chiefComplaint={ho.chief_complaint}
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1 flex items-center">
          Disposition
          {isReq("disposition") && <PCRFieldDot filled={dispositionFilled} />}
        </label>
        <Select value={trip.disposition || ""} onValueChange={updateDisposition}>
          <SelectTrigger className={cn("h-12 text-base", isReq("disposition") ? (dispositionFilled ? "border-emerald-400" : "border-destructive/50") : "")}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {DISPOSITIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Days in ICU (if applicable)</label>
        <Input type="number" inputMode="numeric" value={ho.icu_days || ""} onChange={(e) => update("icu_days", e.target.value)} className="h-10" />
      </div>
    </div>
  );
}
