import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useSchedulingStore, type LegDisplay, type TruckOption } from "@/hooks/useSchedulingStore";

interface TruckBuilderProps {
  trucks: TruckOption[];
  legs: LegDisplay[];
  selectedDate: string;
  onRefresh: () => void;
}

export function TruckBuilder({ trucks, legs, selectedDate, onRefresh }: TruckBuilderProps) {
  const { addingLeg, setAddingLeg } = useSchedulingStore();

  const truckLegs = (truckId: string) =>
    legs
      .filter((l) => l.assigned_truck_id === truckId)
      .sort((a, b) => {
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      });

  const unassigned = legs.filter((l) => !l.assigned_truck_id);

  const assignLeg = async (truckId: string, legId: string) => {
    const currentSlots = truckLegs(truckId);
    if (currentSlots.length >= 10) {
      toast.error("Truck is full (10 run slots max)");
      return;
    }

    const { error } = await supabase.from("truck_run_slots").insert({
      truck_id: truckId,
      leg_id: legId,
      run_date: selectedDate,
      slot_order: currentSlots.length,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast.error("This leg is already assigned to a truck for this date");
      } else {
        toast.error("Failed to assign leg");
      }
      return;
    }

    toast.success("Leg assigned to truck");
    setAddingLeg(null);
    onRefresh();
  };

  const removeLeg = async (legId: string) => {
    await supabase.from("truck_run_slots").delete().eq("leg_id", legId).eq("run_date", selectedDate);
    toast.success("Leg removed from truck");
    onRefresh();
  };

  const calcSlackMinutes = (truckId: string): number => {
    const tLegs = truckLegs(truckId);
    if (tLegs.length === 0) return 999;
    const totalDuration = tLegs.reduce((sum, l) => sum + (l.estimated_duration_minutes ?? 30), 0);
    const workingMinutes = 600;
    return Math.max(0, workingMinutes - totalDuration * 2);
  };

  const slackColor = (slack: number) => {
    if (slack >= 60) return "text-[hsl(var(--status-green))]";
    if (slack >= 20) return "text-[hsl(var(--status-yellow))]";
    return "text-[hsl(var(--status-red))]";
  };

  const slackLabel = (slack: number) => {
    if (slack >= 999) return "No runs";
    if (slack >= 60) return `${slack}min slack`;
    if (slack >= 20) return `${slack}min (tight)`;
    return `${slack}min (at risk)`;
  };

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Truck Builder
      </h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trucks.map((truck) => {
          const tLegs = truckLegs(truck.id);
          const slack = calcSlackMinutes(truck.id);
          const hasHeavy = tLegs.some((l) => (l.patient_weight ?? 0) > 200);

          return (
            <div key={truck.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-card-foreground">{truck.name}</span>
                  {hasHeavy && (
                    <span className="text-[hsl(var(--status-yellow))]" title="Has heavy patient - electric stretcher needed">
                      <Zap className="h-4 w-4" />
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium ${slackColor(slack)}`}>
                  {slackLabel(slack)}
                </span>
              </div>

              <div className="mb-2 text-xs text-muted-foreground">
                {tLegs.length}/10 slots used
              </div>

              <div className="space-y-1.5 mb-3">
                {tLegs.map((leg) => {
                  const isHeavy = (leg.patient_weight ?? 0) > 200;
                  return (
                    <div key={leg.id} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
                        }`}>{leg.leg_type}</span>
                        <span className="truncate font-medium text-card-foreground">{leg.patient_name}</span>
                        {isHeavy && <Zap className="h-3 w-3 text-[hsl(var(--status-yellow))] shrink-0" />}
                        {leg.pickup_time && <span className="text-muted-foreground shrink-0">{leg.pickup_time}</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeLeg(leg.id)}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  );
                })}
                {tLegs.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">No legs assigned</p>
                )}
              </div>

              {tLegs.length < 10 && unassigned.length > 0 && (
                addingLeg?.truckId === truck.id ? (
                  <div className="flex gap-2">
                    <Select value={addingLeg.legId} onValueChange={(v) => setAddingLeg({ truckId: truck.id, legId: v })}>
                      <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select leg" /></SelectTrigger>
                      <SelectContent>
                        {unassigned.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.leg_type}: {l.patient_name} {l.pickup_time ?? ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8" onClick={() => addingLeg.legId && assignLeg(truck.id, addingLeg.legId)}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingLeg(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddingLeg({ truckId: truck.id, legId: "" })}>
                    <Plus className="mr-1 h-3 w-3" /> Add Leg
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
      {trucks.length === 0 && (
        <p className="text-sm text-muted-foreground">No trucks configured. Add trucks in the Trucks & Crews section.</p>
      )}
    </section>
  );
}
