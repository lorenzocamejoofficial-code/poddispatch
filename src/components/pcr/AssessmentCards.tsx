import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CHIEF_COMPLAINTS, PRIMARY_IMPRESSIONS, PHYSICAL_EXAM_SYSTEMS } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { ICD10Picker } from "@/components/pcr/ICD10Picker";
import { cn } from "@/lib/utils";

interface AssessmentCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

export function AssessmentCard({ trip, updateField, requiredFields = ["chief_complaint", "primary_impression"] }: AssessmentCardProps) {
  const assessment = trip.assessment_json || {};
  const isReq = (f: string) => requiredFields.includes(f);
  const isFilled = (f: string) => !!trip[f] && String(trip[f]).trim() !== "";
  const fieldBorder = (f: string) => {
    if (!isReq(f)) return "";
    return isFilled(f) ? "border-emerald-400" : "border-destructive/50";
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Chief Complaint <PCRTooltip text={PCR_TOOLTIPS.chief_complaint} />
          {isReq("chief_complaint") && <PCRFieldDot filled={isFilled("chief_complaint")} />}
        </label>
        <Select value={trip.chief_complaint || ""} onValueChange={(v) => updateField("chief_complaint", v)}>
          <SelectTrigger className={cn("h-12 text-base", fieldBorder("chief_complaint"))}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {CHIEF_COMPLAINTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {trip.chief_complaint === "Other" && (
          <Textarea className="mt-2" placeholder="Specify..." value={assessment.chief_complaint_other || ""}
            onChange={(e) => updateField("assessment_json", { ...assessment, chief_complaint_other: e.target.value })} rows={2} />
        )}
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Primary Impression <PCRTooltip text={PCR_TOOLTIPS.primary_impression} />
          {isReq("primary_impression") && <PCRFieldDot filled={isFilled("primary_impression")} />}
        </label>
        <Select value={trip.primary_impression || ""} onValueChange={(v) => updateField("primary_impression", v)}>
          <SelectTrigger className={cn("h-12 text-base", fieldBorder("primary_impression"))}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {CHIEF_COMPLAINTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Acute Symptoms <PCRTooltip text={PCR_TOOLTIPS.acute_symptoms} />
        </label>
        <Textarea placeholder="Describe acute symptoms..." value={assessment.acute_symptoms || ""}
          onChange={(e) => updateField("assessment_json", { ...assessment, acute_symptoms: e.target.value })} rows={2} />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Duration of Complaint</label>
        <Textarea placeholder="Onset, duration..." value={assessment.duration || ""}
          onChange={(e) => updateField("assessment_json", { ...assessment, duration: e.target.value })} rows={2} />
      </div>

      {/* ICD-10 Diagnosis Code Picker */}
      <ICD10Picker
        selectedCodes={Array.isArray(trip.icd10_codes) ? trip.icd10_codes : []}
        onCodesChange={(codes) => updateField("icd10_codes", codes)}
        required={(() => {
          const payer = (trip.patient?.primary_payer || "").toLowerCase();
          return payer.includes("medicare") || payer.includes("medicaid");
        })()}
        maxCodes={4}
      />
    </div>
  );
}

interface PhysicalExamCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function PhysicalExamCard({ trip, updateField }: PhysicalExamCardProps) {
  const exam = trip.physical_exam_json || {};

  const toggleFinding = (system: string, findingValue: string) => {
    const sysData = exam[system] || { findings: [] };
    const findings = sysData.findings || [];
    const updated = findings.includes(findingValue)
      ? findings.filter((f: string) => f !== findingValue)
      : [...findings, findingValue];
    updateField("physical_exam_json", { ...exam, [system]: { ...sysData, findings: updated } });
  };

  const updateNotes = (system: string, notes: string) => {
    const sysData = exam[system] || { findings: [] };
    updateField("physical_exam_json", { ...exam, [system]: { ...sysData, notes } });
  };

  return (
    <div className="space-y-4">
      {Object.entries(PHYSICAL_EXAM_SYSTEMS).map(([system, config]) => {
        const sysData = exam[system] || { findings: [] };
        const selectedFindings = sysData.findings || [];
        const hasAbnormal = selectedFindings.some((f: string) => config.findings.find(cf => cf.value === f)?.abnormal);

        return (
          <div key={system} className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-bold text-primary uppercase tracking-wider capitalize">{system.replace("_", " ")}</p>
            <div className="space-y-1.5">
              {config.findings.map((finding) => (
                <label key={finding.value} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedFindings.includes(finding.value)}
                    onCheckedChange={() => toggleFinding(system, finding.value)}
                  />
                  <span className={finding.abnormal ? "text-amber-700 dark:text-amber-400" : ""}>{finding.label}</span>
                </label>
              ))}
            </div>
            {hasAbnormal && (
              <Textarea placeholder="Additional notes for abnormal findings..." className="mt-2"
                value={sysData.notes || ""} onChange={(e) => updateNotes(system, e.target.value)} rows={2} />
            )}
          </div>
        );
      })}
    </div>
  );
}
