import type { RunAcceptance } from "@/lib/run-acceptance";
import type { IntakeTimingSummary } from "@/lib/intake-impact";
import { cn } from "@/lib/utils";

const TIER = { 1: "T1", 2: "T2", 3: "T3" } as const;

export function IntakeImpactCard({ result, truckName, onClose }: {
  result: (RunAcceptance & { geoPairsSkipped?: boolean; timing?: IntakeTimingSummary }) | null;
  truckName: (id: string) => string;
  onClose: () => void;
}) {
  if (!result) return null;
  const ok = result.coverable;
  const best = result.leastBadTruck;
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border px-3 py-2 text-xs space-y-1",
        ok
          ? "border-[hsl(var(--status-green))]/40 bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]"
          : "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
      )}
    >
      <div className="flex items-center justify-between font-semibold">
        <span>Impact check (advisory)</span>
        <button type="button" className="underline opacity-80" onClick={onClose}>Clear</button>
      </div>
      <div><span className="font-medium">Coverable:</span>{" "}
        {ok ? "Yes — a crewed truck can take it cleanly." : best ? "Only by delaying other runs." : "No crewed truck can take this."}
      </div>
      <div><span className="font-medium">Pushes late:</span>{" "}
        {best && best.breaks.length
          ? best.breaks.map((b) => `${b.label} (${TIER[b.tier]})${b.howLateMin != null ? ` +${b.howLateMin} min` : " — time unknown"}`).join("; ")
          : "nothing"}
      </div>
      <div><span className="font-medium">Least-bad truck:</span>{" "}
        {best ? `${truckName(best.truckId)} — ${best.reasons[0] ?? ""}` : "none"}
      </div>
      {result.runShouldYield && <div>This flexible run should yield to higher-priority runs.</div>}
      {result.timing && (
        <div className="opacity-90">
          <span className="font-medium">How times were estimated:</span>{" "}
          {result.timing.trips.map((t) => `${t.label}: ${t.trip === "history" ? `from this patient's history (${t.n} trips)` : "default trip length"}`).join("; ")}
          {"; gaps: "}{result.timing.gap === "distance" ? "estimated from distance" : "default gap"}
        </div>
      )}
      {result.timing?.readiness.map((r) => <div key={r.legId}>{r.message}</div>)}
      {result.geoPairsSkipped && <div className="opacity-80">Travel time not yet counted for some facility stops — check again shortly.</div>}
    </div>
  );
}
