import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLoader } from "@/components/ui/page-loader";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, AlertTriangle, CheckCircle, XCircle, RefreshCw, Settings2, ClipboardList, ShieldAlert, Download, Info, X, FileText, TrendingUp, Send, Loader2, Wrench, BookOpen } from "lucide-react";
import { PayerDirectoryTab } from "@/components/billing/PayerDirectoryTab";
import { MissingMoneyDetail } from "@/components/billing/MissingMoneyPanel";
import { DenialRecoveryEngine } from "@/components/billing/DenialRecoveryEngine";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const DISMISSED_KEY = "charge_master_notice_dismissed_at";

function ChargeRateNotice({ chargeMaster }: { chargeMaster: ChargeMaster[] }) {
  const [dismissed, setDismissed] = useState(false);

  const mostRecentEdit = chargeMaster.reduce((latest, r) => {
    const d = new Date(r.updated_at).getTime();
    return d > latest ? d : latest;
  }, 0);

  const stale = mostRecentEdit > 0 && Date.now() - mostRecentEdit > 365 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (stale) {
      setDismissed(false);
      localStorage.removeItem(DISMISSED_KEY);
      return;
    }
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) setDismissed(true);
  }, [stale]);

  if (dismissed && !stale) return null;

  return (
    <Alert className="border-blue-300/50 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-700/40">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="flex items-start justify-between gap-4 text-sm text-blue-900 dark:text-blue-200">
        <span>
          Rates are pre-loaded from the 2025 CMS Ambulance Fee Schedule for Georgia urban service areas.
          Verify these rates match your service area and update them annually when CMS publishes new rates.
          Medicare and Medicaid rates vary by state and urban versus rural designation.
        </span>
        <button
          onClick={() => { setDismissed(true); localStorage.setItem(DISMISSED_KEY, new Date().toISOString()); }}
          className="shrink-0 rounded p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-800/40"
          aria-label="Dismiss notice"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDescription>
    </Alert>
  );
}
import { downloadCSV } from "@/lib/csv-export";
import { logAuditEvent } from "@/lib/audit-logger";
import { ClaimAdjustmentHistory } from "@/components/billing/ClaimAdjustmentHistory";
import { TripStatusTimeline } from "@/components/billing/TripStatusTimeline";
import { toast } from "sonner";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { ADMIN_TOOLTIPS } from "@/lib/admin-tooltips";
import { CleanTripBadge } from "@/components/billing/CleanTripBadge";
import { BillingQueueView } from "@/components/billing/BillingQueueView";
import { computeHcpcsCodes, computeCleanTripStatus } from "@/lib/billing-utils";
import { useSimulationSession } from "@/hooks/useSimulationSession";
import { SecondaryClaimPanel } from "@/components/billing/SecondaryClaimPanel";
import { RevenueCycleTab } from "@/components/billing/RevenueCycleTab";
import { EmergencyEventPanel } from "@/components/billing/EmergencyEventPanel";

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
  updated_at?: string;
  // joined
  patient_name?: string;
  // trip data for badge
  trip_loaded_miles?: number | null;
  trip_signature?: boolean;
  trip_pcs?: boolean;
  trip_loaded_at?: string | null;
  trip_dropped_at?: string | null;
  trip_type?: string | null;
  // secondary insurance & remittance
  patient_responsibility_amount?: number | null;
  secondary_claim_generated?: boolean;
  icd10_codes?: string[] | null;
  // patient secondary insurance info (joined)
  patient_secondary_payer?: string | null;
  patient_secondary_member_id?: string | null;
  patient_secondary_payer_id?: string | null;
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
  updated_at: string;
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
  const { activeCompanyId } = useAuth();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [chargeMaster, setChargeMaster] = useState<ChargeMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [editForm, setEditForm] = useState({
    status: "ready_to_bill" as ClaimStatus,
    amount_paid: "", denial_reason: "", denial_code: "", notes: "",
  });
  const [savingClaim, setSavingClaim] = useState(false);
  const [recoveryClaimId, setRecoveryClaimId] = useState<ClaimRecord | null>(null);
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
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "trip-queue";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [secondaryFilter, setSecondaryFilter] = useState(false);
  const { simulationRunId, refreshToken } = useSimulationSession();
  const [clearinghouseConfigured, setClearinghouseConfigured] = useState(false);
  const [oaSending, setOaSending] = useState(false);
  const [oaReceiving, setOaReceiving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let claimsQuery = supabase.from("claim_records" as any).select("*").or("is_simulated.eq.false,is_simulated.is.null").order("run_date", { ascending: false }).limit(1000);
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
        ? supabase.from("patients").select("id, first_name, last_name, secondary_payer, secondary_member_id, secondary_payer_id").in("id", patientIds)
        : Promise.resolve({ data: [] }),
      tripIds.length > 0
        ? supabase.from("trip_records" as any).select("id, leg_id, loaded_miles, signature_obtained, pcs_attached, origin_type, destination_type, loaded_at, dropped_at, trip_type, updated_at, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name)").in("id", tripIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pMap = new Map((pRows ?? []).map((p: any) => [p.id, { name: `${p.first_name} ${p.last_name}`, secondary_payer: p.secondary_payer, secondary_member_id: p.secondary_member_id, secondary_payer_id: p.secondary_payer_id }]));
    const tMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));

    setClaims(
      ((claimRows ?? []) as any[]).map((c: any) => {
        const tripData = tMap.get(c.trip_id) as any;
        const patData = pMap.get(c.patient_id) as any;
        return {
          ...c,
          patient_name: patData?.name ?? (tripData?.leg?.is_oneoff ? tripData.leg.oneoff_name : null) ?? "Unknown",
          trip_loaded_miles: tripData?.loaded_miles ?? null,
          trip_signature: tripData?.signature_obtained ?? false,
          trip_pcs: tripData?.pcs_attached ?? false,
          trip_loaded_at: tripData?.loaded_at ?? null,
          trip_dropped_at: tripData?.dropped_at ?? null,
          trip_type: tripData?.trip_type ?? c.payer_type ?? null,
          trip_updated_at: tripData?.updated_at ?? null,
          patient_secondary_payer: patData?.secondary_payer ?? null,
          patient_secondary_member_id: patData?.secondary_member_id ?? null,
          patient_secondary_payer_id: patData?.secondary_payer_id ?? null,
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

  useEffect(() => {
    fetchData(); fetchQueueTrips(); fetchOverrideLogs();
    // Check if clearinghouse is configured
    if (activeCompanyId) {
      supabase.from("clearinghouse_settings" as any)
        .select("is_configured")
        .eq("company_id", activeCompanyId)
        .maybeSingle()
        .then(({ data }) => {
          setClearinghouseConfigured(!!(data as any)?.is_configured);
        });
    }
  }, [fetchData, fetchQueueTrips, fetchOverrideLogs, activeCompanyId]);

  useEffect(() => {
    if (!refreshToken) return;
    setQueueTrips([]);
    setOverrideLogs([]);
    setClaims([]);
    fetchData();
    fetchQueueTrips();
    fetchOverrideLogs();
  }, [refreshToken, fetchData, fetchQueueTrips, fetchOverrideLogs]);

  const handleSendViaOA = async () => {
    if (!activeCompanyId) return;
    setOaSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-claims-officeally", {
        body: { company_id: activeCompanyId },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(`Sent ${data.sent} claims via Office Ally`);
      } else {
        toast.info("No new claims to send");
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send claims");
    }
    setOaSending(false);
  };

  const handleCheckPayments = async () => {
    if (!activeCompanyId) return;
    setOaReceiving(true);
    try {
      const { data, error } = await supabase.functions.invoke("retrieve-remittance-officeally", {
        body: { company_id: activeCompanyId },
      });
      if (error) throw error;
      if (data?.received > 0) {
        toast.success(`Imported ${data.received} payment files`);
      } else {
        toast.info("No new payment files found");
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to check for payments");
    }
    setOaReceiving(false);
  };

  // Helper: build claim data from a trip
  // Supports oneoff runs by falling back to scheduling_legs oneoff fields
  const buildClaimFromTrip = (t: any) => {
    const leg = t.leg as any;
    const isOneoff = !t.patient_id && leg?.is_oneoff;
    const payerType = t.patient?.primary_payer ?? (isOneoff ? leg?.oneoff_primary_payer : null) ?? "default";
    const payerRules = payerRulesMap.get(payerType) ?? null;
    const authInfo = t.patient ? { auth_required: t.patient.auth_required, auth_expiration: t.patient.auth_expiration } : null;
    const gateResult = computeCleanTripStatus(t, payerRules, authInfo);

    const rate = chargeMaster.find(r => r.payer_type === payerType) ?? chargeMaster.find(r => r.payer_type === "default");
    const base = rate?.base_rate ?? 0;
    const miles = Number(t.loaded_miles ?? 0) * Number(rate?.mileage_rate ?? 0);
    const wait = Number(t.wait_time_minutes ?? 0) * Number(rate?.wait_rate_per_min ?? 0);
    const extras = (t.patient?.oxygen_required || (isOneoff && leg?.oneoff_oxygen) ? Number(rate?.oxygen_fee ?? 0) : 0)
      + (t.patient?.bariatric ? Number(rate?.bariatric_fee ?? 0) : 0);

    const { codes, modifiers: mods } = computeHcpcsCodes({
      pcr_type: t.pcr_type,
      service_level: t.service_level,
      loaded_miles: t.loaded_miles,
      wait_time_minutes: t.wait_time_minutes,
      oxygen_required: t.patient?.oxygen_required || (isOneoff && leg?.oneoff_oxygen),
      bariatric: t.patient?.bariatric,
      equipment_used_json: t.equipment_used_json,
      destination_type: t.destination_type,
      origin_type: t.origin_type,
      assessment_json: t.assessment_json,
    });

    const claimStatus = gateResult.level === "blocked" ? "needs_review" : gateResult.level === "review" ? "needs_review" : "ready_to_bill";
    const claimNotes = gateResult.level !== "clean" ? JSON.stringify(gateResult.issues) : null;

    return {
      gateResult,
      payerType,
      claim: {
        trip_id: t.id,
        patient_id: t.patient_id,
        run_date: t.run_date,
        company_id: t.company_id,
        payer_type: payerType,
        payer_name: payerType,
        member_id: t.patient?.member_id ?? (isOneoff ? leg?.oneoff_member_id : null) ?? null,
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
        vehicle_id: t.vehicle_id ?? null,
        odometer_at_scene: t.odometer_at_scene ?? null,
        odometer_at_destination: t.odometer_at_destination ?? null,
        odometer_in_service: t.odometer_in_service ?? null,
        stretcher_placement: t.stretcher_placement ?? null,
        patient_mobility: t.patient_mobility ?? null,
        isolation_precautions: t.isolation_precautions ?? null,
        icd10_codes: t.icd10_codes ?? [],
        origin_zip: extractZip(t.pickup_location),
        destination_zip: extractZip(t.destination_location),
        patient_sex: t.patient?.sex ?? (isOneoff ? leg?.oneoff_sex : null) ?? null,
        auth_number: t.patient?.auth_required ? (t.patient?.prior_auth_number ?? null) : null,
      },
    };
  };

  // Helper to extract ZIP code from an address string
  const extractZip = (address: string | null): string | null => {
    if (!address) return null;
    const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return match ? match[1] : null;
  };

  // Refresh existing needs_review / needs_correction claims against live trip data
  const refreshExistingClaims = async () => {
    // Get refreshable claims
    const { data: refreshableClaims } = await supabase
      .from("claim_records" as any)
      .select("id, trip_id, status")
      .in("status", ["needs_review", "needs_correction"]);

    if (!refreshableClaims?.length) {
      toast.info("No claims need refreshing");
      return;
    }

    const tripIds = (refreshableClaims as any[]).map((c: any) => c.trip_id).filter(Boolean);
    const { data: trips } = await supabase
      .from("trip_records" as any)
      .select("*, patient:patients!trip_records_patient_id_fkey(primary_payer, member_id, bariatric, oxygen_required, auth_required, auth_expiration, sex, prior_auth_number), leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_primary_payer, oneoff_member_id, oneoff_dob, oneoff_sex, oneoff_oxygen), odometer_at_scene, odometer_at_destination, odometer_in_service, vehicle_id, stretcher_placement, patient_mobility, isolation_precautions")
      .in("id", tripIds);

    if (!trips?.length) {
      toast.info("No matching trip records found");
      return;
    }

    const tripMap = new Map((trips as any[]).map((t: any) => [t.id, t]));
    let upgraded = 0;
    let stillPending = 0;

    for (const claim of refreshableClaims as any[]) {
      const t = tripMap.get(claim.trip_id);
      if (!t) continue;

      const { gateResult, claim: claimData } = buildClaimFromTrip(t);
      const newStatus = gateResult.level === "clean" ? "ready_to_bill" : "needs_review";

      await supabase
        .from("claim_records" as any)
        .update({
          status: newStatus,
          origin_type: claimData.origin_type,
          destination_type: claimData.destination_type,
          hcpcs_codes: claimData.hcpcs_codes,
          hcpcs_modifiers: claimData.hcpcs_modifiers,
          base_charge: claimData.base_charge,
          mileage_charge: claimData.mileage_charge,
          total_charge: claimData.total_charge,
          extras_charge: claimData.extras_charge,
          notes: claimData.notes,
          vehicle_id: claimData.vehicle_id,
          odometer_at_scene: claimData.odometer_at_scene,
          odometer_at_destination: claimData.odometer_at_destination,
          odometer_in_service: claimData.odometer_in_service,
          stretcher_placement: claimData.stretcher_placement,
          patient_mobility: claimData.patient_mobility,
          isolation_precautions: claimData.isolation_precautions,
          member_id: claimData.member_id,
          payer_type: claimData.payer_type,
          payer_name: claimData.payer_name,
          icd10_codes: claimData.icd10_codes,
          patient_sex: claimData.patient_sex,
          auth_number: claimData.auth_number,
        } as any)
        .eq("id", claim.id);

      // Write computed HCPCS codes back to trip_record
      if (claim.trip_id && claimData.hcpcs_codes?.length) {
        await supabase
          .from("trip_records" as any)
          .update({ hcpcs_codes: claimData.hcpcs_codes, hcpcs_modifiers: claimData.hcpcs_modifiers } as any)
          .eq("id", claim.trip_id);
      }

      if (newStatus === "ready_to_bill") upgraded++;
      else stillPending++;
    }

    const parts: string[] = [];
    if (upgraded > 0) parts.push(`${upgraded} claim(s) upgraded to ready-to-bill`);
    if (stillPending > 0) parts.push(`${stillPending} claim(s) still need review`);
    toast.success(parts.join(" · ") || "Claims refreshed");
    fetchData();
  };

  const syncClaimsFromTrips = async () => {
    const { data: trips } = await supabase
      .from("trip_records" as any)
      .select("*, patient:patients!trip_records_patient_id_fkey(primary_payer, member_id, bariatric, oxygen_required, auth_required, auth_expiration, sex, prior_auth_number), leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_primary_payer, oneoff_member_id, oneoff_dob, oneoff_sex, oneoff_oxygen), odometer_at_scene, odometer_at_destination, odometer_in_service, vehicle_id, stretcher_placement, patient_mobility, isolation_precautions, icd10_codes, weight_lbs")
      .in("status", ["ready_for_billing", "completed"] as any)
      .not("status", "eq", "cancelled")
      .eq("pcr_status", "submitted");

    if (!trips?.length) { toast.info("No new trips ready for billing"); return; }

    const { data: existing } = await supabase.from("claim_records" as any).select("trip_id, patient_id, run_date, status");
    const existingTripIds = new Set((existing ?? []).map((e: any) => e.trip_id).filter(Boolean));

    // Build a set of patient+date combinations that already have non-voided claims
    const existingPatientDateClaims = new Set(
      (existing ?? []).filter((e: any) => e.patient_id && e.status !== "voided").map((e: any) => `${e.patient_id}_${e.run_date}`)
    );

    // Filter out trips that already have a claim (by trip_id)
    const newTrips = (trips as any[]).filter(t => !existingTripIds.has(t.id));

    // Detect duplicate billable trip records: same patient + same date, both billable
    const billableByPatientDate = new Map<string, any[]>();
    for (const t of trips as any[]) {
      if (!t.patient_id) continue;
      const key = `${t.patient_id}_${t.run_date}`;
      if (!billableByPatientDate.has(key)) billableByPatientDate.set(key, []);
      billableByPatientDate.get(key)!.push(t);
    }
    const duplicateBillableWarnings: string[] = [];
    for (const [, group] of billableByPatientDate) {
      if (group.length > 1) {
        const patientName = group[0].patient ? `${group[0].patient.first_name ?? ""} ${group[0].patient.last_name ?? ""}`.trim() : "Unknown";
        duplicateBillableWarnings.push(`${patientName} on ${group[0].run_date} (${group.length} trip records)`);
      }
    }

    const cleanClaims: any[] = [];
    const reviewClaims: any[] = [];
    const blockedTrips: { id: string; issues: string[] }[] = [];
    const duplicateWarnings: string[] = [];

    // Track patient+date keys for claims being created in this batch
    const claimedPatientDates = new Set(existingPatientDateClaims);

    for (const t of newTrips) {
      // Duplicate patient+date detection — skip if a claim already exists for this patient on this date
      if (t.patient_id) {
        const patientDateKey = `${t.patient_id}_${t.run_date}`;
        if (claimedPatientDates.has(patientDateKey)) {
          const patientName = t.patient ? `${t.patient.first_name ?? ""} ${t.patient.last_name ?? ""}`.trim() : "Unknown";
          duplicateWarnings.push(`${patientName} on ${t.run_date}`);
          continue;
        }
        claimedPatientDates.add(patientDateKey);
      }

      // Emergency event: skip claim creation for emergency PCRs with no_emergency/accidental resolution
      if (t.is_emergency_pcr) {
        const resolution = t.emergency_upgrade_resolution ?? "";
        const resType = (() => { try { return JSON.parse(resolution)?.type; } catch { return resolution; } })();
        if (resType === "no_emergency" || resType === "accidental_after_window") {
          continue; // No separate claim for these
        }
      }

      const { gateResult, claim } = buildClaimFromTrip(t);

      // Sync emergency event data to claims
      if (t.emergency_upgrade_at) {
        (claim as any).has_emergency_event = true;
        const pickupTime = t.scheduled_pickup_time ?? t.dispatch_time ?? "unknown";
        const upgradeAt = new Date(t.emergency_upgrade_at).toLocaleString();
        const resolution = t.emergency_upgrade_resolution ?? "";
        let resType = "pending";
        let resTime = "";
        try {
          const parsed = JSON.parse(resolution);
          resType = parsed.type?.replace(/_/g, " ") ?? "pending";
          resTime = parsed.time ? new Date(parsed.time).toLocaleString() : "";
        } catch {
          resType = resolution || "pending";
        }
        const resolvedAt = t.emergency_upgrade_resolved_at ? new Date(t.emergency_upgrade_resolved_at).toLocaleString() : resTime;
        (claim as any).emergency_event_summary = `Non-emergency transport started at ${pickupTime}. Emergency upgrade triggered at ${upgradeAt}. Resolution — ${resType}${resolvedAt ? ` — at ${resolvedAt}` : ""}.`;
        (claim as any).emergency_billing_recommendation = t.emergency_billing_recommendation ?? null;
      }

      // Emergency PCR with transfer_of_care or patient_stabilized → needs_review
      if (t.is_emergency_pcr && t.emergency_upgrade_at) {
        const resolution = t.emergency_upgrade_resolution ?? "";
        const resType = (() => { try { return JSON.parse(resolution)?.type; } catch { return resolution; } })();
        if (resType === "transfer_of_care" || resType === "patient_stabilized") {
          claim.status = "needs_review";
          claim.notes = `Emergency event requires biller review before submission — resolution: ${resType.replace(/_/g, " ")}`;
          reviewClaims.push(claim);
          continue;
        }
      }

      if (gateResult.level === "blocked") {
        blockedTrips.push({ id: t.id, issues: gateResult.issues });
        // Still create the claim as needs_review so it can be refreshed later
        reviewClaims.push(claim);
        continue;
      }

      if (gateResult.level === "review") {
        reviewClaims.push(claim);
      } else {
        cleanClaims.push(claim);
      }
    }

    const allClaims = [...cleanClaims, ...reviewClaims];
    if (allClaims.length > 0) {
      await supabase.from("claim_records" as any).insert(allClaims);

      // Write computed HCPCS codes back to trip_records so both tables stay in sync
      for (const c of allClaims) {
        if (c.trip_id && c.hcpcs_codes?.length) {
          await supabase
            .from("trip_records" as any)
            .update({ hcpcs_codes: c.hcpcs_codes, hcpcs_modifiers: c.hcpcs_modifiers } as any)
            .eq("id", c.trip_id);
        }
      }
    }

    // Fix 3: Warn about $0 claims
    const zeroClaims = allClaims.filter(c => (c.total_charge ?? 0) === 0);
    if (zeroClaims.length > 0) {
      toast.warning(`${zeroClaims.length} claim(s) created with $0.00 total — review the Charge Master to ensure rates are set for these payer types.`, {
        duration: 10000,
      });
    }

    // Also refresh existing needs_review claims
    await refreshExistingClaims();

    // Warn about duplicate trip records that were skipped (same patient+date claim already exists)
    if (duplicateWarnings.length > 0) {
      toast.warning(`Duplicate trip records detected — skipped claim creation for: ${duplicateWarnings.join(", ")}. Review and resolve duplicate trips before submitting.`, {
        duration: 15000,
      });
    }

    // Warn about duplicate billable trip records (same patient has multiple billable trips on same date)
    if (duplicateBillableWarnings.length > 0) {
      toast.warning(`⚠ Duplicate billable trips detected — ${duplicateBillableWarnings.join("; ")}. Review these trip records before submitting claims to avoid payer denials.`, {
        duration: 20000,
      });
    }

    // Summary toast
    const parts: string[] = [];
    if (cleanClaims.length > 0) parts.push(`${cleanClaims.length} claim(s) created and ready to bill`);
    if (reviewClaims.length > 0) parts.push(`${reviewClaims.length} claim(s) created with review flags`);
    if (blockedTrips.length > 0) parts.push(`${blockedTrips.length} trip(s) blocked — documentation incomplete`);
    if (duplicateWarnings.length > 0) parts.push(`${duplicateWarnings.length} duplicate(s) skipped`);
    if (duplicateBillableWarnings.length > 0) parts.push(`${duplicateBillableWarnings.length} duplicate billable trip(s) flagged`);

    // Void claims for cancelled trips
    const { data: cancelledTrips } = await supabase
      .from("trip_records" as any)
      .select("id")
      .eq("status", "cancelled");
    if (cancelledTrips?.length) {
      const cancelledIds = (cancelledTrips as any[]).map((t: any) => t.id);
      const { data: claimsToVoid } = await supabase
        .from("claim_records" as any)
        .select("id")
        .in("trip_id", cancelledIds)
        .not("status", "eq", "voided");
      if (claimsToVoid?.length) {
        for (const c of claimsToVoid as any[]) {
          await supabase.from("claim_records" as any).update({
            status: "voided",
            notes: "Trip was cancelled — claim voided automatically",
          } as any).eq("id", c.id);
        }
        parts.push(`${claimsToVoid.length} claim(s) voided for cancelled trips`);
      }
    }

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

  // Fix 19: State for orphan secondary claim warning
  const [orphanWarning, setOrphanWarning] = useState<{ claim: ClaimRecord; newStatus: string } | null>(null);

  // Optimistic concurrency: capture updated_at when claim is opened
  const [claimOpenedAt, setClaimOpenedAt] = useState<string | null>(null);

  const openClaim = (claim: ClaimRecord) => {
    setSelectedClaim(claim);
    setClaimOpenedAt(claim.updated_at ?? null);
    logAuditEvent({ action: "view", tableName: "claim_records", recordId: claim.id, notes: `Viewed claim for ${claim.patient_name}` });
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

    // Fix 19: Check if this is a destructive status change on a claim with a linked secondary
    const isDestructiveChange = (editForm.status === "denied" || editForm.status === "needs_correction") && selectedClaim.status !== editForm.status;
    if (isDestructiveChange && (selectedClaim as any).secondary_claim_id) {
      setOrphanWarning({ claim: selectedClaim, newStatus: editForm.status });
      return;
    }

    await executeClaimSave();
  };

  const executeClaimSave = async (handleOrphanSecondary = false) => {
    if (!selectedClaim) return;
    setSavingClaim(true);

    // Optimistic concurrency check
    if (claimOpenedAt) {
      const { data: currentClaim } = await supabase
        .from("claim_records" as any)
        .select("updated_at")
        .eq("id", selectedClaim.id)
        .maybeSingle();
      if (currentClaim && (currentClaim as any).updated_at !== claimOpenedAt) {
        toast.error("This claim was already updated by another user — refreshing to show current state");
        setSavingClaim(false);
        setSelectedClaim(null);
        fetchData();
        return;
      }
    }

    const payload: any = {
      status: editForm.status,
      amount_paid: editForm.amount_paid ? parseFloat(editForm.amount_paid) : null,
      denial_reason: editForm.denial_reason || null,
      denial_code: editForm.denial_code || null,
      notes: editForm.notes || null,
    };
    if (editForm.status === "submitted") payload.submitted_at = new Date().toISOString();
    if (editForm.status === "paid") payload.paid_at = new Date().toISOString();

    // Log adjustment history for each changed field
    const { data: { user } } = await supabase.auth.getUser();
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const fieldMap: Record<string, { old: any; new: any }> = {};
    if (editForm.status !== selectedClaim.status) fieldMap.status = { old: selectedClaim.status, new: editForm.status };
    if ((editForm.amount_paid || "") !== (selectedClaim.amount_paid?.toString() ?? "")) fieldMap.amount_paid = { old: selectedClaim.amount_paid?.toString() ?? null, new: editForm.amount_paid || null };
    if ((editForm.denial_reason || "") !== (selectedClaim.denial_reason ?? "")) fieldMap.denial_reason = { old: selectedClaim.denial_reason, new: editForm.denial_reason || null };

    const adjustments = Object.entries(fieldMap).map(([field, { old: oldVal, new: newVal }]) => ({
      trip_id: selectedClaim.trip_id,
      company_id: companyId,
      changed_by: user?.id,
      field_changed: field,
      old_value: oldVal ? String(oldVal) : null,
      new_value: newVal ? String(newVal) : null,
      reason: editForm.notes || null,
    }));
    if (adjustments.length > 0) {
      await supabase.from("claim_adjustments" as any).insert(adjustments);
    }

    await supabase.from("claim_records" as any).update(payload).eq("id", selectedClaim.id);

    // Fix 19: If confirmed, mark the secondary claim as needs_review
    if (handleOrphanSecondary && (selectedClaim as any).secondary_claim_id) {
      await supabase.from("claim_records" as any).update({
        status: "needs_review",
        denial_reason: "Primary claim was deleted — review required",
      } as any).eq("id", (selectedClaim as any).secondary_claim_id);
    }

    logAuditEvent({ action: "edit", tableName: "claim_records", recordId: selectedClaim.id, notes: `Updated claim: ${Object.keys(fieldMap).join(", ")}` });
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

  const secondaryOpportunities = claims.filter(
    c => c.status === "paid" && c.patient_secondary_payer && !c.secondary_claim_generated
  ).length;

  return (
    <AdminLayout>
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="trip-queue"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Trip Queue</TabsTrigger>
            <TabsTrigger value="claims">Claims Board</TabsTrigger>
            <TabsTrigger value="overrides-log"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Overrides Log</TabsTrigger>
            <TabsTrigger value="charge-master"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Charge Master</TabsTrigger>
            <TabsTrigger value="revenue-cycle"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Revenue Cycle</TabsTrigger>
            <TabsTrigger value="missing-money"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Missing Money</TabsTrigger>
            <TabsTrigger value="payer-directory"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Payer Directory</TabsTrigger>
          </TabsList>
          <a href="/edi-export">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              837P Export
            </Button>
          </a>
          <a href="/remittance-import">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              835 Import
            </Button>
          </a>
          {clearinghouseConfigured && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleSendViaOA}
                disabled={oaSending}
              >
                {oaSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {oaSending ? "Sending..." : "Send via Office Ally"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCheckPayments}
                disabled={oaReceiving}
              >
                {oaReceiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {oaReceiving ? "Checking..." : "Check for Payments"}
              </Button>
            </>
          )}
          {secondaryOpportunities > 0 && (
            <Badge
              variant="secondary"
              className="text-xs gap-1 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border border-[hsl(var(--status-yellow))]/30 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => { setActiveTab("claims"); setSecondaryFilter(prev => !prev); }}
            >
              <AlertTriangle className="h-3 w-3" />
              {secondaryOpportunities} secondary {secondaryOpportunities === 1 ? "opportunity" : "opportunities"}
              {secondaryFilter && <X className="h-3 w-3 ml-0.5" />}
            </Badge>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40 h-9" />
            <Button size="sm" onClick={syncClaimsFromTrips}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Sync from Trips
            </Button>
            <Button size="sm" variant="outline" onClick={refreshExistingClaims}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh Existing Claims
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const rows = claims.map(c => ({
                patient_name: c.patient_name ?? "",
                run_date: c.run_date,
                payer: c.payer_type,
                status: c.status,
                base_charge: c.base_charge,
                mileage_charge: c.mileage_charge,
                total_charge: c.total_charge,
                amount_paid: c.amount_paid ?? "",
                hcpcs: (c.hcpcs_codes ?? []).join("; "),
                denial_reason: c.denial_reason ?? "",
              }));
              downloadCSV(rows, `claims_export_${dateFilter}.csv`);
              logAuditEvent({ action: "export", tableName: "claim_records", notes: `Exported ${rows.length} claims` });
              toast.success(`Exported ${rows.length} claims`);
            }}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
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
                const colClaims = (secondaryFilter
                  ? claims.filter(c => c.status === "paid" && c.patient_secondary_payer && !c.secondary_claim_generated)
                  : claims
                ).filter(c => c.status === col.status);
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
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Fix 3: Rate Missing badge for $0 claims */}
                              {claim.total_charge === 0 && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20">
                                  Rate Missing
                                </Badge>
                              )}
                              {/* Fix 11: Stale Export badge */}
                              {claim.submitted_at && (claim as any).exported_at && (() => {
                                // Check if trip was updated after claim export
                                const tripUpdated = (claim as any).trip_updated_at;
                                const exportedAt = (claim as any).exported_at;
                                if (tripUpdated && exportedAt && new Date(tripUpdated) > new Date(exportedAt)) {
                                  return (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20" title="Export outdated — trip data changed after last export. Regenerate before submitting.">
                                      Stale Export
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              <CleanTripBadge
                                trip={{
                                  loaded_miles: claim.trip_loaded_miles,
                                  signature_obtained: claim.trip_signature,
                                  pcs_attached: claim.trip_pcs,
                                  origin_type: claim.origin_type,
                                  destination_type: claim.destination_type,
                                  loaded_at: claim.trip_loaded_at,
                                  dropped_at: claim.trip_dropped_at,
                                  trip_type: claim.trip_type,
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{claim.run_date}</p>
                          {claim.hcpcs_codes?.length ? (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{claim.hcpcs_codes.join(", ")}</p>
                          ) : null}
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">${claim.total_charge.toFixed(2)}</span>
                            {claim.status === "denied" && (
                              <button
                                className="text-[10px] font-medium text-primary hover:underline"
                                onClick={e => { e.stopPropagation(); setRecoveryClaimId(claim); }}
                              >
                                <Wrench className="inline h-3 w-3 mr-0.5" />Recover
                              </button>
                            )}
                            {claim.denial_reason && claim.status !== "denied" && (
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
          <ChargeRateNotice chargeMaster={chargeMaster} />
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

        {/* Revenue Cycle */}
        <TabsContent value="revenue-cycle" className="m-0">
          <RevenueCycleTab claims={claims} />
        </TabsContent>

        {/* Missing Money */}
        <TabsContent value="missing-money" className="m-0">
          <MissingMoneyDetail />
        </TabsContent>

        {/* Payer Directory */}
        <TabsContent value="payer-directory" className="m-0">
          <PayerDirectoryTab />
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
            {/* Emergency Event Panel */}
            {selectedClaim && (selectedClaim as any).has_emergency_event && (
              <EmergencyEventPanel claim={selectedClaim} onUpdate={fetchData} />
            )}
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
                <Label>Amount Paid<PCRTooltip text={ADMIN_TOOLTIPS.amount_paid} /></Label>
                <Input type="number" step="0.01" value={editForm.amount_paid}
                  onChange={e => setEditForm({ ...editForm, amount_paid: e.target.value })} />
              </div>
            )}
            {(editForm.status === "denied" || editForm.status === "needs_correction") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Denial Code<PCRTooltip text={ADMIN_TOOLTIPS.denial_code} /></Label>
                  <Input value={editForm.denial_code} onChange={e => setEditForm({ ...editForm, denial_code: e.target.value })} />
                </div>
                <div>
                  <Label>Denial Reason<PCRTooltip text={ADMIN_TOOLTIPS.denial_reason} /></Label>
                  <Input value={editForm.denial_reason} onChange={e => setEditForm({ ...editForm, denial_reason: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            {selectedClaim && <ClaimAdjustmentHistory tripId={selectedClaim.trip_id} />}
            {selectedClaim && (
              <SecondaryClaimPanel
                claimId={selectedClaim.id}
                tripId={selectedClaim.trip_id}
                patientId={selectedClaim.patient_id}
                status={selectedClaim.status}
                amountPaid={selectedClaim.amount_paid}
                patientResponsibilityAmount={selectedClaim.patient_responsibility_amount ?? null}
                totalCharge={selectedClaim.total_charge}
                secondaryClaimGenerated={selectedClaim.secondary_claim_generated ?? false}
                runDate={selectedClaim.run_date}
                hcpcsCodes={selectedClaim.hcpcs_codes}
                hcpcsModifiers={selectedClaim.hcpcs_modifiers}
                originType={selectedClaim.origin_type}
                destinationType={selectedClaim.destination_type}
                icd10Codes={selectedClaim.icd10_codes ?? null}
                secondaryPayer={selectedClaim.patient_secondary_payer ?? null}
                secondaryMemberId={selectedClaim.patient_secondary_member_id ?? null}
                secondaryPayerId={selectedClaim.patient_secondary_payer_id ?? null}
                onGenerated={fetchData}
              />
            )}
            {selectedClaim && <TripStatusTimeline tripId={selectedClaim.trip_id} label="Trip Status Timeline" />}
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
              <div><Label>Base Rate ($)<PCRTooltip text={ADMIN_TOOLTIPS.base_rate} /></Label><Input type="number" step="0.01" value={rateForm.base_rate} onChange={e => setRateForm({ ...rateForm, base_rate: e.target.value })} /></div>
              <div><Label>$/Mile<PCRTooltip text={ADMIN_TOOLTIPS.mileage_rate} /></Label><Input type="number" step="0.0001" value={rateForm.mileage_rate} onChange={e => setRateForm({ ...rateForm, mileage_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Wait $/Min<PCRTooltip text={ADMIN_TOOLTIPS.wait_rate} /></Label><Input type="number" step="0.0001" value={rateForm.wait_rate_per_min} onChange={e => setRateForm({ ...rateForm, wait_rate_per_min: e.target.value })} /></div>
              <div><Label>O₂ Fee ($)<PCRTooltip text={ADMIN_TOOLTIPS.oxygen_fee} /></Label><Input type="number" step="0.01" value={rateForm.oxygen_fee} onChange={e => setRateForm({ ...rateForm, oxygen_fee: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Extra Attendant ($)<PCRTooltip text={ADMIN_TOOLTIPS.extra_attendant} /></Label><Input type="number" step="0.01" value={rateForm.extra_attendant_fee} onChange={e => setRateForm({ ...rateForm, extra_attendant_fee: e.target.value })} /></div>
              <div><Label>Bariatric Fee ($)<PCRTooltip text={ADMIN_TOOLTIPS.bariatric_fee} /></Label><Input type="number" step="0.01" value={rateForm.bariatric_fee} onChange={e => setRateForm({ ...rateForm, bariatric_fee: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={saveRate} disabled={savingRate}>
              {savingRate ? "Saving…" : "Save Rate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fix 19: Orphan secondary claim warning dialog */}
      <Dialog open={!!orphanWarning} onOpenChange={o => { if (!o) setOrphanWarning(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-yellow))]" />
              Linked Secondary Claim
            </DialogTitle>
            <DialogDescription>
              This claim has a linked secondary claim. Changing the status to{" "}
              <span className="font-semibold text-foreground">{orphanWarning?.newStatus?.replace("_", " ")}</span>{" "}
              may leave the secondary claim without a valid reference. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            If you proceed, the secondary claim will be moved to <strong>Needs Review</strong> status automatically.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOrphanWarning(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setOrphanWarning(null);
                await executeClaimSave(true);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Denial Recovery Engine */}
      {recoveryClaimId && (
        <DenialRecoveryEngine
          claim={{
            id: recoveryClaimId.id,
            trip_id: recoveryClaimId.trip_id,
            patient_name: recoveryClaimId.patient_name ?? "Unknown",
            denial_code: recoveryClaimId.denial_code,
            denial_reason: recoveryClaimId.denial_reason,
            run_date: recoveryClaimId.run_date,
            total_charge: recoveryClaimId.total_charge,
            payer_name: recoveryClaimId.payer_name,
            payer_type: recoveryClaimId.payer_type,
            member_id: recoveryClaimId.member_id,
            resubmission_count: (recoveryClaimId as any).resubmission_count ?? null,
            resubmitted_at: (recoveryClaimId as any).resubmitted_at ?? null,
            submitted_at: recoveryClaimId.submitted_at,
            company_id: (recoveryClaimId as any).company_id ?? null,
          }}
          open={!!recoveryClaimId}
          onOpenChange={open => { if (!open) setRecoveryClaimId(null); }}
          onComplete={() => { setRecoveryClaimId(null); fetchData(); }}
        />
      )}
    </AdminLayout>
  );
}
