import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Sparkles } from "lucide-react";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { cn } from "@/lib/utils";

const COMMON_ICD10_CODES = [
  // Renal / Dialysis
  { code: "Z99.2", description: "Dependence on renal dialysis" },
  { code: "N18.6", description: "End stage renal disease" },
  { code: "N18.5", description: "Chronic kidney disease stage 5" },
  { code: "N18.4", description: "Chronic kidney disease stage 4" },
  // Cardiovascular
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "I50.9", description: "Heart failure, unspecified" },
  { code: "I50.32", description: "Chronic diastolic (congestive) heart failure" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery" },
  { code: "I48.91", description: "Longstanding persistent atrial fibrillation" },
  { code: "I63.9", description: "Cerebral infarction, unspecified" },
  // Musculoskeletal & Post-Surgical
  { code: "M16.11", description: "Primary osteoarthritis, right hip" },
  { code: "M16.12", description: "Primary osteoarthritis, left hip" },
  { code: "M17.11", description: "Primary osteoarthritis, right knee" },
  { code: "M17.12", description: "Primary osteoarthritis, left knee" },
  { code: "Z96.641", description: "Presence of right artificial hip joint" },
  { code: "Z96.642", description: "Presence of left artificial hip joint" },
  { code: "Z96.651", description: "Presence of right artificial knee joint" },
  { code: "Z96.652", description: "Presence of left artificial knee joint" },
  { code: "M54.5", description: "Low back pain" },
  { code: "S72.001A", description: "Fracture of unspecified part of neck of right femur" },
  { code: "Z47.1", description: "Aftercare following joint replacement surgery" },
  // Neurological
  { code: "G35", description: "Multiple sclerosis" },
  { code: "G20", description: "Parkinson disease" },
  { code: "I69.351", description: "Hemiplegia affecting ambulation" },
  { code: "G81.90", description: "Hemiplegia, unspecified" },
  { code: "R41.3", description: "Other amnesia" },
  { code: "G30.9", description: "Alzheimer disease, unspecified" },
  { code: "F03.90", description: "Unspecified dementia without behavioral disturbance" },
  // Respiratory
  { code: "J44.1", description: "COPD with acute exacerbation" },
  { code: "J44.0", description: "COPD with lower respiratory infection" },
  { code: "J45.51", description: "Severe persistent asthma with acute exacerbation" },
  { code: "J96.00", description: "Acute respiratory failure, unspecified" },
  // Diabetes
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications" },
  { code: "E87.1", description: "Hyponatremia" },
  // Mobility & Functional Status
  { code: "R26.89", description: "Other abnormalities of gait and mobility" },
  { code: "R26.9", description: "Unspecified abnormalities of gait and mobility" },
  { code: "Z74.09", description: "Other reduced mobility / dependence on enabling machines" },
  { code: "R53.1", description: "Weakness" },
  { code: "M62.50", description: "Muscle weakness (generalized)" },
  // Wound Care
  { code: "L89.90", description: "Pressure ulcer, unspecified site, unspecified stage" },
  { code: "L97.909", description: "Non-pressure chronic ulcer of unspecified lower leg" },
  { code: "E11.621", description: "Type 2 diabetes mellitus with foot ulcer" },
  { code: "I83.90", description: "Varicose veins of unspecified lower extremity without complications" },
  // Cancer / Oncology
  { code: "C80.1", description: "Malignant (primary) neoplasm, unspecified" },
  { code: "Z51.11", description: "Encounter for antineoplastic chemotherapy" },
  { code: "Z51.12", description: "Encounter for antineoplastic immunotherapy" },
  { code: "Z79.899", description: "Other long-term (current) drug therapy" },
  // Psychiatric & Behavioral
  { code: "F20.9", description: "Schizophrenia, unspecified" },
  { code: "F31.9", description: "Bipolar disorder, unspecified" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified" },
  { code: "F10.20", description: "Alcohol dependence, uncomplicated" },
  // Routine Transport & Status
  { code: "Z09", description: "Encounter for follow-up examination after completed treatment" },
  { code: "Z51.89", description: "Encounter for other specified aftercare" },
  { code: "Z87.39", description: "Personal history of other diseases of the musculoskeletal system" },
  { code: "Z96.29", description: "Presence of other orthopedic joint implants" },
  { code: "Z95.810", description: "Presence of automatic (implantable) cardiac defibrillator" },
] as const;

// Chief complaint → suggested ICD-10 codes mapping
const COMPLAINT_SUGGESTIONS: Record<string, string[]> = {
  "no complaint (routine transport)": ["Z09", "Z51.89", "Z87.39"],
  "transfer / no complaint": ["Z09", "Z51.89", "Z87.39"],
  "extremity weakness": ["R53.1", "M62.50", "R26.89", "G81.90"],
  "general weakness": ["R53.1", "M62.50", "R26.89", "G81.90"],
  "cva / stroke symptoms": ["I63.9", "I69.351", "G81.90"],
  "chest pain": ["I50.9", "I25.10", "I10"],
  "breathing difficulty / dyspnea": ["J44.1", "J44.0", "J96.00"],
  "respiratory distress": ["J44.1", "J44.0", "J96.00"],
  "hyperglycemia / hypoglycemia": ["E11.65", "E11.9", "E10.9"],
  "fall / injury": ["S72.001A", "M54.5", "R26.89"],
  "pain — specify location": ["M54.5", "M16.11", "M17.11", "R26.89"],
  "back pain": ["M54.5", "M16.11", "M17.11", "R26.89"],
  "seizure": ["G20", "G35", "F20.9"],
  "altered mental status": ["R41.3", "G30.9", "F03.90"],
};

function getSuggestedCodes(chiefComplaint?: string, patientPayer?: string): string[] {
  const suggestions = new Set<string>();
  // Renal/dialysis context inferred from payer hints or complaint
  const payer = (patientPayer || "").toLowerCase();
  const complaint = (chiefComplaint || "").toLowerCase().trim();
  if (complaint.includes("dialysis") || complaint.includes("renal") || payer.includes("dialysis")) {
    ["Z99.2", "N18.6", "N18.5"].forEach((c) => suggestions.add(c));
  }
  if (complaint && COMPLAINT_SUGGESTIONS[complaint]) {
    COMPLAINT_SUGGESTIONS[complaint].forEach((c) => suggestions.add(c));
  }
  return Array.from(suggestions);
}

interface ICD10PickerProps {
  selectedCodes: string[];
  onCodesChange: (codes: string[]) => void;
  required?: boolean;
  maxCodes?: number;
  chiefComplaint?: string;
  patientPayer?: string;
}

export function ICD10Picker({
  selectedCodes,
  onCodesChange,
  required = false,
  maxCodes = 4,
  chiefComplaint,
  patientPayer,
}: ICD10PickerProps) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const suggestedCodes = useMemo(
    () => getSuggestedCodes(chiefComplaint, patientPayer),
    [chiefComplaint, patientPayer]
  );

  const { suggestedFiltered, otherFiltered } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (item: { code: string; description: string }) =>
      !q || item.code.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);

    const available = COMMON_ICD10_CODES.filter(
      (c) => !selectedCodes.includes(c.code) && matches(c)
    );

    const suggestedSet = new Set(suggestedCodes);
    const suggested = available.filter((c) => suggestedSet.has(c.code));
    const others = available.filter((c) => !suggestedSet.has(c.code));
    return { suggestedFiltered: suggested, otherFiltered: others };
  }, [search, selectedCodes, suggestedCodes]);

  const addCode = (code: string) => {
    if (selectedCodes.length >= maxCodes) return;
    onCodesChange([...selectedCodes, code]);
    setSearch("");
    setShowDropdown(false);
  };

  const removeCode = (code: string) => {
    onCodesChange(selectedCodes.filter((c) => c !== code));
  };

  const handleCustomAdd = () => {
    const trimmed = search.trim().toUpperCase();
    if (!trimmed || selectedCodes.includes(trimmed) || selectedCodes.length >= maxCodes) return;
    if (/^[A-Z]\d{2}(\.\d{1,4})?[A-Z]?$/i.test(trimmed)) {
      onCodesChange([...selectedCodes, trimmed]);
      setSearch("");
      setShowDropdown(false);
    }
  };

  const isFilled = selectedCodes.length > 0;
  const totalFiltered = suggestedFiltered.length + otherFiltered.length;
  const firstHit = suggestedFiltered[0] || otherFiltered[0];

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
        ICD-10 Diagnosis Codes
        {required && <PCRFieldDot filled={isFilled} />}
      </label>
      {required && !isFilled && (
        <p className="text-[10px] text-destructive">At least one diagnosis code is required for Medicare/Medicaid</p>
      )}

      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCodes.map((code) => {
            const info = COMMON_ICD10_CODES.find((c) => c.code === code);
            return (
              <Badge key={code} variant="secondary" className="text-xs gap-1 pr-1">
                <span className="font-bold">{code}</span>
                {info && <span className="text-muted-foreground font-normal">— {info.description.slice(0, 30)}</span>}
                <button
                  type="button"
                  onClick={() => removeCode(code)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {selectedCodes.length < maxCodes && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search ICD-10 by code or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (firstHit) {
                    addCode(firstHit.code);
                  } else {
                    handleCustomAdd();
                  }
                }
              }}
              className={cn("h-10 pl-8 text-sm", required && !isFilled ? "border-destructive/50" : "")}
            />
          </div>

          {showDropdown && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
              {totalFiltered === 0 && search.trim() ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No match. Press Enter to add "{search.trim().toUpperCase()}" as custom code.
                </div>
              ) : (
                <>
                  {suggestedFiltered.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/5 flex items-center gap-1 sticky top-0">
                        <Sparkles className="h-3 w-3" />
                        Suggested for "{chiefComplaint}"
                      </div>
                      {suggestedFiltered.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addCode(item.code)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center gap-2 border-b last:border-0"
                        >
                          <span className="font-bold text-primary shrink-0">{item.code}</span>
                          <span className="text-muted-foreground truncate">{item.description}</span>
                        </button>
                      ))}
                      {otherFiltered.length > 0 && (
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                          All Codes
                        </div>
                      )}
                    </>
                  )}
                  {otherFiltered.slice(0, 30).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addCode(item.code)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center gap-2 border-b last:border-0"
                    >
                      <span className="font-bold text-primary shrink-0">{item.code}</span>
                      <span className="text-muted-foreground truncate">{item.description}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {selectedCodes.length}/{maxCodes} codes selected
      </p>
    </div>
  );
}
