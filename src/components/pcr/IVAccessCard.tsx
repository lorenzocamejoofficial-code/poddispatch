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

interface IVEntry {
  id: string;
  access_type: string;
  site: string;
  gauge: string;
  attempts: string;
  successful: boolean;
  fluid_type: string;
  fluid_rate: string;
  total_volume: string;
  confirmed_by: string;
}

const ACCESS_TYPES = ["Peripheral IV", "Intraosseous (IO)", "Central line", "Existing IV access continued"];

const SITES = [
  "Right antecubital", "Left antecubital", "Right forearm", "Left forearm",
  "Right hand", "Left hand", "Right external jugular", "Left external jugular",
  "Right tibia (IO)", "Left tibia (IO)", "Sternal (IO)", "Other",
];

const GAUGES = ["14g", "16g", "18g", "20g", "22g", "24g", "IO needle"];

const FLUID_TYPES = [
  "Normal Saline", "Lactated Ringers", "D5W", "D10W", "Blood products", "No fluid running — saline lock",
];

const FLUID_RATES = [
  "TKO (keep open)", "100 mL/hour", "250 mL/hour", "500 mL/hour", "Wide open", "Other",
];

const CONFIRMED_BY = [
  "Blood flashback", "Ease of flushing", "Patient confirmation", "No confirmation obtained",
];

function newEntry(): IVEntry {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    access_type: "", site: "", gauge: "", attempts: "1", successful: false,
    fluid_type: "", fluid_rate: "", total_volume: "", confirmed_by: "",
  };
}

export function IVAccessCard({ trip, updateField }: Props) {
  const data = trip.iv_access_json || {};
  const noneAttempted: boolean = !!data.none_attempted;
  const entries: IVEntry[] = Array.isArray(data.entries) ? data.entries : [];

  const save = (next: any) => updateField("iv_access_json", { ...data, ...next });

  const toggleNone = (checked: boolean) => {
    if (checked) save({ none_attempted: true, entries: [] });
    else save({ none_attempted: false });
  };

  const updateEntry = (id: string, patch: Partial<IVEntry>) => {
    save({ entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };

  const addEntry = () => save({ entries: [...entries, newEntry()] });
  const removeEntry = (id: string) => save({ entries: entries.filter((e) => e.id !== id) });

  return (
    <div className="space-y-5 p-4">
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={noneAttempted} onCheckedChange={(c) => toggleNone(!!c)} />
        No vascular access attempted
      </label>

      {noneAttempted && (
        <div className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
          Confirmed: no vascular access was attempted during this transport.
        </div>
      )}

      {!noneAttempted && (
        <>
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No access attempts recorded yet. Add the first attempt below.</p>
          )}

          <div className="space-y-4">
            {entries.map((e, idx) => (
              <div key={e.id} className="border border-border rounded-md p-3 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Attempt #{idx + 1}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(e.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Access type</label>
                    <Select value={e.access_type} onValueChange={(v) => updateEntry(e.id, { access_type: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {ACCESS_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Site</label>
                    <Select value={e.site} onValueChange={(v) => updateEntry(e.id, { site: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {SITES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Catheter gauge</label>
                    <Select value={e.gauge} onValueChange={(v) => updateEntry(e.id, { gauge: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {GAUGES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Attempts</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={e.attempts}
                      onChange={(ev) => updateEntry(e.id, { attempts: ev.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={e.successful} onCheckedChange={(c) => updateEntry(e.id, { successful: !!c })} />
                  Successful
                </label>

                {e.successful && (
                  <div className="ml-7 border-l-2 border-muted pl-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium block mb-1">Fluid type</label>
                        <Select value={e.fluid_type} onValueChange={(v) => updateEntry(e.id, { fluid_type: v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {FLUID_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1">Fluid rate</label>
                        <Select value={e.fluid_rate} onValueChange={(v) => updateEntry(e.id, { fluid_rate: v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {FLUID_RATES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Total volume infused (mL)</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={e.total_volume}
                        onChange={(ev) => updateEntry(e.id, { total_volume: ev.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium block mb-1">Confirmed by</label>
                  <Select value={e.confirmed_by} onValueChange={(v) => updateEntry(e.id, { confirmed_by: v })}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {CONFIRMED_BY.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1" /> Add attempt
          </Button>
        </>
      )}
    </div>
  );
}