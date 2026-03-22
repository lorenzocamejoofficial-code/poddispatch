import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DISPOSITIONS } from "@/lib/pcr-dropdowns";

interface Props { trip: any; updateField: (f: string, v: any) => Promise<void>; }

export function SendingFacilityCard({ trip, updateField }: Props) {
  const sf = trip.sending_facility_json || {};
  const update = (k: string, v: any) => updateField("sending_facility_json", { ...sf, [k]: v });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Sending Facility Name</label>
        <Input value={sf.facility_name || ""} onChange={(e) => update("facility_name", e.target.value)} className="h-10" />
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
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Diagnosis / Reason for Transfer</label>
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
    </div>
  );
}

export function HospitalOutcomeCard({ trip, updateField }: Props) {
  const ho = trip.hospital_outcome_json || {};
  const update = (k: string, v: any) => updateField("hospital_outcome_json", { ...ho, [k]: v });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Time Admitted to ER</label>
        <Input type="time" value={ho.time_admitted || ""} onChange={(e) => update("time_admitted", e.target.value)} className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Chief Complaint at Arrival</label>
        <Input value={ho.chief_complaint || ""} onChange={(e) => update("chief_complaint", e.target.value)} className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">ICD-10 Diagnosis Codes</label>
        <Input value={ho.icd10_codes || ""} onChange={(e) => update("icd10_codes", e.target.value)} placeholder="E.g., I10, N18.6" className="h-10" />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Disposition</label>
        <Select value={trip.disposition || ""} onValueChange={(v) => updateField("disposition", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
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
