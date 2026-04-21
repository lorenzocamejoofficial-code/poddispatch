import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

const PROCEDURES = [
  "None performed",
  "Spinal motion restriction",
  "Cervical collar applied",
  "Extremity splinting",
  "Wound care and hemorrhage control",
  "Tourniquet applied",
  "Chest seal applied",
  "Needle decompression",
  "CPR in progress",
  "AED applied",
  "Patient restraints applied",
  "Glucose check performed",
  "12-lead ECG performed",
  "Pulse oximetry continuous monitoring",
  "Capnography monitoring",
];

const SMR_DEVICES = ["Long spine board", "Scoop stretcher", "Vacuum mattress"];
const ECG_FINDINGS = [
  "Normal sinus rhythm",
  "ST elevation",
  "ST depression",
  "Left bundle branch block",
  "Atrial fibrillation",
  "Other",
];
const CPR_STARTED_BY = ["Bystander", "First responder", "EMS crew"];
const RESPONSES = ["Improved", "Unchanged", "Deteriorated", "Unable to assess"];

export function ProceduresCard({ trip, updateField }: Props) {
  const data = trip.procedures_json || {};
  const performed: string[] = Array.isArray(data.performed) ? data.performed : [];

  const update = (key: string, value: any) => {
    updateField("procedures_json", { ...data, [key]: value });
  };

  const toggle = (label: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...performed, label]))
      : performed.filter((p) => p !== label);
    update("performed", next);
  };

  const has = (label: string) => performed.includes(label);

  return (
    <div className="space-y-5 p-4">
      <div>
        <label className="text-sm font-medium block mb-2">Procedures performed</label>
        <div className="space-y-2">
          {PROCEDURES.map((label) => (
            <label key={label} className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox checked={performed.includes(label)} onCheckedChange={(c) => toggle(label, !!c)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {has("Spinal motion restriction") && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-1">SMR device used</label>
          <Select value={data.smr_device || ""} onValueChange={(v) => update("smr_device", v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {SMR_DEVICES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {has("Extremity splinting") && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-1">Splint location</label>
          <Input
            value={data.splint_location || ""}
            onChange={(e) => update("splint_location", e.target.value)}
            placeholder="e.g. Right forearm"
            className="h-11"
          />
        </div>
      )}

      {has("Tourniquet applied") && (
        <div className="ml-7 border-l-2 border-muted pl-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Time applied</label>
            <Input
              type="time"
              value={data.tourniquet_time || ""}
              onChange={(e) => update("tourniquet_time", e.target.value)}
              className="h-11"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Location</label>
            <Input
              value={data.tourniquet_location || ""}
              onChange={(e) => update("tourniquet_location", e.target.value)}
              placeholder="e.g. Left thigh, proximal"
              className="h-11"
            />
          </div>
        </div>
      )}

      {has("12-lead ECG performed") && (
        <div className="ml-7 border-l-2 border-muted pl-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">ECG findings</label>
            <Select value={data.ecg_findings || ""} onValueChange={(v) => update("ecg_findings", v)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {ECG_FINDINGS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {data.ecg_findings === "Other" && (
            <div>
              <label className="text-sm font-medium block mb-1">Other findings</label>
              <Input
                value={data.ecg_findings_other || ""}
                onChange={(e) => update("ecg_findings_other", e.target.value)}
                className="h-11"
              />
            </div>
          )}
        </div>
      )}

      {has("CPR in progress") && (
        <div className="ml-7 border-l-2 border-muted pl-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">CPR started by</label>
            <Select value={data.cpr_started_by || ""} onValueChange={(v) => update("cpr_started_by", v)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {CPR_STARTED_BY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Estimated downtime (min)</label>
            <Input
              type="number"
              inputMode="numeric"
              value={data.cpr_downtime || ""}
              onChange={(e) => update("cpr_downtime", e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-1">Patient response to procedures</label>
        <Select value={data.patient_response || ""} onValueChange={(v) => update("patient_response", v)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {RESPONSES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Procedure notes</label>
        <Textarea
          rows={3}
          value={data.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
        />
      </div>
    </div>
  );
}