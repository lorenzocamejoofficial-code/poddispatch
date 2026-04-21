import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

interface MedEntry {
  id: string;
  name: string;
  dose: string;
  dose_unit: string;
  route: string;
  time: string;
  effect: string;
  administered_by: string;
}

const MED_SUGGESTIONS = [
  "Aspirin", "Nitroglycerin", "Epinephrine", "Naloxone (Narcan)", "Albuterol",
  "Diphenhydramine (Benadryl)", "Dextrose D50", "Adenosine", "Amiodarone",
  "Normal Saline", "Lactated Ringer", "Ondansetron (Zofran)", "Morphine",
  "Fentanyl", "Midazolam (Versed)", "Glucagon", "Activated Charcoal", "Oxygen",
];

const DOSE_UNITS = ["mg", "mcg", "g", "mL", "units", "puffs", "sprays"];

const ROUTES = [
  "IV", "IO", "IM", "SubQ", "PO (oral)", "SL (sublingual)",
  "Intranasal", "Inhaled", "Topical", "ET tube", "Rectal",
];

const EFFECTS = ["Improved", "No change", "Worsened", "Unknown"];

function newEntry(): MedEntry {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: "", dose: "", dose_unit: "mg", route: "", time: "", effect: "", administered_by: "",
  };
}

export function MedicationsCard({ trip, updateField }: Props) {
  const data = trip.medications_json || {};
  const noneAdministered: boolean = !!data.none_administered;
  const entries: MedEntry[] = Array.isArray(data.entries) ? data.entries : [];

  const save = (next: any) => updateField("medications_json", { ...data, ...next });

  const toggleNone = (checked: boolean) => {
    if (checked) save({ none_administered: true, entries: [] });
    else save({ none_administered: false });
  };

  const updateEntry = (id: string, patch: Partial<MedEntry>) => {
    save({ entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };

  const addEntry = () => save({ entries: [...entries, newEntry()] });
  const removeEntry = (id: string) => save({ entries: entries.filter((e) => e.id !== id) });

  return (
    <div className="space-y-5 p-4">
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={noneAdministered} onCheckedChange={(c) => toggleNone(!!c)} />
        No medications administered
      </label>

      {noneAdministered && (
        <div className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
          Confirmed: no medications were administered during this transport.
        </div>
      )}

      {!noneAdministered && (
        <>
          <datalist id="med-suggestions">
            {MED_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>

          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No medications recorded yet. Add the first medication below.</p>
          )}

          <div className="space-y-4">
            {entries.map((e, idx) => (
              <div key={e.id} className="border border-border rounded-md p-3 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Medication #{idx + 1}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(e.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Medication name</label>
                  <Input
                    list="med-suggestions"
                    value={e.name}
                    onChange={(ev) => updateEntry(e.id, { name: ev.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Dose</label>
                    <Input
                      value={e.dose}
                      onChange={(ev) => updateEntry(e.id, { dose: ev.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Unit</label>
                    <Select value={e.dose_unit} onValueChange={(v) => updateEntry(e.id, { dose_unit: v })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOSE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Route</label>
                    <Select value={e.route} onValueChange={(v) => updateEntry(e.id, { route: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Time administered</label>
                    <Input
                      type="time"
                      value={e.time}
                      onChange={(ev) => updateEntry(e.id, { time: ev.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Effect</label>
                    <Select value={e.effect} onValueChange={(v) => updateEntry(e.id, { effect: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {EFFECTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Administered by (name & cert level)</label>
                  <Input
                    value={e.administered_by}
                    onChange={(ev) => updateEntry(e.id, { administered_by: ev.target.value })}
                    placeholder="e.g. J. Smith, EMT-B"
                    className="h-11"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1" /> Add medication
          </Button>
        </>
      )}
    </div>
  );
}