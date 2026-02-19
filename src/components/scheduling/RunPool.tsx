import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronRight, ChevronUp, GripVertical, Zap, Clock,
  ArrowRight, Trash2, Pencil, GitBranch, ArrowLeft, X,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { LegDisplay } from "@/hooks/useSchedulingStore";

/* ── transport type helpers ── */
const TRANSPORT_LABELS: Record<string, string> = {
  dialysis: "Dialysis",
  outpatient: "Outpatient",
  adhoc: "Ad-hoc / Other",
};

function getTransportGroup(tripType: string): string {
  if (tripType === "dialysis") return "dialysis";
  if (tripType === "outpatient") return "outpatient";
  return "adhoc";
}

/* ── compact draggable card ── */
function PoolCard({
  leg, onDelete, onEditException,
}: {
  leg: LegDisplay;
  onDelete: () => void;
  onEditException: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: leg.id,
    data: { type: "pool-leg", leg },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  const isHeavy = (leg.patient_weight ?? 0) > 200;
  const isInactive = leg.patient_status !== "active";
  const shortFrom = leg.pickup_location.length > 22 ? leg.pickup_location.slice(0, 22) + "…" : leg.pickup_location;
  const shortTo = leg.destination_location.length > 22 ? leg.destination_location.slice(0, 22) + "…" : leg.destination_location;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs transition-shadow ${
        isInactive ? "opacity-60 border-dashed" : ""
      } ${leg.has_exception ? "border-primary/40" : ""} ${
        isDragging ? "shadow-xl ring-1 ring-primary/40" : "hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      {/* drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        tabIndex={-1}
        title="Drag to a truck"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* leg type badge */}
      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
        leg.leg_type === "A"
          ? "bg-primary/10 text-primary"
          : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
      }`}>
        {leg.leg_type}
      </span>

      {/* patient name */}
      <span className="font-medium text-card-foreground truncate min-w-0 flex-1">{leg.patient_name}</span>

      {/* time */}
      {leg.pickup_time && (
        <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {leg.pickup_time}
        </span>
      )}

      {/* from → to */}
      <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
        <span className="max-w-[90px] truncate">{shortFrom}</span>
        <ArrowRight className="h-2.5 w-2.5 shrink-0" />
        <span className="max-w-[90px] truncate">{shortTo}</span>
      </span>

      {/* flags */}
      {isHeavy && <span title="⚡ Heavy patient"><Zap className="h-3 w-3 text-[hsl(var(--status-yellow))] shrink-0" /></span>}
      {leg.has_exception && <span title="Exception override"><GitBranch className="h-3 w-3 text-primary shrink-0" /></span>}
      {isInactive && <span className="text-[hsl(var(--status-red))] shrink-0 text-[9px] font-bold">!</span>}

      {/* actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEditException} title="Edit this run only">
          <Pencil className="h-2.5 w-2.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onDelete}>
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── collapsible group section ── */
function GroupSection({
  label, count, children, defaultOpen = false,
}: {
  label: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold bg-muted/40 hover:bg-muted/70 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
      </button>
      {open && (
        <div className="p-2 space-y-1.5 bg-card">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── paginated list: "Show more" instead of virtualizing ── */
const PAGE_SIZE = 25;

function PaginatedList({ legs, onDelete, onEditException }: {
  legs: LegDisplay[];
  onDelete: (id: string) => void;
  onEditException: (leg: LegDisplay) => void;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = legs.slice(0, shown);
  return (
    <>
      {visible.map(leg => (
        <PoolCard
          key={leg.id}
          leg={leg}
          onDelete={() => onDelete(leg.id)}
          onEditException={() => onEditException(leg)}
        />
      ))}
      {legs.length > shown && (
        <button
          className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 border-t border-dashed mt-1"
          onClick={() => setShown(s => s + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, legs.length - shown)} more of {legs.length - shown} remaining…
        </button>
      )}
    </>
  );
}

/* ── main RunPool component ── */
export interface RunPoolProps {
  unassigned: LegDisplay[];
  onDelete: (id: string) => void;
  onEditException: (leg: LegDisplay) => void;
}

type SortMode = "time" | "destination";
type LegFilter = "all" | "A" | "B";
type TypeFilter = "all" | "dialysis" | "outpatient" | "adhoc";
type AssignMode = { transport: string; leg: LegFilter } | null;

export function RunPool({ unassigned, onDelete, onEditException }: RunPoolProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [legFilter, setLegFilter] = useState<LegFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [assignMode, setAssignMode] = useState<AssignMode>(null);

  // ── droppable zone for the whole panel (unassign by drop) ──
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "pool-droppable",
    data: { type: "pool" },
  });

  // ── summary counts ──
  const aCount = unassigned.filter(l => l.leg_type === "A").length;
  const bCount = unassigned.filter(l => l.leg_type === "B").length;
  const flagCount = unassigned.filter(l =>
    l.patient_status !== "active" || l.has_exception
  ).length;

  // ── filtered + sorted pool ──
  const filtered = useMemo(() => {
    let list = unassigned;

    // assign mode narrows to one transport + leg type
    if (assignMode) {
      list = list.filter(l =>
        getTransportGroup(l.trip_type) === assignMode.transport &&
        (assignMode.leg === "all" || l.leg_type === assignMode.leg)
      );
    } else {
      if (typeFilter !== "all") list = list.filter(l => getTransportGroup(l.trip_type) === typeFilter);
      if (legFilter !== "all") list = list.filter(l => l.leg_type === legFilter);
    }

    if (search) list = list.filter(l => l.patient_name.toLowerCase().includes(search.toLowerCase()));

    // sort
    return [...list].sort((a, b) => {
      if (sortMode === "time") {
        if (!a.pickup_time && !b.pickup_time) return 0;
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      }
      return a.destination_location.localeCompare(b.destination_location);
    });
  }, [unassigned, search, legFilter, typeFilter, sortMode, assignMode]);

  // Group filtered runs by transport type, then leg type
  const groups = useMemo(() => {
    const transportGroups: Record<string, { A: LegDisplay[]; B: LegDisplay[] }> = {};
    for (const leg of filtered) {
      const tg = getTransportGroup(leg.trip_type);
      if (!transportGroups[tg]) transportGroups[tg] = { A: [], B: [] };
      if (leg.leg_type === "A") transportGroups[tg].A.push(leg);
      else transportGroups[tg].B.push(leg);
    }
    return transportGroups;
  }, [filtered]);

  const transportOrder = ["dialysis", "outpatient", "adhoc"].filter(t => groups[t]);

  return (
    <section
      ref={setDropRef}
      className={`relative rounded-lg border bg-card transition-all duration-150 ${
        isOver
          ? "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
          : "border-border"
      }`}
    >
      {/* ── DROP HINT overlay when dragging over ── */}
      {isOver && (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pointer-events-none pt-2">
          <div className="rounded-md border-2 border-dashed border-primary/60 bg-primary/10 px-4 py-2 text-xs text-primary font-semibold shadow-lg">
            ↩ Drop here to return to pool
          </div>
        </div>
      )}

      {/* ── HEADER (always visible) ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Unassigned Run Pool
          </span>
          <Badge variant="secondary" className="text-xs">{unassigned.length} total</Badge>
          <span className="text-xs text-muted-foreground">
            A:{aCount} · B:{bCount}
          </span>
          {flagCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-[hsl(var(--status-yellow))]/50 text-[hsl(var(--status-yellow))] bg-[hsl(var(--status-yellow-bg))]">
              ⚠ {flagCount} needs attention
            </Badge>
          )}
          {unassigned.length === 0 && (
            <span className="text-xs text-muted-foreground italic">All assigned ✓</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* ── EXPANDED BODY ── */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">

          {/* Assign Mode breadcrumb */}
          {assignMode && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5">
              <button
                onClick={() => setAssignMode(null)}
                className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
              >
                <ArrowLeft className="h-3 w-3" /> Run Pool
              </button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-semibold">{TRANSPORT_LABELS[assignMode.transport] ?? assignMode.transport}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-semibold">
                {assignMode.leg === "all" ? "All legs" : `${assignMode.leg}-legs`}
              </span>
              <button onClick={() => setAssignMode(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Filter bar */}
          {!assignMode && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search patient…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 text-xs max-w-[180px]"
              />
              {/* Leg toggle */}
              <div className="flex rounded-md border overflow-hidden text-[11px] font-medium">
                {(["all", "A", "B"] as LegFilter[]).map(v => (
                  <button
                    key={v}
                    className={`px-2 py-1 transition-colors ${legFilter === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setLegFilter(v)}
                  >
                    {v === "all" ? "A+B" : v}
                  </button>
                ))}
              </div>
              {/* Type toggle */}
              <div className="flex rounded-md border overflow-hidden text-[11px] font-medium">
                {([
                  ["all", "All"],
                  ["dialysis", "Dialysis"],
                  ["outpatient", "Outpatient"],
                  ["adhoc", "Other"],
                ] as [TypeFilter, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    className={`px-2 py-1 transition-colors ${typeFilter === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setTypeFilter(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                <span>Sort:</span>
                <button
                  className={`px-2 py-1 rounded border text-[11px] ${sortMode === "time" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
                  onClick={() => setSortMode("time")}
                >Time</button>
                <button
                  className={`px-2 py-1 rounded border text-[11px] ${sortMode === "destination" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
                  onClick={() => setSortMode("destination")}
                >Destination</button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {unassigned.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              All runs assigned — drag from trucks here to unassign, or use Auto-Fill to generate today's runs.
            </p>
          )}

          {/* ── ASSIGN MODE: flat single-group list ── */}
          {assignMode && filtered.length > 0 && (
            <div className="space-y-1.5">
              <PaginatedList legs={filtered} onDelete={onDelete} onEditException={onEditException} />
            </div>
          )}

          {/* ── NORMAL MODE: grouped by transport → leg type ── */}
          {!assignMode && transportOrder.length > 0 && (
            <div className="space-y-2">
              {transportOrder.map(transport => {
                const grp = groups[transport];
                const total = grp.A.length + grp.B.length;
                return (
                  <GroupSection
                    key={transport}
                    label={TRANSPORT_LABELS[transport] ?? transport}
                    count={total}
                    defaultOpen={transportOrder.length === 1 || total <= 10}
                  >
                    <div className="space-y-1.5">
                      {/* Quick Assign Mode button */}
                      <div className="flex gap-1.5 mb-2 flex-wrap">
                        {grp.A.length > 0 && (
                          <button
                            className="text-[10px] rounded border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 hover:bg-primary/15 transition-colors"
                            onClick={() => setAssignMode({ transport, leg: "A" })}
                          >
                            Focus A-legs ({grp.A.length})
                          </button>
                        )}
                        {grp.B.length > 0 && (
                          <button
                            className="text-[10px] rounded border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] px-2 py-0.5 hover:opacity-80 transition-colors"
                            onClick={() => setAssignMode({ transport, leg: "B" })}
                          >
                            Focus B-legs ({grp.B.length})
                          </button>
                        )}
                      </div>

                      {/* A sub-group */}
                      {grp.A.length > 0 && (
                        <GroupSection label="A-Legs" count={grp.A.length} defaultOpen={grp.A.length <= 15}>
                          <PaginatedList legs={grp.A} onDelete={onDelete} onEditException={onEditException} />
                        </GroupSection>
                      )}

                      {/* B sub-group */}
                      {grp.B.length > 0 && (
                        <GroupSection label="B-Legs" count={grp.B.length} defaultOpen={grp.B.length <= 15}>
                          <PaginatedList legs={grp.B} onDelete={onDelete} onEditException={onEditException} />
                        </GroupSection>
                      )}
                    </div>
                  </GroupSection>
                );
              })}
            </div>
          )}

          {/* Search no-results */}
          {(assignMode || (!assignMode && transportOrder.length === 0)) && filtered.length === 0 && unassigned.length > 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">No legs match the current filters.</p>
          )}
        </div>
      )}
    </section>
  );
}
