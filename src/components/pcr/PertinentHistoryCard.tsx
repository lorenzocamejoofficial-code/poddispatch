import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Pertinent Medical History (NEMSIS eHistory.08).
 * Persists on the patient record (so it auto-populates future PCRs) AND
 * snapshots onto the trip (so the PCR captures what was true at transport time).
 *
 * Justifies Medicare ambulance medical-necessity per CMS Benefit Policy
 * Manual Ch.10 §10.2 — e.g. a right BKA + non-weight-bearing supports why
 * the patient cannot safely be transported by wheelchair/POV.
 */

export type PertinentHistory = {
  na: boolean;
  items: string[];
  other: string;
};

const EMPTY: PertinentHistory = { na: false, items: [], other: "" };

const GROUPS: { label: string; items: { value: string; label: string }[] }[] = [
  {
    label: "Amputations",
    items: [
      { value: "amp_r_bka", label: "Right BKA (below-knee)" },
      { value: "amp_l_bka", label: "Left BKA (below-knee)" },
      { value: "amp_r_aka", label: "Right AKA (above-knee)" },
      { value: "amp_l_aka", label: "Left AKA (above-knee)" },
      { value: "amp_r_bea", label: "Right BEA (below-elbow)" },
      { value: "amp_l_bea", label: "Left BEA (below-elbow)" },
      { value: "amp_r_aea", label: "Right AEA (above-elbow)" },
      { value: "amp_l_aea", label: "Left AEA (above-elbow)" },
      { value: "amp_toes", label: "Toe / partial-foot amputation" },
      { value: "amp_fingers", label: "Finger / partial-hand amputation" },
    ],
  },
  {
    label: "Neurological / Mobility",
    items: [
      { value: "cva_hemiplegia", label: "CVA with hemiplegia" },
      { value: "paraplegia", label: "Paraplegia" },
      { value: "quadriplegia", label: "Quadriplegia" },
      { value: "contractures", label: "Severe contractures" },
      { value: "non_weight_bearing", label: "Non-weight-bearing" },
      { value: "ms", label: "Multiple Sclerosis" },
      { value: "als", label: "ALS" },
      { value: "parkinsons", label: "Parkinson's" },
      { value: "dementia", label: "Dementia / Alzheimer's" },
      { value: "seizure_disorder", label: "Seizure disorder" },
    ],
  },
  {
    label: "Cardiopulmonary / Renal",
    items: [
      { value: "esrd_dialysis", label: "ESRD on dialysis" },
      { value: "chf", label: "CHF" },
      { value: "copd_o2", label: "COPD on home O₂" },
      { value: "tracheostomy", label: "Tracheostomy" },
      { value: "ventilator", label: "Ventilator-dependent" },
      { value: "cardiac_history", label: "Cardiac history (MI/CABG/stents)" },
    ],
  },
  {
    label: "Skin / Wound / Other",
    items: [
      { value: "pressure_ulcer", label: "Pressure ulcer (stage II+)" },
      { value: "wound_vac", label: "Wound VAC in place" },
      { value: "ostomy", label: "Ostomy (colostomy/ileostomy/uro)" },
      { value: "peg_tube", label: "PEG / feeding tube" },
      { value: "foley", label: "Indwelling foley" },
      { value: "fall_risk", label: "High fall risk" },
      { value: "bariatric", label: "Bariatric" },
      { value: "isolation_mrsa_cdiff", label: "MRSA / C.diff / isolation hx" },
    ],
  },
];

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  required?: boolean;
}

export function PertinentHistoryCard({ trip, updateField, required = true }: Props) {
  const patient = trip.patient;
  const hydratedRef = useRef(false);

  // Source of truth precedence: trip snapshot > patient record > empty
  const initial: PertinentHistory =
    (trip.pertinent_history as PertinentHistory | null) ??
    (patient?.pertinent_history as PertinentHistory | null) ??
    EMPTY;

  const [value, setValue] = useState<PertinentHistory>(initial);

  // Hydrate the trip snapshot from the patient record on first open
  // (only when trip has nothing yet but patient does).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (!trip.pertinent_history && patient?.pertinent_history) {
      updateField("pertinent_history", patient.pertinent_history);
    }
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = async (next: PertinentHistory) => {
    setValue(next);
    await updateField("pertinent_history", next);
    // Also persist back to the patient record so future PCRs auto-fill.
    if (patient?.id) {
      supabase
        .from("patients")
        .update({ pertinent_history: next as any })
        .eq("id", patient.id)
        .then(({ error }) => {
          if (error) console.error("Patient pertinent_history save error:", error);
        });
    }
  };

  const isComplete =
    value.na === true || value.items.length > 0 || (value.other?.trim().length ?? 0) > 0;

  const toggleItem = (key: string, checked: boolean) => {
    const next: PertinentHistory = {
      ...value,
      na: false, // selecting anything clears N/A
      items: checked ? Array.from(new Set([...(value.items || []), key])) : (value.items || []).filter((v) => v !== key),
    };
    commit(next);
  };

  const toggleNA = (checked: boolean) => {
    commit(checked ? { na: true, items: [], other: "" } : { ...value, na: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center">
          Pertinent medical/surgical history. Required for Medicare medical-necessity audit defense.
          {required && <PCRFieldDot filled={isComplete} className="ml-2" />}
        </p>
        <Button
          type="button"
          variant={value.na ? "default" : "outline"}
          size="sm"
          className={cn("text-xs", value.na && "bg-emerald-600 hover:bg-emerald-700 text-white")}
          onClick={() => toggleNA(!value.na)}
        >
          {value.na ? "✓ N/A — none pertinent" : "Mark N/A — none pertinent"}
        </Button>
      </div>

      <div
        className={cn(
          "rounded-md border-2 p-3 space-y-4 transition-colors",
          value.na
            ? "border-muted bg-muted/20 opacity-60 pointer-events-none"
            : isComplete
              ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10"
              : "border-destructive/60 bg-destructive/5",
        )}
      >
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {group.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {group.items.map((it) => {
                const checked = (value.items || []).includes(it.value);
                return (
                  <label
                    key={it.value}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2 py-1.5 cursor-pointer text-sm border",
                      checked ? "border-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/20" : "border-transparent hover:bg-muted/40",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={(c) => toggleItem(it.value, !!c)} />
                    <span>{it.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Other (specify)
          </Label>
          <Input
            value={value.other || ""}
            placeholder="e.g. left hip replacement 2019, CIDP, post-op day 3 lumbar fusion…"
            className="mt-1 h-9 text-sm"
            onChange={(e) => setValue({ ...value, other: e.target.value })}
            onBlur={() => commit({ ...value, na: value.other?.trim() ? false : value.na })}
          />
        </div>
      </div>
    </div>
  );
}
