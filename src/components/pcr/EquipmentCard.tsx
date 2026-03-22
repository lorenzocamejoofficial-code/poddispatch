import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OXYGEN_DELIVERY, STRETCHER_TYPES } from "@/lib/pcr-dropdowns";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function EquipmentCard({ trip, updateField }: Props) {
  const eq = trip.equipment_used_json || {};

  const update = (key: string, value: any) => {
    updateField("equipment_used_json", { ...eq, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Oxygen */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.oxygen || false} onCheckedChange={(c) => update("oxygen", !!c)} />
          Oxygen in Use
        </label>
        {eq.oxygen && (
          <div className="ml-7 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Flow Rate (LPM)</label>
              <Input type="number" inputMode="decimal" placeholder="2" value={eq.oxygen_flow_rate || ""}
                onChange={(e) => update("oxygen_flow_rate", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Delivery Method</label>
              <Select value={eq.oxygen_delivery_method || ""} onValueChange={(v) => update("oxygen_delivery_method", v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {OXYGEN_DELIVERY.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Stretcher */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Stretcher Type</label>
        <Select value={eq.stretcher_type || ""} onValueChange={(v) => update("stretcher_type", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {STRETCHER_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Other equipment */}
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <Checkbox checked={eq.stair_chair || false} onCheckedChange={(c) => update("stair_chair", !!c)} />
        Stair Chair Used
      </label>
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <Checkbox checked={eq.cardiac_monitor || false} onCheckedChange={(c) => update("cardiac_monitor", !!c)} />
        Cardiac Monitor
      </label>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">Other Equipment</label>
        <Input placeholder="Other equipment used..." value={eq.other || ""}
          onChange={(e) => update("other", e.target.value)} className="h-10" />
      </div>
    </div>
  );
}
