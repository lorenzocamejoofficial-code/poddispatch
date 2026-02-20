import { memo, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Trash2, Zap, Users, GripVertical, GitBranch, Pencil, WrenchIcon, AlertTriangle, Clock, Link2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSchedulingStore, type LegDisplay, type TruckOption, type CrewDisplay } from "@/hooks/useSchedulingStore";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { OperationalAlert } from "@/components/dispatch/OperationalAlertsPanel";
import { format } from "date-fns";

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
  hasAlert?: boolean;
  onRemove: () => void;
  onEditException: () => void;
}

const SortableLegItem = memo(function SortableLegItem({ leg, onRemove, onEditException }: SortableLegItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: leg.id,
    data: { type: "assigned-leg", leg },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.4 : 1,
  };

  const isHeavy = (leg.patient_weight ?? 0) > 200;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs bg-card ${leg.has_exception ? "border-primary/40" : ""} ${isDragging ? "shadow-md ring-1 ring-primary/30" : ""}`}
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
});

// Droppable zone for a truck — handles both pool→truck and truck→truck
const TruckDropZone = memo(function TruckDropZone({ truckId, isEmpty }: { truckId: string; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `truck-drop-${truckId}`,
    data: { type: "truck-zone", truckId },
  });

  if (!isEmpty) return null;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border-2 border-dashed px-3 py-3 text-center text-xs transition-colors duration-150 ${
        isOver
          ? "border-primary/60 bg-primary/5 text-primary"
          : "border-muted-foreground/20 text-muted-foreground/50"
      }`}
    >
      {isOver ? "Drop here to assign" : "Drop runs here"}
    </div>
  );
});

interface ActiveShareToken {
  truck_id: string;
  valid_from: string;
  valid_until: string;
}

interface TruckBuilderProps {
  trucks: TruckOption[];
  legs: LegDisplay[];
  crews: CrewDisplay[];
  selectedDate: string;
  onRefresh: () => void;
  onEditException: (leg: LegDisplay) => void;
  onDownCountChange?: (count: number) => void;
  activeTokens?: ActiveShareToken[];
  operationalAlerts?: OperationalAlert[];
}

export function TruckBuilder({ trucks, legs, crews, selectedDate, onRefresh, onEditException, onDownCountChange, activeTokens = [], operationalAlerts = [] }: TruckBuilderProps) {
  const { addingLeg, setAddingLeg } = useSchedulingStore();
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);

  const hasActiveLinkForDate = useCallback((truckId: string): boolean =>
    activeTokens.some(t => t.truck_id === truckId && selectedDate >= t.valid_from && selectedDate <= t.valid_until),
    [activeTokens, selectedDate]
  );

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("truck_availability" as any)
        .select("*")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate);
      const records = (data ?? []) as unknown as AvailabilityRecord[];
      setAvailability(records);
      onDownCountChange?.(records.length);
    };
    load();
  }, [selectedDate, onDownCountChange]);

  const getTruckDown = useCallback((truckId: string): AvailabilityRecord | undefined =>
    availability.find((a) => a.truck_id === truckId),
    [availability]
  );

  const truckLegs = useCallback((truckId: string) =>
    legs
      .filter((l) => l.assigned_truck_id === truckId)
      .sort((a, b) => {
        if (a.slot_order != null && b.slot_order != null) return a.slot_order - b.slot_order;
        if (a.slot_order != null) return -1;
        if (b.slot_order != null) return 1;
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      }),
    [legs]
  );

  const unassigned = legs.filter((l) => !l.assigned_truck_id);

  const crewForTruck = useCallback((truckId: string): CrewDisplay | undefined =>
    crews.find((c) => c.truck_id === truckId),
    [crews]
  );

  const assignLeg = useCallback(async (truckId: string, legId: string) => {
    const currentSlots = truckLegs(truckId);
    if (currentSlots.length >= 10) {
      toast.error("Truck is full (10 run slots max)");
      return;
    }
    const { data: profileData } = await supabase.from("profiles").select("company_id").limit(1).single();
    const companyId = (profileData as any)?.company_id ?? null;
    const { error } = await supabase.from("truck_run_slots").insert({
      truck_id: truckId,
      leg_id: legId,
      run_date: selectedDate,
      slot_order: currentSlots.length,
      company_id: companyId,
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
  }, [truckLegs, selectedDate, onRefresh, setAddingLeg]);

  const removeLeg = useCallback(async (legId: string) => {
    await supabase.from("truck_run_slots").delete().eq("leg_id", legId).eq("run_date", selectedDate);
    toast.success("Leg removed from truck");
    onRefresh();
  }, [selectedDate, onRefresh]);

  const utilizationColor = useCallback((count: number) => {
    if (count >= 6 && count <= 8) return "bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30";
    if (count >= 3 && count <= 5) return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30";
    return "bg-[hsl(var(--status-red))]/10 text-[hsl(var(--status-red))] border-[hsl(var(--status-red))]/30";
  }, []);

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Truck Builder
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {trucks.map((truck) => {
          const tLegs = truckLegs(truck.id);
          const hasHeavy = tLegs.some((l) => (l.patient_weight ?? 0) > 200);
          const crew = crewForTruck(truck.id);
          const downRecord = getTruckDown(truck.id);
          const isDown = !!downRecord;
          const hasRunsWhileDown = isDown && tLegs.length > 0;
          const times = tLegs.map(l => l.pickup_time).filter(Boolean) as string[];
          const first = times.length > 0 ? times.sort()[0] : null;
          const last = times.length > 0 ? [...times].sort().reverse()[0] : null;
          const hasLink = hasActiveLinkForDate(truck.id);
          const truckAlerts = operationalAlerts.filter(a => a.truck_id === truck.id && a.status === "open");
          const truckLegAlertIds = new Set(truckAlerts.map(a => a.leg_id));

          return (
            <TruckCard
              key={truck.id}
              truck={truck}
              tLegs={tLegs}
              crew={crew}
              downRecord={downRecord}
              isDown={isDown}
              hasRunsWhileDown={hasRunsWhileDown}
              hasHeavy={hasHeavy}
              first={first}
              last={last}
              hasActiveLink={hasLink}
              utilizationColor={utilizationColor}
              unassigned={unassigned}
              addingLeg={addingLeg}
              setAddingLeg={setAddingLeg}
              onAssignLeg={assignLeg}
              onRemoveLeg={removeLeg}
              onEditException={onEditException}
              truckAlertCount={truckAlerts.length}
              legAlertIds={truckLegAlertIds}
            />
          );
        })}
      </div>
      {trucks.length === 0 && (
        <p className="text-sm text-muted-foreground">No trucks configured. Add trucks in the Trucks & Crews section.</p>
      )}
    </section>
  );
}

