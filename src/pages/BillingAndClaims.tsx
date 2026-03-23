import { useEffect, useState, useCallback } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, AlertTriangle, CheckCircle, XCircle, RefreshCw, Settings2, ClipboardList, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CleanTripBadge } from "@/components/billing/CleanTripBadge";
import { BillingQueueView } from "@/components/billing/BillingQueueView";
import { computeHcpcsCodes, computeCleanTripStatus } from "@/lib/billing-utils";
import { useSimulationSession } from "@/hooks/useSimulationSession";

type ClaimStatus = "ready_to_bill" | "submitted" | "paid" | "denied" | "needs_correction" | "needs_review";

interface ClaimRecord {
  id: string;
  trip_id: string;
  patient_id: string;
  run_date: string;
  payer_type: string;
  payer_name: string | null;
  member_id: string | null;
  base_charge: number;
  mileage_charge: number;
  extras_charge: number;
  total_charge: number;
  amount_paid: number | null;
  denial_reason: string | null;
  denial_code: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  paid_at: string | null;
  notes: string | null;
  origin_type: string | null;
  destination_type: string | null;
  hcpcs_codes: string[] | null;
  hcpcs_modifiers: string[] | null;
  // joined
  patient_name?: string;
  // trip data for badge
  trip_loaded_miles?: number | null;
  trip_signature?: boolean;
  trip_pcs?: boolean;
}

interface ChargeMaster {
  id: string;
  payer_type: string;
  base_rate: number;
  mileage_rate: number;
  wait_rate_per_min: number;
  oxygen_fee: number;
  extra_attendant_fee: number;
  bariatric_fee: number;
}

const CLAIM_COLUMNS: { status: ClaimStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "ready_to_bill", label: "Ready to Bill", icon: <DollarSign className="h-4 w-4" />, color: "border-primary/30 bg-primary/5" },
  { status: "submitted", label: "Submitted", icon: <RefreshCw className="h-4 w-4" />, color: "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]" },
  { status: "paid", label: "Paid", icon: <CheckCircle className="h-4 w-4" />, color: "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5" },
  { status: "denied", label: "Denied", icon: <XCircle className="h-4 w-4" />, color: "border-destructive/30 bg-destructive/5" },
  { status: "needs_correction", label: "Needs Correction", icon: <AlertTriangle className="h-4 w-4" />, color: "border-orange-400/30 bg-orange-50 dark:bg-orange-950/20" },
  { status: "needs_review", label: "Needs Review", icon: <ShieldAlert className="h-4 w-4" />, color: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/20" },
];

const PAYER_TYPES = ["default", "medicare", "medicaid", "facility", "cash"];

