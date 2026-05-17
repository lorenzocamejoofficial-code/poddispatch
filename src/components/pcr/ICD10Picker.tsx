import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Sparkles } from "lucide-react";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { cn } from "@/lib/utils";
import { COMMON_ICD10_CODES, COMPLAINT_SUGGESTIONS } from "@/lib/icd10-codes";

function getSuggestedCodes(chiefComplaint?: string, patientPayer?: string): string[] {
  const suggestions = new Set<string>();
  // Renal/dialysis context inferred from payer hints or complaint
  const payer = (patientPayer || "").toLowerCase();
  const complaint = (chiefComplaint || "").toLowerCase().trim();
  if (complaint.includes("dialysis") || complaint.includes("renal") || payer.includes("dialysis")) {
    ["Z99.2", "N18.6", "N18.5"].forEach((c) => suggestions.add(c));
  }
  if (complaint.includes("wound")) {
    ["L97.909", "L89.90", "E11.621"].forEach((c) => suggestions.add(c));
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
