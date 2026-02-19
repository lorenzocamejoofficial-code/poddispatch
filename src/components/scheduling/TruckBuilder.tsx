import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, Trash2, Zap, Users, GripVertical } from "lucide-react";
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

interface SortableLegItemProps {
  leg: LegDisplay;
  onRemove: () => void;
}

function SortableLegItem({ leg, onRemove }: SortableLegItemProps) {
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
      className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs bg-card"
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
        {isHeavy && <Zap className="h-3 w-3 text-[hsl(var(--status-yellow))] shrink-0" />}
        {leg.pickup_time && <span className="text-muted-foreground shrink-0">{leg.pickup_time}</span>}
      </div>
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onRemove}>
        <Trash2 className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}

interface TruckBuilderProps {
  trucks: TruckOption[];
  legs: LegDisplay[];
  crews: CrewDisplay[];
  selectedDate: string;
  onRefresh: () => void;
}

export function TruckBuilder({ trucks, legs, crews, selectedDate, onRefresh }: TruckBuilderProps) {
  const { addingLeg, setAddingLeg } = useSchedulingStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

    // Persist new slot_order for each leg in this truck
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
          const crew = crewForTruck(truck.id);

          return (
            <div key={truck.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
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

              {/* Crew info */}
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {crew ? (
                  <span>{crew.member1_name ?? "—"} & {crew.member2_name ?? "—"}</span>
                ) : (
                  <span className="italic">No crew assigned</span>
                )}
              </div>

              <div className="mb-2 text-xs text-muted-foreground">
                {tLegs.length}/10 slots used
              </div>

              {/* Sortable legs */}
              <div className="space-y-1.5 mb-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, truck.id, tLegs)}
                >
                  <SortableContext items={tLegs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {tLegs.map((leg) => (
                      <SortableLegItem key={leg.id} leg={leg} onRemove={() => removeLeg(leg.id)} />
                    ))}
                  </SortableContext>
                </DndContext>
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
