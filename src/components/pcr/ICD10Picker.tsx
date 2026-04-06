import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { cn } from "@/lib/utils";

const COMMON_ICD10_CODES = [
  { code: "Z99.2", description: "Dependence on renal dialysis" },
  { code: "R26.89", description: "Other abnormalities of gait and mobility" },
  { code: "I69.351", description: "Hemiplegia affecting ambulation" },
  { code: "G35", description: "Multiple sclerosis" },
  { code: "M62.50", description: "Muscle weakness (generalized)" },
  { code: "R55", description: "Syncope and collapse" },
  { code: "I50.9", description: "Heart failure, unspecified" },
  { code: "N18.6", description: "End stage renal disease" },
  { code: "Z87.39", description: "Personal history of musculoskeletal disorders" },
  { code: "R41.3", description: "Other amnesia" },
  { code: "G82.20", description: "Paraplegia, unspecified" },
  { code: "G82.50", description: "Quadriplegia, unspecified" },
  { code: "R26.0", description: "Ataxic gait" },
  { code: "R26.2", description: "Difficulty in walking, not elsewhere classified" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "J44.1", description: "COPD with acute exacerbation" },
  { code: "S72.001A", description: "Fracture of unspecified part of neck of femur" },
  { code: "M54.5", description: "Low back pain" },
  { code: "Z96.1", description: "Presence of intraocular lens" },
] as const;

interface ICD10PickerProps {
  selectedCodes: string[];
  onCodesChange: (codes: string[]) => void;
  required?: boolean;
  maxCodes?: number;
}

export function ICD10Picker({ selectedCodes, onCodesChange, required = false, maxCodes = 4 }: ICD10PickerProps) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredCodes = useMemo(() => {
    if (!search.trim()) return COMMON_ICD10_CODES.filter(c => !selectedCodes.includes(c.code));
    const q = search.toLowerCase();
    return COMMON_ICD10_CODES.filter(
      c => !selectedCodes.includes(c.code) && (c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
  }, [search, selectedCodes]);

  const addCode = (code: string) => {
    if (selectedCodes.length >= maxCodes) return;
    onCodesChange([...selectedCodes, code]);
    setSearch("");
    setShowDropdown(false);
  };

  const removeCode = (code: string) => {
    onCodesChange(selectedCodes.filter(c => c !== code));
  };

  const handleCustomAdd = () => {
    const trimmed = search.trim().toUpperCase();
    if (!trimmed || selectedCodes.includes(trimmed) || selectedCodes.length >= maxCodes) return;
    // Basic ICD-10 format validation
    if (/^[A-Z]\d{2}(\.\d{1,4})?[A-Z]?$/i.test(trimmed)) {
      onCodesChange([...selectedCodes, trimmed]);
      setSearch("");
      setShowDropdown(false);
    }
  };

  const isFilled = selectedCodes.length > 0;

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
        ICD-10 Diagnosis Codes
        {required && <PCRFieldDot filled={isFilled} />}
      </label>
      {required && !isFilled && (
        <p className="text-[10px] text-destructive">At least one diagnosis code is required for Medicare/Medicaid</p>
      )}

      {/* Selected codes as badges */}
      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCodes.map(code => {
            const info = COMMON_ICD10_CODES.find(c => c.code === code);
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

      {/* Search input */}
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
                  if (filteredCodes.length > 0) {
                    addCode(filteredCodes[0].code);
                  } else {
                    handleCustomAdd();
                  }
                }
              }}
              className={cn("h-10 pl-8 text-sm", required && !isFilled ? "border-destructive/50" : "")}
            />
          </div>

          {showDropdown && (search.trim() || !selectedCodes.length) && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
              {filteredCodes.length === 0 && search.trim() ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No match. Press Enter to add "{search.trim().toUpperCase()}" as custom code.
                </div>
              ) : (
                filteredCodes.slice(0, 10).map(item => (
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
                ))
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