export default function BillingAndClaims() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [chargeMaster, setChargeMaster] = useState<ChargeMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [editForm, setEditForm] = useState({
    status: "ready_to_bill" as ClaimStatus,
    amount_paid: "", denial_reason: "", denial_code: "", notes: "",
  });
  const [savingClaim, setSavingClaim] = useState(false);
  const [editingRate, setEditingRate] = useState<ChargeMaster | null>(null);
  const [rateForm, setRateForm] = useState({
    payer_type: "default", base_rate: "", mileage_rate: "", wait_rate_per_min: "",
    oxygen_fee: "", extra_attendant_fee: "", bariatric_fee: "",
  });
  const [savingRate, setSavingRate] = useState(false);
  const [addingRate, setAddingRate] = useState(false);
  const [queueTrips, setQueueTrips] = useState<any[]>([]);
  const [payerRulesMap, setPayerRulesMap] = useState<Map<string, any>>(new Map());
  const { selectedDate: sharedDate, setSelectedDate: setSharedDate } = useSchedulingStore();
  const dateFilter = sharedDate;
  const setDateFilter = setSharedDate;
  const [overrideLogs, setOverrideLogs] = useState<any[]>([]);
  const [overrideLogSort, setOverrideLogSort] = useState<"date" | "user" | "reason">("date");
  const { simulationRunId, refreshToken } = useSimulationSession();

  const fetchData = useCallback(async () => {
    setLoading(true);

    let claimsQuery = supabase.from("claim_records" as any).select("*").order("run_date", { ascending: false });
    if (simulationRunId) {
      claimsQuery = claimsQuery.eq("simulation_run_id", simulationRunId);
    }

    const [{ data: claimRows }, { data: rateRows }, { data: payerRules }] = await Promise.all([
      claimsQuery,
      supabase.from("charge_master" as any).select("*").order("payer_type"),
      supabase.from("payer_billing_rules" as any).select("*"),
    ]);

    const prMap = new Map<string, any>();
    (payerRules ?? []).forEach((r: any) => prMap.set(r.payer_type, r));
    setPayerRulesMap(prMap);

    const patientIds = [...new Set(((claimRows ?? []) as any[]).map((c: any) => c.patient_id).filter(Boolean))];
    const tripIds = [...new Set(((claimRows ?? []) as any[]).map((c: any) => c.trip_id).filter(Boolean))];
    const [{ data: pRows }, { data: tripRows }] = await Promise.all([
      patientIds.length > 0
        ? supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
        : Promise.resolve({ data: [] }),
      tripIds.length > 0
        ? supabase.from("trip_records" as any).select("id, loaded_miles, signature_obtained, pcs_attached, origin_type, destination_type").in("id", tripIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pMap = new Map((pRows ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]));
    const tMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));

    setClaims(
      ((claimRows ?? []) as any[]).map((c: any) => {
        const tripData = tMap.get(c.trip_id) as any;
        return {
          ...c,
          patient_name: pMap.get(c.patient_id) ?? "Unknown",
          trip_loaded_miles: tripData?.loaded_miles ?? null,
          trip_signature: tripData?.signature_obtained ?? false,
          trip_pcs: tripData?.pcs_attached ?? false,
        };
      })
    );
    setChargeMaster((rateRows ?? []) as any[]);
    setLoading(false);
  }, [simulationRunId]);

  const fetchQueueTrips = useCallback(async () => {
    let tripQuery = supabase
      .from("trip_records" as any)
      .select("*")
      .eq("run_date", dateFilter)
      .or("status.in.(completed,ready_for_billing),claim_ready.eq.true")
      .order("scheduled_pickup_time");

    if (simulationRunId) {
      tripQuery = tripQuery.eq("simulation_run_id", simulationRunId);
    }

    const { data: tripRows } = await tripQuery;

    if (!tripRows?.length) { setQueueTrips([]); return; }

    const patientIds = [...new Set((tripRows as any[]).map((t: any) => t.patient_id).filter(Boolean))];
    const truckIds = [...new Set((tripRows as any[]).map((t: any) => t.truck_id).filter(Boolean))];

    const [{ data: pRows }, { data: tRows }] = await Promise.all([
      patientIds.length > 0
        ? supabase.from("patients").select("id, first_name, last_name, primary_payer, auth_expiration, auth_required").in("id", patientIds)
        : Promise.resolve({ data: [] }),
      truckIds.length > 0
        ? supabase.from("trucks").select("id, name").in("id", truckIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pMap = new Map((pRows ?? []).map((p: any) => [p.id, p]));
    const tMap = new Map((tRows ?? []).map((t: any) => [t.id, t]));

    setQueueTrips(
      (tripRows as any[]).map((t: any) => {
        const p = pMap.get(t.patient_id) as any;
        const tr = tMap.get(t.truck_id) as any;
        return {
          ...t,
          patient_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
          truck_name: tr?.name ?? "Unassigned",
          payer: p?.primary_payer ?? "—",
          auth_expiration: p?.auth_expiration ?? null,
          auth_required: p?.auth_required ?? false,
        };
      })
    );
  }, [dateFilter, simulationRunId]);

  const fetchOverrideLogs = useCallback(async () => {
    const tripScope = simulationRunId
      ? await supabase.from("trip_records" as any).select("id, patient_id, run_date").eq("simulation_run_id", simulationRunId)
      : { data: [] as any[] };

    const scopedTripIds = simulationRunId ? (tripScope.data ?? []).map((t: any) => t.id) : null;

    let overridesQuery = supabase
      .from("billing_overrides" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (simulationRunId) {
      if (!scopedTripIds?.length) {
        setOverrideLogs([]);
        return;
      }
      overridesQuery = overridesQuery.in("trip_id", scopedTripIds);
    }

    const { data } = await overridesQuery;

    if (!data?.length) { setOverrideLogs([]); return; }

    const tripIds = [...new Set((data as any[]).map((d: any) => d.trip_id).filter(Boolean))];
    const { data: tripRows } = tripIds.length > 0
      ? await supabase.from("trip_records" as any).select("id, patient_id, run_date, truck_id").in("id", tripIds)
      : { data: [] };

    const patientIds = [...new Set((tripRows ?? []).map((t: any) => t.patient_id).filter(Boolean))];
    const { data: pRows } = patientIds.length > 0
      ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
      : { data: [] };

    const tripMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));
    const pMap = new Map((pRows ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]));

    setOverrideLogs((data as any[]).map((o: any) => {
      const trip = tripMap.get(o.trip_id) as any;
      return {
        ...o,
        patient_name: trip ? pMap.get(trip.patient_id) ?? "Unknown" : "Unknown",
        run_date: trip?.run_date ?? "—",
      };
    }));
  }, [simulationRunId]);

  useEffect(() => { fetchData(); fetchQueueTrips(); fetchOverrideLogs(); }, [fetchData, fetchQueueTrips, fetchOverrideLogs]);

  useEffect(() => {
    if (!refreshToken) return;
    setQueueTrips([]);
    setOverrideLogs([]);
    setClaims([]);
    fetchData();
    fetchQueueTrips();
    fetchOverrideLogs();
  }, [refreshToken, fetchData, fetchQueueTrips, fetchOverrideLogs]);

  const syncClaimsFromTrips = async () => {
    const { data: trips } = await supabase
      .from("trip_records" as any)
      .select("*, patient:patients!trip_records_patient_id_fkey(primary_payer, member_id, bariatric, oxygen_required, auth_required, auth_expiration), odometer_at_scene, odometer_at_destination, odometer_in_service, vehicle_id, stretcher_placement, patient_mobility, isolation_precautions")
      .eq("status", "ready_for_billing");

    if (!trips?.length) { toast.info("No new trips ready for billing"); return; }

    const { data: existing } = await supabase.from("claim_records" as any).select("trip_id");
    const existingTripIds = new Set((existing ?? []).map((e: any) => e.trip_id));

    const newTrips = (trips as any[]).filter(t => !existingTripIds.has(t.id));
    if (!newTrips.length) { toast.info("All billing trips already have claims"); return; }

    const cleanClaims: any[] = [];
    const reviewClaims: any[] = [];
    const blockedTrips: { id: string; issues: string[] }[] = [];

    for (const t of newTrips) {
      const payerType = t.patient?.primary_payer ?? "default";
      const payerRules = payerRulesMap.get(payerType) ?? null;
      const authInfo = t.patient ? { auth_required: t.patient.auth_required, auth_expiration: t.patient.auth_expiration } : null;

      // Run clean trip gate
      const gateResult = computeCleanTripStatus(t, payerRules, authInfo);

      if (gateResult.level === "blocked") {
        blockedTrips.push({ id: t.id, issues: gateResult.issues });
        continue;
      }

      const rate = chargeMaster.find(r => r.payer_type === payerType) ?? chargeMaster.find(r => r.payer_type === "default");
      const base = rate?.base_rate ?? 0;
      const miles = Number(t.loaded_miles ?? 0) * Number(rate?.mileage_rate ?? 0);
      const wait = Number(t.wait_time_minutes ?? 0) * Number(rate?.wait_rate_per_min ?? 0);
      const extras = (t.patient?.oxygen_required ? Number(rate?.oxygen_fee ?? 0) : 0)
        + (t.patient?.bariatric ? Number(rate?.bariatric_fee ?? 0) : 0);

      // Derive HCPCS with full trip data
      const { codes, modifiers: mods } = computeHcpcsCodes({
        pcr_type: t.pcr_type,
        service_level: t.service_level,
        loaded_miles: t.loaded_miles,
        wait_time_minutes: t.wait_time_minutes,
        oxygen_required: t.patient?.oxygen_required,
        bariatric: t.patient?.bariatric,
        equipment_used_json: t.equipment_used_json,
        destination_type: t.destination_type,
        origin_type: t.origin_type,
        assessment_json: t.assessment_json,
      });

      const claimStatus = gateResult.level === "review" ? "needs_review" : "ready_to_bill";
      const claimNotes = gateResult.level === "review" ? JSON.stringify(gateResult.issues) : null;

      const claim = {
        trip_id: t.id,
        patient_id: t.patient_id,
        run_date: t.run_date,
        company_id: t.company_id,
        payer_type: payerType,
        payer_name: payerType,
        member_id: t.patient?.member_id ?? null,
        base_charge: base,
        mileage_charge: miles,
        extras_charge: extras + wait,
        total_charge: base + miles + extras + wait,
        status: claimStatus,
        origin_type: t.origin_type,
        destination_type: t.destination_type,
        hcpcs_codes: codes,
        hcpcs_modifiers: mods,
        notes: claimNotes,
      };

      if (gateResult.level === "review") {
        reviewClaims.push(claim);
      } else {
        cleanClaims.push(claim);
      }
    }

    const allClaims = [...cleanClaims, ...reviewClaims];
    if (allClaims.length > 0) {
      await supabase.from("claim_records" as any).insert(allClaims);
    }

    // Summary toast
    const parts: string[] = [];
    if (cleanClaims.length > 0) parts.push(`${cleanClaims.length} claim(s) created and ready to bill`);
    if (reviewClaims.length > 0) parts.push(`${reviewClaims.length} claim(s) created with review flags`);
    if (blockedTrips.length > 0) parts.push(`${blockedTrips.length} trip(s) blocked — documentation incomplete`);

    if (blockedTrips.length > 0) {
      const blockedDetail = blockedTrips
        .map(b => `Trip ${b.id.slice(0, 8)}: ${b.issues.join(", ")}`)
        .join("\n");
      toast.warning(parts.join(" · "), {
        description: blockedDetail,
        duration: 12000,
      });
    } else if (reviewClaims.length > 0) {
      toast.info(parts.join(" · "), { duration: 6000 });
    } else if (cleanClaims.length > 0) {
      toast.success(parts.join(" · "));
    } else {
      toast.info("No new claims to create");
    }

    fetchData();
  };

  const openClaim = (claim: ClaimRecord) => {
    setSelectedClaim(claim);
    setEditForm({
      status: claim.status,
      amount_paid: claim.amount_paid?.toString() ?? "",
      denial_reason: claim.denial_reason ?? "",
      denial_code: claim.denial_code ?? "",
      notes: claim.notes ?? "",
    });
  };

  const saveClaim = async () => {
    if (!selectedClaim) return;
    setSavingClaim(true);
    const payload: any = {
      status: editForm.status,
      amount_paid: editForm.amount_paid ? parseFloat(editForm.amount_paid) : null,
      denial_reason: editForm.denial_reason || null,
      denial_code: editForm.denial_code || null,
      notes: editForm.notes || null,
    };
    if (editForm.status === "submitted") payload.submitted_at = new Date().toISOString();
    if (editForm.status === "paid") payload.paid_at = new Date().toISOString();

    await supabase.from("claim_records" as any).update(payload).eq("id", selectedClaim.id);
    toast.success("Claim updated");
    setSelectedClaim(null);
    fetchData();
    setSavingClaim(false);
  };

  const openEditRate = (rate: ChargeMaster) => {
    setEditingRate(rate);
    setRateForm({
      payer_type: rate.payer_type,
      base_rate: rate.base_rate.toString(),
      mileage_rate: rate.mileage_rate.toString(),
      wait_rate_per_min: rate.wait_rate_per_min.toString(),
      oxygen_fee: rate.oxygen_fee.toString(),
      extra_attendant_fee: rate.extra_attendant_fee.toString(),
      bariatric_fee: rate.bariatric_fee.toString(),
    });
  };

  const saveRate = async () => {
    setSavingRate(true);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const payload = {
      payer_type: rateForm.payer_type,
      base_rate: parseFloat(rateForm.base_rate) || 0,
      mileage_rate: parseFloat(rateForm.mileage_rate) || 0,
      wait_rate_per_min: parseFloat(rateForm.wait_rate_per_min) || 0,
      oxygen_fee: parseFloat(rateForm.oxygen_fee) || 0,
      extra_attendant_fee: parseFloat(rateForm.extra_attendant_fee) || 0,
      bariatric_fee: parseFloat(rateForm.bariatric_fee) || 0,
      company_id: companyId,
    };
    if (editingRate) {
      await supabase.from("charge_master" as any).update(payload).eq("id", editingRate.id);
    } else {
      await supabase.from("charge_master" as any).insert(payload);
    }
    toast.success("Rate saved");
    setEditingRate(null);
    setAddingRate(false);
    fetchData();
    setSavingRate(false);
  };

  const totalRevenue = claims.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.amount_paid ?? 0), 0);
  const totalPending = claims.filter(c => c.status === "ready_to_bill" || c.status === "submitted")
    .reduce((sum, c) => sum + c.total_charge, 0);
  const denialRate = claims.length > 0
    ? ((claims.filter(c => c.status === "denied").length / claims.length) * 100).toFixed(1)
    : "0.0";

  return (
    <AdminLayout>
      <Tabs defaultValue="trip-queue" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="trip-queue"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Trip Queue</TabsTrigger>
            <TabsTrigger value="claims">Claims Board</TabsTrigger>
            <TabsTrigger value="overrides-log"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Overrides Log</TabsTrigger>
            <TabsTrigger value="charge-master"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Charge Master</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40 h-9" />
            <Button size="sm" onClick={syncClaimsFromTrips}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Sync from Trips
            </Button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-3 grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Collected</p>
            <p className="text-2xl font-bold text-[hsl(var(--status-green))]">${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pending A/R</p>
            <p className="text-2xl font-bold text-foreground">${totalPending.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Denial Rate</p>
            <p className={`text-2xl font-bold ${parseFloat(denialRate) > 10 ? "text-destructive" : "text-foreground"}`}>{denialRate}%</p>
          </div>
        </div>

        {/* Trip Queue - One Screen View */}
        <TabsContent value="trip-queue" className="m-0">
          <BillingQueueView
            trips={queueTrips}
            payerRulesMap={payerRulesMap}
            onRefresh={() => { fetchQueueTrips(); fetchData(); fetchOverrideLogs(); }}
          />
        </TabsContent>

        {/* Claims Board */}
        <TabsContent value="claims" className="m-0">
          {loading ? (
            <PageLoader label="Loading claims…" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {CLAIM_COLUMNS.map(col => {
                const colClaims = claims.filter(c => c.status === col.status);
                return (
                  <div key={col.status} className={`rounded-lg border p-3 space-y-2 ${col.color}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {col.icon}
                      <span className="text-xs font-semibold uppercase tracking-wider">{col.label}</span>
                      <span className="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-xs font-bold">{colClaims.length}</span>
                    </div>
                    {colClaims.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">None</p>
                    ) : (
                      colClaims.map(claim => (
                        <button
                          key={claim.id}
                          onClick={() => openClaim(claim)}
                          className="w-full rounded-md border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <p className="text-xs font-semibold text-foreground truncate">{claim.patient_name}</p>
                            <CleanTripBadge
                              trip={{
                                loaded_miles: claim.trip_loaded_miles,
                                signature_obtained: claim.trip_signature,
                                pcs_attached: claim.trip_pcs,
                                origin_type: claim.origin_type,
                                destination_type: claim.destination_type,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{claim.run_date}</p>
                          {claim.hcpcs_codes?.length ? (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{claim.hcpcs_codes.join(", ")}</p>
                          ) : null}
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">${claim.total_charge.toFixed(2)}</span>
                            {claim.denial_reason && (
                              <span className="text-[10px] text-destructive truncate max-w-[80px]">{claim.denial_reason}</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Overrides Log */}
        <TabsContent value="overrides-log" className="m-0 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">All Billing Overrides</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Sort by:</span>
              {(["date", "user", "reason"] as const).map(s => (
                <Button
                  key={s}
                  variant={overrideLogSort === s ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setOverrideLogSort(s)}
                >
                  {s}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={fetchOverrideLogs}>
                <RefreshCw className="h-3 w-3 mr-1" />Refresh
              </Button>
            </div>
          </div>
          {overrideLogs.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No billing overrides recorded yet</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Patient / Trip</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Original Blockers</th>
                  </tr>
                </thead>
                <tbody>
                  {[...overrideLogs]
                    .sort((a, b) => {
                      if (overrideLogSort === "date") return new Date(b.created_at ?? b.overridden_at).getTime() - new Date(a.created_at ?? a.overridden_at).getTime();
                      if (overrideLogSort === "user") return (a.user_id ?? a.overridden_by ?? "").localeCompare(b.user_id ?? b.overridden_by ?? "");
                      return (a.reason ?? a.override_reason ?? "").localeCompare(b.reason ?? b.override_reason ?? "");
                    })
                    .map((o: any) => (
                      <tr key={o.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {new Date(o.created_at ?? o.overridden_at).toLocaleDateString()}<br />
                          <span className="text-muted-foreground">{new Date(o.created_at ?? o.overridden_at).toLocaleTimeString()}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{o.patient_name}</p>
                          <p className="text-[10px] text-muted-foreground">{o.run_date}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {(o.user_id ?? o.overridden_by)?.slice(0, 8) ?? "—"}…
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[200px] truncate">{o.reason ?? o.override_reason}</td>
                        <td className="px-4 py-3 text-[10px] text-muted-foreground max-w-[200px] truncate">
                          {(o.snapshot ?? o.previous_blockers_snapshot)
                            ? (((o.snapshot ?? o.previous_blockers_snapshot) as any)?.blockers?.join(", ") ||
                               ((o.snapshot ?? o.previous_blockers_snapshot) as any)?.missing?.join(", ") ||
                               (o.previous_blockers ?? []).join(", ") ||
                               "—")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Charge Master */}
        <TabsContent value="charge-master" className="m-0 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => {
              setEditingRate(null);
              setRateForm({ payer_type: "default", base_rate: "", mileage_rate: "", wait_rate_per_min: "", oxygen_fee: "", extra_attendant_fee: "", bariatric_fee: "" });
              setAddingRate(true);
            }}>+ Add Rate</Button>
          </div>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left">Payer</th>
                  <th className="px-4 py-3 text-right">Base Rate</th>
                  <th className="px-4 py-3 text-right">$/Mile</th>
                  <th className="px-4 py-3 text-right">Wait/Min</th>
                  <th className="px-4 py-3 text-right">O₂ Fee</th>
                  <th className="px-4 py-3 text-right">Extra Att.</th>
                  <th className="px-4 py-3 text-right">Bariatric</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {chargeMaster.map(rate => (
                  <tr key={rate.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium capitalize">{rate.payer_type}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.base_rate).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.mileage_rate).toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.wait_rate_per_min).toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.oxygen_fee).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.extra_attendant_fee).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${Number(rate.bariatric_fee).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditRate(rate)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Claim edit dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={o => { if (!o) setSelectedClaim(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim — {selectedClaim?.patient_name}</DialogTitle>
            <DialogDescription>{selectedClaim?.run_date} · {selectedClaim?.payer_type}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* HCPCS + origin/dest info */}
            {selectedClaim && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Base</p><p className="font-semibold">${selectedClaim.base_charge.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Mileage</p><p className="font-semibold">${selectedClaim.mileage_charge.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-lg">${selectedClaim.total_charge.toFixed(2)}</p></div>
                </div>
                {(selectedClaim.origin_type || selectedClaim.destination_type) && (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedClaim.origin_type ?? "?"} → {selectedClaim.destination_type ?? "?"}
                  </p>
                )}
                {selectedClaim.hcpcs_codes?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedClaim.hcpcs_codes.map(c => (
                      <span key={c} className="rounded bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.5">{c}</span>
                    ))}
                    {selectedClaim.hcpcs_modifiers?.map(m => (
                      <span key={m} className="rounded bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] text-[10px] font-mono px-1.5 py-0.5">{m}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v as ClaimStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLAIM_COLUMNS.map(c => (
                    <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(editForm.status === "paid") && (
              <div>
                <Label>Amount Paid</Label>
                <Input type="number" step="0.01" value={editForm.amount_paid}
                  onChange={e => setEditForm({ ...editForm, amount_paid: e.target.value })} />
              </div>
            )}
            {(editForm.status === "denied" || editForm.status === "needs_correction") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Denial Code</Label>
                  <Input value={editForm.denial_code} onChange={e => setEditForm({ ...editForm, denial_code: e.target.value })} />
                </div>
                <div>
                  <Label>Denial Reason</Label>
                  <Input value={editForm.denial_reason} onChange={e => setEditForm({ ...editForm, denial_reason: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveClaim} disabled={savingClaim}>
              {savingClaim ? "Saving…" : "Save Claim"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate edit dialog */}
      <Dialog open={!!editingRate || addingRate} onOpenChange={o => { if (!o) { setEditingRate(null); setAddingRate(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Edit Rate" : "Add Rate"}</DialogTitle>
            <DialogDescription>Set rates per payer type. Used to auto-calculate charges.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Payer Type</Label>
              <Select value={rateForm.payer_type} onValueChange={v => setRateForm({ ...rateForm, payer_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYER_TYPES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Base Rate ($)</Label><Input type="number" step="0.01" value={rateForm.base_rate} onChange={e => setRateForm({ ...rateForm, base_rate: e.target.value })} /></div>
              <div><Label>$/Mile</Label><Input type="number" step="0.0001" value={rateForm.mileage_rate} onChange={e => setRateForm({ ...rateForm, mileage_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Wait $/Min</Label><Input type="number" step="0.0001" value={rateForm.wait_rate_per_min} onChange={e => setRateForm({ ...rateForm, wait_rate_per_min: e.target.value })} /></div>
              <div><Label>O₂ Fee ($)</Label><Input type="number" step="0.01" value={rateForm.oxygen_fee} onChange={e => setRateForm({ ...rateForm, oxygen_fee: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Extra Attendant ($)</Label><Input type="number" step="0.01" value={rateForm.extra_attendant_fee} onChange={e => setRateForm({ ...rateForm, extra_attendant_fee: e.target.value })} /></div>
              <div><Label>Bariatric Fee ($)</Label><Input type="number" step="0.01" value={rateForm.bariatric_fee} onChange={e => setRateForm({ ...rateForm, bariatric_fee: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={saveRate} disabled={savingRate}>
              {savingRate ? "Saving…" : "Save Rate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