// ── Individual truck card with its own droppable zone ──
interface TruckCardProps {
  truck: TruckOption;
  tLegs: LegDisplay[];
  crew: CrewDisplay | undefined;
  downRecord: AvailabilityRecord | undefined;
  isDown: boolean;
  hasRunsWhileDown: boolean;
  hasHeavy: boolean;
  first: string | null;
  last: string | null;
  hasActiveLink: boolean;
  utilizationColor: (count: number) => string;
  unassigned: LegDisplay[];
  addingLeg: { truckId: string; legId: string } | null;
  setAddingLeg: (v: { truckId: string; legId: string } | null) => void;
  onAssignLeg: (truckId: string, legId: string) => void;
  onRemoveLeg: (legId: string) => void;
  onEditException: (leg: LegDisplay) => void;
  truckAlertCount?: number;
  legAlertIds?: Set<string>;
}

const TruckCard = memo(function TruckCard({
  truck, tLegs, crew, downRecord, isDown, hasRunsWhileDown, hasHeavy,
  first, last, hasActiveLink, utilizationColor, unassigned, addingLeg, setAddingLeg,
  onAssignLeg, onRemoveLeg, onEditException, truckAlertCount = 0, legAlertIds = new Set(),
}: TruckCardProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `truck-drop-${truck.id}`,
    data: { type: "truck-zone", truckId: truck.id },
  });

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-colors duration-150 ${
        isDown ? "border-destructive/40 bg-destructive/5" : ""
      } ${isOver && !isDown ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : ""} ${
        truckAlertCount > 0 && !isDown ? "border-[hsl(var(--status-red))]/40" : ""
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Truck className={`h-4 w-4 shrink-0 ${isDown ? "text-destructive" : "text-muted-foreground"}`} />
          <span className={`font-semibold truncate ${isDown ? "text-destructive" : "text-card-foreground"}`}>{truck.name}</span>
          {isDown && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
              {downRecord!.status === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
            </Badge>
          )}
          {truckAlertCount > 0 && !isDown && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--status-red))]/15 px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--status-red))] shrink-0">
              <AlertCircle className="h-2.5 w-2.5" />{truckAlertCount}
            </span>
          )}
          {hasHeavy && !isDown && (
            <span className="text-[hsl(var(--status-yellow))] shrink-0" title="Has heavy patient - electric stretcher needed">
              <Zap className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasActiveLink && (
            <span title="Crew share link active for this date" className="flex items-center gap-0.5 text-[hsl(var(--status-green))]">
              <Link2 className="h-3 w-3" />
            </span>
          )}
          {!isDown && (
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${utilizationColor(tLegs.length)}`}>
              {tLegs.length} runs
            </span>
          )}
        </div>
      </div>

      {/* Down warning */}
      {isDown && (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <div className="flex items-center gap-1 font-semibold">
            <WrenchIcon className="h-3 w-3" />
            Truck unavailable
            {downRecord!.reason && ` — ${downRecord!.reason}`}
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

      {/* Drop zone + sortable leg list */}
      <div ref={setDropRef} className="mb-2 min-h-[2rem]">
        {tLegs.length > 0 ? (
          <div className={`space-y-1.5 rounded-md transition-colors duration-150 ${isOver && !isDown ? "bg-primary/3" : ""}`}>
            <SortableContext items={tLegs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {tLegs.map((leg) => (
                <SortableLegItem
                  key={leg.id}
                  leg={leg}
                  hasAlert={legAlertIds.has(leg.id)}
                  onRemove={() => onRemoveLeg(leg.id)}
                  onEditException={() => onEditException(leg)}
                />
              ))}
            </SortableContext>
            {isOver && !isDown && (
              <div className="rounded-md border-2 border-dashed border-primary/40 px-2 py-1.5 text-center text-[10px] text-primary/70">
                Drop to add here
              </div>
            )}
          </div>
        ) : (
          <TruckDropZone truckId={truck.id} isEmpty />
        )}
      </div>

      {/* Manual add leg selector */}
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
            <Button size="sm" className="h-8" onClick={() => addingLeg.legId && onAssignLeg(truck.id, addingLeg.legId)}>Add</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingLeg(null)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddingLeg({ truckId: truck.id, legId: "" })}>
            <Plus className="mr-1 h-3 w-3" /> Add Leg
          </Button>
        )
      )}

      {/* Blocked message for down trucks with no runs */}
      {isDown && tLegs.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">Truck blocked — cannot assign runs while down</p>
      )}
    </div>
  );
});
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `truck-drop-${truck.id}`,
    data: { type: "truck-zone", truckId: truck.id },
  });

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-colors duration-150 ${
        isDown ? "border-destructive/40 bg-destructive/5" : ""
      } ${isOver && !isDown ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : ""}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Truck className={`h-4 w-4 shrink-0 ${isDown ? "text-destructive" : "text-muted-foreground"}`} />
          <span className={`font-semibold truncate ${isDown ? "text-destructive" : "text-card-foreground"}`}>{truck.name}</span>
          {isDown && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
              {downRecord!.status === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
            </Badge>
          )}
          {hasHeavy && !isDown && (
            <span className="text-[hsl(var(--status-yellow))] shrink-0" title="Has heavy patient - electric stretcher needed">
              <Zap className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasActiveLink && (
            <span title="Crew share link active for this date" className="flex items-center gap-0.5 text-[hsl(var(--status-green))]">
              <Link2 className="h-3 w-3" />
            </span>
          )}
          {!isDown && (
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${utilizationColor(tLegs.length)}`}>
              {tLegs.length} runs
            </span>
          )}
        </div>
      </div>

      {/* Down warning */}
      {isDown && (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <div className="flex items-center gap-1 font-semibold">
            <WrenchIcon className="h-3 w-3" />
            Truck unavailable
            {downRecord!.reason && ` — ${downRecord!.reason}`}
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

      {/* Drop zone + sortable leg list */}
      <div ref={setDropRef} className="mb-2 min-h-[2rem]">
        {tLegs.length > 0 ? (
          <div className={`space-y-1.5 rounded-md transition-colors duration-150 ${isOver && !isDown ? "bg-primary/3" : ""}`}>
            <SortableContext items={tLegs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {tLegs.map((leg) => (
                <SortableLegItem
                  key={leg.id}
                  leg={leg}
                  onRemove={() => onRemoveLeg(leg.id)}
                  onEditException={() => onEditException(leg)}
                />
              ))}
            </SortableContext>
            {isOver && !isDown && (
              <div className="rounded-md border-2 border-dashed border-primary/40 px-2 py-1.5 text-center text-[10px] text-primary/70">
                Drop to add here
              </div>
            )}
          </div>
        ) : (
          <TruckDropZone truckId={truck.id} isEmpty />
        )}
      </div>

      {/* Manual add leg selector */}
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
            <Button size="sm" className="h-8" onClick={() => addingLeg.legId && onAssignLeg(truck.id, addingLeg.legId)}>Add</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingLeg(null)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddingLeg({ truckId: truck.id, legId: "" })}>
            <Plus className="mr-1 h-3 w-3" /> Add Leg
          </Button>
        )
      )}

      {/* Blocked message for down trucks with no runs */}
      {isDown && tLegs.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">Truck blocked — cannot assign runs while down</p>
      )}
    </div>
  );
});
