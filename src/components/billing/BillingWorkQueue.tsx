import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Clock, FileWarning, DollarSign,
  ArrowRight, ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDenialTranslation, isRecoverable } from "@/lib/denial-code-translations";

/* ---------- types ---------- */
export interface WorkItem {
  id: string;
  priority: number;
  label: string;
  patientName: string;
  secondary: string; // payer or truck
  date: string;
  amount: number;
  extra?: string; // days remaining, denial code, etc.
  extraColor?: string;
  type: "claim" | "trip" | "pcr";
  claimId?: string;
  tripId?: string;
}

const PRIORITY_CONFIG: Record<number, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  1: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  2: { icon: FileWarning, color: "text-destructive", bg: "bg-destructive/10" },
  3: { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
  4: { icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  5: { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
  6: { icon: ClipboardList, color: "text-muted-foreground", bg: "bg-muted" },
};

interface BillingWorkQueueProps {
  onOpenClaim?: (claimId: string) => void;
  refreshKey?: number;
}

export function BillingWorkQueue({ onOpenClaim, refreshKey }: BillingWorkQueueProps) {
  const { activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkItems = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);

    const allItems: WorkItem[] = [];

    // ---- Fetch claims (submitted, denied, needs_correction) ----
    const { data: claims } = await supabase
      .from("claim_records")
      .select("id, trip_id, payer_name, payer_type, run_date, total_charge, status, submitted_at, denial_code, patient_id, company_id")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false)
      .in("status", ["submitted", "denied", "needs_correction"] as any)
      .order("run_date", { ascending: true });

    // ---- Fetch trips ready_for_billing with no claim ----
    const { data: readyTrips } = await supabase
      .from("trip_records" as any)
      .select("id, patient_id, truck_id, run_date, company_id, status, pcr_status")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false)
      .eq("status", "ready_for_billing");

    // ---- Fetch PCR incomplete trips ----
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const { data: pcrTrips } = await supabase
      .from("trip_records" as any)
      .select("id, patient_id, truck_id, run_date, company_id, status, pcr_status")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false)
      .eq("status", "completed")
      .gte("run_date", ninetyDaysAgo.toISOString().split("T")[0]);

    // ---- Gather patient IDs and truck IDs ----
    const patientIds = new Set<string>();
    const truckIds = new Set<string>();

    for (const c of claims ?? []) { if (c.patient_id) patientIds.add(c.patient_id); }
    for (const t of [...(readyTrips ?? []), ...(pcrTrips ?? [])]) {
      if ((t as any).patient_id) patientIds.add((t as any).patient_id);
      if ((t as any).truck_id) truckIds.add((t as any).truck_id);
    }

    // ---- Batch lookups ----
    const [patientsRes, trucksRes, notesRes, claimTripsRes, chargeRes] = await Promise.all([
      patientIds.size > 0
        ? supabase.from("patients").select("id, first_name, last_name").in("id", [...patientIds])
        : Promise.resolve({ data: [] }),
      truckIds.size > 0
        ? supabase.from("trucks").select("id, unit_number").in("id", [...truckIds])
        : Promise.resolve({ data: [] }),
      supabase.from("ar_followup_notes")
        .select("claim_id, created_at")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false }),
      // Check which ready trips already have claims
      (readyTrips ?? []).length > 0
        ? supabase.from("claim_records").select("trip_id").eq("company_id", activeCompanyId).in("trip_id", (readyTrips ?? []).map((t: any) => t.id))
        : Promise.resolve({ data: [] }),
      supabase.from("charge_master").select("base_rate, payer_type").eq("company_id", activeCompanyId),
    ]);

    const patientMap: Record<string, string> = {};
    for (const p of patientsRes.data ?? []) patientMap[p.id] = `${p.first_name} ${p.last_name}`;

    const truckMap: Record<string, string> = {};
    for (const t of (trucksRes.data ?? []) as any[]) truckMap[t.id] = t.unit_number ?? "Truck";

    // Latest note per claim
    const latestNoteMap: Record<string, Date> = {};
    for (const n of (notesRes.data ?? []) as any[]) {
      if (!latestNoteMap[n.claim_id]) latestNoteMap[n.claim_id] = new Date(n.created_at);
    }

    const tripsWithClaims = new Set((claimTripsRes.data ?? []).map((c: any) => c.trip_id));

    const defaultRate = (chargeRes.data ?? []).find((r: any) => r.payer_type === "default")?.base_rate ?? 0;

    // ---- Fetch payer directory for timely filing ----
    const { data: payerDir } = await supabase
      .from("payer_directory")
      .select("payer_type, timely_filing_days")
      .eq("company_id", activeCompanyId);
    const filingMap: Record<string, number> = {};
    for (const p of payerDir ?? []) {
      if (p.payer_type) filingMap[p.payer_type.toLowerCase()] = p.timely_filing_days ?? 365;
    }

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    // ---- Process claims ----
    for (const c of claims ?? []) {
      const daysOut = c.submitted_at
        ? Math.floor((now - new Date(c.submitted_at).getTime()) / dayMs)
        : 0;

      const lastNote = latestNoteMap[c.id];
      const daysSinceNote = lastNote ? Math.floor((now - lastNote.getTime()) / dayMs) : 9999;

      const filingLimit = filingMap[(c.payer_type ?? "").toLowerCase()] ?? 365;
      const dosDate = new Date(c.run_date);
      const filingDeadline = new Date(dosDate.getTime() + filingLimit * dayMs);
      const daysToDeadline = Math.floor((filingDeadline.getTime() - now) / dayMs);

      const patientName = patientMap[c.patient_id ?? ""] ?? "Unknown";

      // Priority 1 — Timely filing risk
      if (daysToDeadline <= 30 && (c.status === "submitted" || c.status === "needs_correction")) {
        allItems.push({
          id: `tf-${c.id}`,
          priority: 1,
          label: "Filing Deadline",
          patientName,
          secondary: c.payer_name ?? "Unknown Payer",
          date: c.run_date,
          amount: c.total_charge ?? 0,
          extra: `${daysToDeadline} days left`,
          extraColor: "text-destructive",
          type: "claim",
          claimId: c.id,
        });
        continue; // don't double-list
      }

      // Priority 2 — Unworked denials
      if (c.status === "denied" && c.denial_code && isRecoverable(c.denial_code) && daysSinceNote > 14) {
        const translation = getDenialTranslation(c.denial_code);
        allItems.push({
          id: `den-${c.id}`,
          priority: 2,
          label: "Denied — Action Required",
          patientName,
          secondary: c.payer_name ?? "Unknown Payer",
          date: c.run_date,
          amount: c.total_charge ?? 0,
          extra: `${c.denial_code}: ${translation?.plain_english_explanation ?? "Unknown denial"}`,
          extraColor: "text-destructive",
          type: "claim",
          claimId: c.id,
        });
        continue;
      }

      // Priority 3 — 45+ days no response
      if (c.status === "submitted" && daysOut >= 45 && daysSinceNote > 7) {
        allItems.push({
          id: `45d-${c.id}`,
          priority: 3,
          label: "No Response — 45+ Days",
          patientName,
          secondary: c.payer_name ?? "Unknown Payer",
          date: c.run_date,
          amount: c.total_charge ?? 0,
          extra: `${daysOut} days outstanding`,
          type: "claim",
          claimId: c.id,
        });
        continue;
      }

      // Priority 5 — 14-44 day follow-up
      if (c.status === "submitted" && daysOut >= 14 && daysOut < 45 && daysSinceNote > 7) {
        allItems.push({
          id: `14d-${c.id}`,
          priority: 5,
          label: "Follow Up",
          patientName,
          secondary: c.payer_name ?? "Unknown Payer",
          date: c.run_date,
          amount: c.total_charge ?? 0,
          extra: `${daysOut} days outstanding`,
          type: "claim",
          claimId: c.id,
        });
      }
    }

    // ---- Priority 4 — Ready to bill ----
    for (const t of readyTrips ?? []) {
      const trip = t as any;
      if (tripsWithClaims.has(trip.id)) continue;
      allItems.push({
        id: `rtb-${trip.id}`,
        priority: 4,
        label: "Ready to Bill",
        patientName: patientMap[trip.patient_id] ?? "Unknown",
        secondary: truckMap[trip.truck_id] ?? "—",
        date: trip.run_date,
        amount: Number(defaultRate) || 0,
        type: "trip",
        tripId: trip.id,
      });
    }

    // ---- Priority 6 — PCR incomplete ----
    for (const t of pcrTrips ?? []) {
      const trip = t as any;
      if (trip.pcr_status === "submitted" || trip.pcr_status === "complete") continue;
      allItems.push({
        id: `pcr-${trip.id}`,
        priority: 6,
        label: "PCR Incomplete",
        patientName: patientMap[trip.patient_id] ?? "Unknown",
        secondary: truckMap[trip.truck_id] ?? "—",
        date: trip.run_date,
        amount: 0,
        type: "pcr",
        tripId: trip.id,
      });
    }

    // Sort: priority asc, then amount desc
    allItems.sort((a, b) => a.priority - b.priority || b.amount - a.amount);
    setItems(allItems);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchWorkItems(); }, [fetchWorkItems, refreshKey]);

  const totalAtRisk = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  const handleAction = (item: WorkItem) => {
    if (item.type === "claim" && item.claimId) {
      // If parent provided an in-page handler (AR Command Center), let it open the sheet inline.
      if (onOpenClaim) {
        onOpenClaim(item.claimId);
      } else {
        navigate(`/billing?claimId=${item.claimId}`);
      }
    } else if (item.type === "trip" && item.tripId) {
      navigate("/billing?tab=trip-queue");
    } else if (item.type === "pcr" && item.tripId) {
      navigate(`/pcr?tripId=${item.tripId}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm">No items need attention today.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary line */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span>
          {items.length} item{items.length !== 1 ? "s" : ""} need attention today
          {totalAtRisk > 0 && (
            <> — <span className="text-destructive font-bold">${totalAtRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> at risk</>
          )}
        </span>
      </div>

      {/* Work items list */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {items.map(item => {
            const cfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG[6];
            const Icon = cfg.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
              >
                {/* Priority badge */}
                <div className={`shrink-0 rounded-md p-2 ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={item.priority <= 2 ? "destructive" : item.priority <= 3 ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      P{item.priority}
                    </Badge>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">{item.patientName}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{item.secondary}</span>
                    <span>{item.date}</span>
                    {item.extra && (
                      <span className={item.extraColor ?? ""}>{item.extra}</span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                {item.amount > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                )}

                {/* Action */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => handleAction(item)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
