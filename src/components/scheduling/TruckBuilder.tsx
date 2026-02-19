import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Trash2, Zap, Users, GripVertical, GitBranch, Pencil, WrenchIcon, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSchedulingStore, type LegDisplay, type TruckOption, type CrewDisplay } from "@/hooks/useSchedulingStore";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AvailabilityRecord {
  id: string;
  truck_id: string;
  status: "down_maintenance" | "down_out_of_service";
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface SortableLegItemProps {
  leg: LegDisplay;
  onRemove: () => void;
  onEditException: () => void;
}

function SortableLegItem({ leg, onRemove, onEditException }: SortableLegItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: leg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHeavy = (leg.patient_weight ?? 0) > 200;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs bg-card ${leg.has_exception ? "border-primary/40" : ""}`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
          tabIndex={-1}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
          leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
        }`}>{leg.leg_type}</span>
        <span className="truncate font-medium text-card-foreground">{leg.patient_name}</span>
        {isHeavy && <Zap className="h-3 w-3 text-[hsl(var(--status-yellow))] shrink-0" aria-label="Electric stretcher required" />}
        {leg.has_exception && <GitBranch className="h-3 w-3 text-primary shrink-0" aria-label="Exception override active" />}
        {leg.pickup_time && <span className="text-muted-foreground shrink-0">{leg.pickup_time}</span>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEditException} title="Edit this run only">
          <Pencil className="h-2.5 w-2.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}

interface TruckBuilderProps {
  trucks: TruckOption[];
  legs: LegDisplay[];
  crews: CrewDisplay[];
  selectedDate: string;
  onRefresh: () => void;
  onEditException: (leg: LegDisplay) => void;
  onDownCountChange?: (count: number) => void;
}

export function TruckBuilder({ trucks, legs, crews, selectedDate, onRefresh, onEditException, onDownCountChange }: TruckBuilderProps) {
  const { addingLeg, setAddingLeg } = useSchedulingStore();
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load truck availability for the selected date
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("truck_availability" as any)
        .select("*")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate);
      const records = (data ?? []) as unknown as AvailabilityRecord[];
      setAvailability(records);
      // Report down count up to parent for the snapshot bar
      onDownCountChange?.(records.length);
    };
    load();
  }, [selectedDate, onDownCountChange]);

  const getTruckDown = (truckId: string): AvailabilityRecord | undefined =>
    availability.find((a) => a.truck_id === truckId);

  const truckLegs = (truckId: string) =>
    legs
      .filter((l) => l.assigned_truck_id === truckId)
      .sort((a, b) => {
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      });

  const unassigned = legs.filter((l) => !l.assigned_truck_id);

  const crewForTruck = (truckId: string): CrewDisplay | undefined =>
    crews.find((c) => c.truck_id === truckId);

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

  const handleDragEnd = async (event: DragEndEvent, truckId: string, tLegs: LegDisplay[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tLegs.findIndex((l) => l.id === active.id);
    const newIndex = tLegs.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tLegs, oldIndex, newIndex);

    await Promise.all(
      reordered.map((leg, idx) =>
        supabase
          .from("truck_run_slots")
          .update({ slot_order: idx } as any)
          .eq("leg_id", leg.id)
          .eq("run_date", selectedDate)
          .eq("truck_id", truckId)
      )
    );

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

  // Per-truck utilization: green=6–8, yellow=3–5, red=0–2 or >10
  const utilizationColor = (count: number) => {
    if (count >= 6 && count <= 8) return "bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30";
    if (count >= 3 && count <= 5) return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30";
    return "bg-[hsl(var(--status-red))]/10 text-[hsl(var(--status-red))] border-[hsl(var(--status-red))]/30";
  };

  const firstPickup = (tLegs: LegDisplay[]): string | null => {
    const times = tLegs.map(l => l.pickup_time).filter(Boolean) as string[];
    if (times.length === 0) return null;
    return times.sort()[0];
  };

  const lastPickup = (tLegs: LegDisplay[]): string | null => {
    const times = tLegs.map(l => l.pickup_time).filter(Boolean) as string[];
    if (times.length === 0) return null;
    return times.sort().reverse()[0];
  };

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Truck Builder
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {trucks.map((truck) => {
          const tLegs = truckLegs(truck.id);
          const slack = calcSlackMinutes(truck.id);
          const hasHeavy = tLegs.some((l) => (l.patient_weight ?? 0) > 200);
          const crew = crewForTruck(truck.id);
          const downRecord = getTruckDown(truck.id);
          const isDown = !!downRecord;
          const hasRunsWhileDown = isDown && tLegs.length > 0;

          const first = firstPickup(tLegs);
          const last = lastPickup(tLegs);

          return (
            <div
              key={truck.id}
              className={`rounded-lg border bg-card p-4 ${isDown ? "border-destructive/40 bg-destructive/5" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Truck className={`h-4 w-4 shrink-0 ${isDown ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`font-semibold truncate ${isDown ? "text-destructive" : "text-card-foreground"}`}>{truck.name}</span>
                  {isDown && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
                      {downRecord.status === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
                    </Badge>
                  )}
                  {hasHeavy && !isDown && (
                    <span className="text-[hsl(var(--status-yellow))] shrink-0" title="Has heavy patient - electric stretcher needed">
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                {!isDown && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Utilization badge */}
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${utilizationColor(tLegs.length)}`}>
                      {tLegs.length} runs
                    </span>
                  </div>
                )}
              </div>

              {/* Down warning */}
              {isDown && (
                <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  <div className="flex items-center gap-1 font-semibold">
                    <WrenchIcon className="h-3 w-3" />
                    Truck unavailable
                    {downRecord.reason && ` — ${downRecord.reason}`}
                  </div>
                  {hasRunsWhileDown && (
                    <div className="mt-1 flex items-center gap-1 text-[hsl(var(--status-yellow))] font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {tLegs.length} run(s) still assigned — reassign to another truck.
                    </div>
                  )}
                </div>
              )}

              {/* Crew info */}
              {!isDown && (
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  {crew ? (
                    <span className="truncate">{crew.member1_name ?? "—"} & {crew.member2_name ?? "—"}</span>
                  ) : (
                    <span className="italic text-[hsl(var(--status-yellow))]">⚠ No crew assigned</span>
                  )}
                </div>
              )}

              {/* First / last pickup time */}
              {!isDown && tLegs.length > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{first ?? "—"} → {last ?? "—"}</span>
                </div>
              )}




              {/* Sortable legs — always show if runs exist (even on down truck to allow reassignment) */}
              {tLegs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, truck.id, tLegs)}
                  >
                    <SortableContext items={tLegs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      {tLegs.map((leg) => (
                        <SortableLegItem
                          key={leg.id}
                          leg={leg}
                          onRemove={() => removeLeg(leg.id)}
                          onEditException={() => onEditException(leg)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* Only allow adding legs to available trucks */}
              {!isDown && tLegs.length < 10 && unassigned.length > 0 && (
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
                    <Plus className="mr-1 h-3 w-3" /> Add Leg from Run Pool
                  </Button>
                )
              )}

              {/* Blocked message for down trucks with no runs */}
              {isDown && tLegs.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">Truck blocked — cannot assign runs while down</p>
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
