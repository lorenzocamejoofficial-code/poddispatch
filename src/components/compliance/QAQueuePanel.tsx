import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck, AlertTriangle, AlertCircle, ExternalLink, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { checkTrip, type QAFlag, type TripForQA } from "@/lib/qa-anomaly-checks";
import { FlagOverrideDialog } from "./FlagOverrideDialog";
import { logAuditEvent } from "@/lib/audit-logger";

interface EnrichedQAReview {
  id: string;
  trip_id: string;
  flag_reason: string;
  status: string;
  severity: string;
  flag_type: string | null;
  qa_notes: string | null;
  created_at: string;
  patient_name: string;
  run_date: string;
  truck_name: string;
}

export function QAQueuePanel() {
  const [qaItems, setQaItems] = useState<EnrichedQAReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [overrideItem, setOverrideItem] = useState<EnrichedQAReview | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: qaRows } = await supabase
      .from("qa_reviews" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!qaRows || qaRows.length === 0) {
      setQaItems([]);
      setLoading(false);
      return;
    }

    const tripIds = [...new Set((qaRows as any[]).map((q: any) => q.trip_id).filter(Boolean))];
    const { data: tripRows } = tripIds.length > 0
      ? await supabase
          .from("trip_records" as any)
          .select("id, run_date, truck_id, patient:patients!trip_records_patient_id_fkey(first_name, last_name)")
          .in("id", tripIds)
      : { data: [] };

    const tripMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));
    const truckIds = [...new Set((tripRows ?? []).map((t: any) => t.truck_id).filter(Boolean))];
    const { data: truckRows } = truckIds.length > 0
      ? await supabase.from("trucks").select("id, name").in("id", truckIds)
      : { data: [] };
    const truckMap = new Map((truckRows ?? []).map((t: any) => [t.id, t.name]));

    setQaItems(
      (qaRows as any[]).map((q: any) => {
        const t = tripMap.get(q.trip_id) as any;
        return {
          ...q,
          severity: q.severity ?? "yellow",
          patient_name: t?.patient ? `${t.patient.first_name} ${t.patient.last_name}` : "Unknown",
          run_date: t?.run_date ?? "—",
          truck_name: t?.truck_id ? (truckMap.get(t.truck_id) ?? "—") : "—",
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAutoFlag = async () => {
    setFlagging(true);
    try {
      const { data: trips } = await supabase
        .from("trip_records" as any)
        .select("id, company_id, run_date, patient_id, dispatch_time, at_scene_time, left_scene_time, arrived_dropoff_at, in_service_time, patient_contact_time, loaded_miles, odometer_at_scene, odometer_at_destination, bed_confined, cannot_transfer_safely, requires_monitoring, oxygen_during_transport, signatures_json, truck_id, status")
        .in("status", ["completed", "ready_for_billing"]);

      if (!trips || trips.length === 0) {
        toast.info("No completed trips to check");
        setFlagging(false);
        return;
      }

      const { data: companyId } = await supabase.rpc("get_my_company_id");

      // Clear old pending auto-flags
      await supabase
        .from("qa_reviews" as any)
        .delete()
        .eq("company_id", companyId)
        .eq("status", "pending")
        .not("flag_type", "is", null);

      // Fetch related data
      const patientIds = [...new Set((trips as any[]).map((t: any) => t.patient_id).filter(Boolean))];
      const { data: patients } = patientIds.length > 0
        ? await supabase.from("patients").select("id, primary_payer, pcs_on_file, pcs_expiration_date").in("id", patientIds)
        : { data: [] };
      const patientMap = new Map((patients ?? []).map((p: any) => [p.id, p]));

      const { data: payerRules } = await supabase.from("payer_billing_rules" as any).select("payer_type, requires_pcs");

      // Compute weekly counts per patient
      const weeklyBuckets = new Map<string, number>();
      for (const trip of trips as any[]) {
        if (!trip.patient_id) continue;
        const rd = new Date(trip.run_date);
        const day = rd.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const ws = new Date(rd);
        ws.setDate(rd.getDate() + mondayOffset);
        const key = `${trip.patient_id}_${ws.toISOString().slice(0, 10)}`;
        weeklyBuckets.set(key, (weeklyBuckets.get(key) ?? 0) + 1);
      }

      const allFlags: QAFlag[] = [];
      for (const trip of trips as any[]) {
        const patient = trip.patient_id ? patientMap.get(trip.patient_id) ?? null : null;
        const weeklyCount = new Map<string, number>();
        if (trip.patient_id) {
          const rd = new Date(trip.run_date);
          const day = rd.getDay();
          const mondayOffset = day === 0 ? -6 : 1 - day;
          const ws = new Date(rd);
          ws.setDate(rd.getDate() + mondayOffset);
          const key = `${trip.patient_id}_${ws.toISOString().slice(0, 10)}`;
          const total = weeklyBuckets.get(key) ?? 0;
          weeklyCount.set(trip.patient_id, total - 1);
        }
        allFlags.push(...checkTrip(trip as TripForQA, patient, (payerRules ?? []) as any[], weeklyCount));
      }

      if (allFlags.length > 0) {
        for (let i = 0; i < allFlags.length; i += 100) {
          await supabase.from("qa_reviews" as any).insert(allFlags.slice(i, i + 100));
        }
        toast.success(`Flagged ${allFlags.length} issue(s) across ${new Set(allFlags.map(f => f.trip_id)).size} trip(s)`);
      } else {
        toast.info("No issues found — all trips passed QA checks");
      }
      fetchData();
    } catch (err) {
      console.error("Auto-flag error:", err);
      toast.error("Auto-flag scan failed");
    }
    setFlagging(false);
  };

  const handleOverride = async (reason: string) => {
    if (!overrideItem) return;
    await supabase.from("qa_reviews" as any).update({
      status: "overridden",
      qa_notes: reason,
      reviewed_at: new Date().toISOString(),
    }).eq("id", overrideItem.id);

    await logAuditEvent({
      action: "duplicate_override",
      tableName: "qa_reviews",
      recordId: overrideItem.id,
      newData: { status: "overridden", reason, flag_type: overrideItem.flag_type, flag_reason: overrideItem.flag_reason },
      notes: `QA flag overridden: ${overrideItem.flag_reason} — Reason: ${reason}`,
    });

    toast.success("Flag overridden and logged to audit trail");
    setOverrideItem(null);
    fetchData();
  };

  const getFixRoute = (item: EnrichedQAReview): string => {
    if (item.flag_type === "pcs_missing_expired") return "/patients";
    if (item.flag_type === "weekly_transport_limit") return "/trips";
    return `/pcr?tripId=${item.trip_id}`;
  };

  const redPending = qaItems.filter(q => q.status === "pending" && q.severity === "red");
  const yellowPending = qaItems.filter(q => q.status === "pending" && q.severity === "yellow");
  const reviewed = qaItems.filter(q => q.status !== "pending");
  const totalPending = redPending.length + yellowPending.length;

  if (loading) return <PageLoader label="Loading QA reviews…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {redPending.length > 0 && (
            <Badge variant="destructive" className="text-xs">{redPending.length} Red</Badge>
          )}
          {yellowPending.length > 0 && (
            <Badge className="bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] text-xs">{yellowPending.length} Yellow</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={runAutoFlag} disabled={flagging}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
          {flagging ? "Scanning…" : "Run Auto-Flag"}
        </Button>
      </div>

      {totalPending === 0 && reviewed.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No QA items"
          description="Run Auto-Flag to check completed trips for documentation and consistency issues."
        />
      ) : (
        <>
          {redPending.length > 0 && (
            <FlagSection
              title="Red Flags — Billing Blocked"
              items={redPending}
              severity="red"
              onFix={item => navigate(getFixRoute(item))}
              onOverride={setOverrideItem}
            />
          )}
          {yellowPending.length > 0 && (
            <FlagSection
              title="Yellow Flags — Review Required"
              items={yellowPending}
              severity="yellow"
              onFix={item => navigate(getFixRoute(item))}
              onOverride={setOverrideItem}
            />
          )}
          {reviewed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolved ({reviewed.length})</p>
              {reviewed.map(item => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{item.patient_name}</p>
                    <p className="text-xs text-muted-foreground">{item.run_date} · {item.flag_reason}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                    {item.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <FlagOverrideDialog
        open={!!overrideItem}
        onOpenChange={o => { if (!o) setOverrideItem(null); }}
        flagReason={overrideItem?.flag_reason ?? ""}
        onOverride={handleOverride}
      />
    </div>
  );
}

function FlagSection({ title, items, severity, onFix, onOverride }: {
  title: string;
  items: EnrichedQAReview[];
  severity: "red" | "yellow";
  onFix: (item: EnrichedQAReview) => void;
  onOverride: (item: EnrichedQAReview) => void;
}) {
  const Icon = severity === "red" ? AlertCircle : AlertTriangle;
  const iconColor = severity === "red" ? "text-destructive" : "text-[hsl(var(--status-yellow))]";
  const cardClass = severity === "red"
    ? "bg-destructive/5 border-destructive/20"
    : "bg-[hsl(var(--status-yellow-bg))]/30 border-[hsl(var(--status-yellow))]/20";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title} ({items.length})</p>
      {items.map(item => (
        <div key={item.id} className={`rounded-lg border p-4 space-y-2 ${cardClass}`}>
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{item.patient_name}</span>
                <span className="text-xs text-muted-foreground">{item.run_date}</span>
                {item.truck_name !== "—" && <span className="text-xs text-muted-foreground">· {item.truck_name}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{item.flag_reason}</p>
            </div>
          </div>
          <div className="flex gap-2 pl-8">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFix(item)}>
              <ExternalLink className="h-3 w-3 mr-1" />Fix
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOverride(item)}>
              <ShieldOff className="h-3 w-3 mr-1" />Override
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
