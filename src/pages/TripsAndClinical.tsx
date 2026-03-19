import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSimulationSession } from "@/hooks/useSimulationSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronRight, FileText, Clock, AlertTriangle, XCircle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CleanTripBadge } from "@/components/billing/CleanTripBadge";
import { LocationTypeSelect } from "@/components/billing/LocationTypeSelect";
import {
  computeHcpcsCodes,
  inferLocationType,
  validateLoadedMiles,
  computeCleanTripStatus,
  evaluateDocGates,
  evaluatePcrCompleteness,
  PCR_TYPES,
  LOCATION_TYPES,
} from "@/lib/billing-utils";

type TripStatus = "scheduled" | "assigned" | "en_route" | "arrived_pickup" | "loaded" | "arrived_dropoff" | "completed" | "ready_for_billing" | "cancelled" | "no_show" | "patient_not_ready" | "facility_delay";

interface TripRecord {
  id: string;
  run_date: string;
  status: TripStatus;
  patient_id: string;
  truck_id: string | null;
  loaded_miles: number | null;
  loaded_at: string | null;
  dropped_at: string | null;
  dispatch_time: string | null;
  wait_time_minutes: number | null;
  signature_obtained: boolean;
  pcs_attached: boolean;
  necessity_notes: string | null;
  clinical_note: string | null;
  service_level: string;
  scheduled_pickup_time: string | null;
  pickup_location: string | null;
  destination_location: string | null;
  trip_type: string;
  billing_blocked_reason: string | null;
  slot_id: string | null;
  leg_id: string | null;
  origin_type: string | null;
  destination_type: string | null;
  hcpcs_codes: string[] | null;
  hcpcs_modifiers: string[] | null;
  bed_confined: boolean;
  cannot_transfer_safely: boolean;
  requires_monitoring: boolean;
  oxygen_during_transport: boolean;
  expected_revenue: number;
  claim_ready: boolean;
  blockers: string[];
  pcr_type: string | null;
  arrived_pickup_at: string | null;
  arrived_dropoff_at: string | null;
  // joined
  patient_name?: string;
  truck_name?: string;
  payer?: string;
  auth_expiration?: string | null;
  auth_required?: boolean;
  oxygen_required?: boolean;
  bariatric?: boolean;
}

const STATUS_PIPELINE: TripStatus[] = [
  "scheduled", "assigned", "en_route", "arrived_pickup", "loaded", "arrived_dropoff", "completed", "ready_for_billing"
];

const STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "Scheduled",
  assigned: "Assigned",
  en_route: "En Route",
  arrived_pickup: "Arrived Pickup",
  loaded: "Loaded",
  arrived_dropoff: "Arrived Dropoff",
  completed: "Completed",
  ready_for_billing: "Ready for Billing",
  cancelled: "Cancelled",
  no_show: "No-Show",
  patient_not_ready: "Patient Not Ready",
  facility_delay: "Facility Delay",
};

const STATUS_COLORS: Record<TripStatus, string> = {
  scheduled: "bg-muted text-muted-foreground",
  assigned: "bg-primary/10 text-primary",
  en_route: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
  arrived_pickup: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
  loaded: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
  arrived_dropoff: "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))]",
  completed: "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))]",
  ready_for_billing: "bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))] font-semibold",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-destructive/10 text-destructive",
  patient_not_ready: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
  facility_delay: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
};

export default function TripsAndClinical() {
  const { canManageBilling } = useAuth();
  const { simulationRunId, refreshToken } = useSimulationSession();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [facilityMap, setFacilityMap] = useState<Map<string, string>>(new Map());
  const [payerRulesMap, setPayerRulesMap] = useState<Map<string, any>>(new Map());

  const [form, setForm] = useState({
    loaded_miles: "", loaded_at: "", dropped_at: "", dispatch_time: "", wait_time_minutes: "",
    signature_obtained: false, pcs_attached: false, necessity_notes: "", clinical_note: "", service_level: "BLS",
    origin_type: "", destination_type: "",
    bed_confined: false, cannot_transfer_safely: false, requires_monitoring: false, oxygen_during_transport: false,
    pcr_type: "other",
  });

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      let tripQuery = supabase.from("trip_records" as any).select("*").eq("run_date", dateFilter).order("scheduled_pickup_time", { ascending: true });
      if (simulationRunId) {
        tripQuery = tripQuery.eq("simulation_run_id", simulationRunId);
      }
      const [{ data: tripRows, error }, { data: facilities }, { data: payerRules }] = await Promise.all([
        tripQuery,
        supabase.from("facilities" as any).select("name, facility_type"),
        supabase.from("payer_billing_rules" as any).select("*"),
      ]);

      if (error || !tripRows) { setLoading(false); return; }

      const fMap = new Map<string, string>();
      (facilities ?? []).forEach((f: any) => fMap.set(f.name, f.facility_type));
      setFacilityMap(fMap);

      const prMap = new Map<string, any>();
      (payerRules ?? []).forEach((r: any) => prMap.set(r.payer_type, r));
      setPayerRulesMap(prMap);

      const patientIds = [...new Set((tripRows as any[]).map((t: any) => t.patient_id).filter(Boolean))];
      const truckIds = [...new Set((tripRows as any[]).map((t: any) => t.truck_id).filter(Boolean))];

      const [{ data: pRows }, { data: tRows }] = await Promise.all([
        patientIds.length > 0
          ? supabase.from("patients").select("id, first_name, last_name, primary_payer, auth_expiration, auth_required, oxygen_required, bariatric").in("id", patientIds)
          : Promise.resolve({ data: [] }),
        truckIds.length > 0
          ? supabase.from("trucks").select("id, name").in("id", truckIds)
          : Promise.resolve({ data: [] }),
      ]);

      const pMap = new Map((pRows ?? []).map((p: any) => [p.id, p]));
      const tMap = new Map((tRows ?? []).map((t: any) => [t.id, t]));

      const enriched: TripRecord[] = (tripRows as any[]).map((t: any) => {
        const p = pMap.get(t.patient_id) as any;
        const tr = tMap.get(t.truck_id) as any;
        return {
          ...t,
          patient_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
          truck_name: tr?.name ?? "Unassigned",
          payer: p?.primary_payer ?? "—",
          auth_expiration: p?.auth_expiration ?? null,
          auth_required: p?.auth_required ?? false,
          oxygen_required: p?.oxygen_required ?? false,
          bariatric: p?.bariatric ?? false,
        };
      });

      setTrips(enriched);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, simulationRunId]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  // Re-fetch when simulation session refreshes
  useEffect(() => {
    if (!refreshToken) return;
    setTrips([]);
    fetchTrips();
  }, [refreshToken, fetchTrips]);

  useEffect(() => {
    const ch = supabase
      .channel("trips-clinical-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, fetchTrips)
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => {
        syncSlotsToTrips(dateFilter);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchTrips, dateFilter]);

  const syncSlotsToTrips = async (runDate: string) => {
    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("id, leg_id, truck_id, run_date, company_id, leg:scheduling_legs!truck_run_slots_leg_id_fkey(patient_id, pickup_time, pickup_location, destination_location, trip_type)")
      .eq("run_date", runDate);
    if (!slots?.length) return;

    const { data: existing } = await supabase
      .from("trip_records" as any).select("slot_id").eq("run_date", runDate);
    const existingSlotIds = new Set((existing ?? []).map((e: any) => e.slot_id));

    const newTrips = (slots as any[])
      .filter(s => !existingSlotIds.has(s.id))
      .map(s => {
        const originType = inferLocationType(s.leg?.pickup_location, facilityMap);
        const destType = inferLocationType(s.leg?.destination_location, facilityMap);
        return {
          slot_id: s.id,
          leg_id: s.leg_id,
          patient_id: s.leg?.patient_id ?? null,
          truck_id: s.truck_id,
          run_date: s.run_date,
          company_id: s.company_id,
          status: "assigned",
          scheduled_pickup_time: s.leg?.pickup_time ?? null,
          pickup_location: s.leg?.pickup_location ?? null,
          destination_location: s.leg?.destination_location ?? null,
          trip_type: s.leg?.trip_type ?? "dialysis",
          origin_type: originType,
          destination_type: destType,
        };
      });

    if (newTrips.length > 0) {
      await supabase.from("trip_records" as any).insert(newTrips);
      fetchTrips();
    }
  };

  const openTrip = (trip: TripRecord) => {
    setSelectedTrip(trip);
    const autoOrigin = trip.origin_type || inferLocationType(trip.pickup_location, facilityMap) || "";
    const autoDest = trip.destination_type || inferLocationType(trip.destination_location, facilityMap) || "";
    setForm({
      loaded_miles: trip.loaded_miles?.toString() ?? "",
      loaded_at: trip.loaded_at ? new Date(trip.loaded_at).toISOString().slice(0, 16) : "",
      dropped_at: trip.dropped_at ? new Date(trip.dropped_at).toISOString().slice(0, 16) : "",
      dispatch_time: trip.dispatch_time ? new Date(trip.dispatch_time).toISOString().slice(0, 16) : "",
      wait_time_minutes: trip.wait_time_minutes?.toString() ?? "",
      signature_obtained: trip.signature_obtained,
      pcs_attached: trip.pcs_attached,
      necessity_notes: trip.necessity_notes ?? "",
      clinical_note: trip.clinical_note ?? "",
      service_level: trip.service_level ?? "BLS",
      origin_type: autoOrigin,
      destination_type: autoDest,
      bed_confined: trip.bed_confined ?? false,
      cannot_transfer_safely: trip.cannot_transfer_safely ?? false,
      requires_monitoring: trip.requires_monitoring ?? false,
      oxygen_during_transport: trip.oxygen_during_transport ?? false,
      pcr_type: trip.pcr_type ?? "other",
    });
  };

  const advanceStatus = async (trip: TripRecord) => {
    const idx = STATUS_PIPELINE.indexOf(trip.status);
    if (idx < 0 || idx >= STATUS_PIPELINE.length - 1) return;
    const next = STATUS_PIPELINE[idx + 1];

    // Documentation gate: block ready_for_billing if docs incomplete
    if (next === "ready_for_billing") {
      // PCR-type-aware validation
      const pcrResult = evaluatePcrCompleteness(trip);
      if (!pcrResult.passed) {
        const missingLabels = pcrResult.missing.map(f => f.label);
        toast.error(`PCR requirements not met (${PCR_TYPES.find(p => p.value === trip.pcr_type)?.label ?? "Other"}): ${missingLabels.join(", ")}`);
        return;
      }

      const cleanResult = computeCleanTripStatus(
        trip,
        payerRulesMap.get(trip.payer ?? "") ?? null,
        { auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }
      );
      if (cleanResult.level === "blocked") {
        toast.error(`Cannot mark ready for billing: ${cleanResult.issues.join(", ")}`);
        return;
      }
    }

    const updatePayload: any = { status: next };
    // Auto-set timestamps on status transitions
    if (next === "arrived_pickup") updatePayload.arrived_pickup_at = new Date().toISOString();
    if (next === "loaded") updatePayload.loaded_at = new Date().toISOString();
    if (next === "arrived_dropoff") updatePayload.arrived_dropoff_at = new Date().toISOString();
    if (next === "completed") updatePayload.dropped_at = new Date().toISOString();
    if (next === "ready_for_billing") updatePayload.claim_ready = true;

    await supabase.from("trip_records" as any).update(updatePayload).eq("id", trip.id);
    toast.success(`Status → ${STATUS_LABELS[next]}`);
    fetchTrips();
  };

  const markSpecialStatus = async (trip: TripRecord, status: "no_show" | "patient_not_ready" | "facility_delay" | "cancelled") => {
    await supabase.from("trip_records" as any).update({ status }).eq("id", trip.id);
    toast.success(`Status → ${STATUS_LABELS[status]}`);
    fetchTrips();
  };

  const saveTrip = async () => {
    if (!selectedTrip) return;
    setSaving(true);
    try {
      const miles = form.loaded_miles ? parseFloat(form.loaded_miles) : null;
      const { codes, modifiers } = computeHcpcsCodes({
        service_level: form.service_level,
        loaded_miles: miles,
        wait_time_minutes: form.wait_time_minutes ? parseInt(form.wait_time_minutes) : null,
        oxygen_required: selectedTrip.oxygen_required,
        bariatric: selectedTrip.bariatric,
      });

      const payload: any = {
        loaded_miles: miles,
        loaded_at: form.loaded_at ? new Date(form.loaded_at).toISOString() : null,
        dropped_at: form.dropped_at ? new Date(form.dropped_at).toISOString() : null,
        dispatch_time: form.dispatch_time ? new Date(form.dispatch_time).toISOString() : null,
        wait_time_minutes: form.wait_time_minutes ? parseInt(form.wait_time_minutes) : null,
        signature_obtained: form.signature_obtained,
        pcs_attached: form.pcs_attached,
        necessity_notes: form.necessity_notes || null,
        service_level: form.service_level,
        origin_type: form.origin_type || null,
        destination_type: form.destination_type || null,
        hcpcs_codes: codes,
        hcpcs_modifiers: modifiers,
        bed_confined: form.bed_confined,
        cannot_transfer_safely: form.cannot_transfer_safely,
        requires_monitoring: form.requires_monitoring,
        oxygen_during_transport: form.oxygen_during_transport,
        pcr_type: form.pcr_type,
      };

      // Compute billing block
      const cleanResult = computeCleanTripStatus(
        { ...selectedTrip, ...payload },
        payerRulesMap.get(selectedTrip.payer ?? "") ?? null,
        { auth_required: selectedTrip.auth_required, auth_expiration: selectedTrip.auth_expiration }
      );
      payload.billing_blocked_reason = cleanResult.level === "blocked" ? cleanResult.issues.join(", ") : null;

      await supabase.from("trip_records" as any).update(payload).eq("id", selectedTrip.id);
      toast.success("Trip record saved");
      setSelectedTrip(null);
      fetchTrips();
    } finally {
      setSaving(false);
    }
  };

  const filtered = trips.filter(t => {
    const q = search.toLowerCase();
    const nameMatch = (t.patient_name ?? "").toLowerCase().includes(q);
    const statusMatch = statusFilter === "all" || t.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const authWarning = (trip: TripRecord) =>
    trip.auth_required && trip.auth_expiration && new Date(trip.auth_expiration) <= new Date();

  const milesValidation = form.loaded_miles ? validateLoadedMiles(parseFloat(form.loaded_miles)) : null;

  // Compute current form's clean status for inline display
  const formTripData = selectedTrip ? {
    ...selectedTrip,
    origin_type: form.origin_type, destination_type: form.destination_type,
    loaded_miles: form.loaded_miles ? parseFloat(form.loaded_miles) : null,
    signature_obtained: form.signature_obtained, pcs_attached: form.pcs_attached,
    necessity_notes: form.necessity_notes, loaded_at: form.loaded_at || null,
    dropped_at: form.dropped_at || null, dispatch_time: form.dispatch_time || null,
    bed_confined: form.bed_confined, cannot_transfer_safely: form.cannot_transfer_safely,
    requires_monitoring: form.requires_monitoring, oxygen_during_transport: form.oxygen_during_transport,
    pcr_type: form.pcr_type,
  } : null;

  const currentCleanResult = formTripData ? computeCleanTripStatus(
    formTripData,
    payerRulesMap.get(selectedTrip?.payer ?? "") ?? null,
    { auth_required: selectedTrip?.auth_required, auth_expiration: selectedTrip?.auth_expiration }
  ) : null;

  const currentPcrResult = formTripData ? evaluatePcrCompleteness(formTripData) : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40" />
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_PIPELINE.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => syncSlotsToTrips(dateFilter)}>
            Sync from Dispatch
          </Button>
        </div>

        {/* Status summary bar */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PIPELINE.map(s => {
            const count = trips.filter(t => t.status === s).length;
            if (count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${STATUS_COLORS[s]} ${statusFilter === s ? "ring-2 ring-ring" : ""}`}
              >
                {STATUS_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>

        {/* Trip list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading trips…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-sm">No trips for this date. Run "Sync from Dispatch" after assigning runs.</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Pickup</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Truck</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Miles</th>
                  <th className="px-4 py-3 text-left">Billing</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(trip => (
                  <tr key={trip.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {trip.patient_name}
                      {authWarning(trip) && (
                        <span className="ml-1 text-destructive" title="Auth expired">
                          <AlertTriangle className="inline h-3 w-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{trip.scheduled_pickup_time ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">
                      {trip.pickup_location ?? "—"} → {trip.destination_location ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{trip.truck_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[trip.status]}`}>
                        {STATUS_LABELS[trip.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{trip.loaded_miles ?? "—"}</td>
                    <td className="px-4 py-3">
                      <CleanTripBadge
                        trip={trip}
                        payerRules={payerRulesMap.get(trip.payer ?? "") ?? null}
                        authInfo={{ auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {trip.status !== "cancelled" && trip.status !== "ready_for_billing" && trip.status !== "no_show" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceStatus(trip)}>
                            <ChevronRight className="h-3 w-3 mr-0.5" />
                            {STATUS_LABELS[STATUS_PIPELINE[STATUS_PIPELINE.indexOf(trip.status) + 1] ?? trip.status]}
                          </Button>
                        )}
                        {trip.status !== "cancelled" && trip.status !== "no_show" && trip.status !== "completed" && trip.status !== "ready_for_billing" && (
                          <Select onValueChange={(v: any) => markSpecialStatus(trip, v)}>
                            <SelectTrigger className="h-7 w-20 text-[10px]"><SelectValue placeholder="Flag" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no_show">No-Show</SelectItem>
                              <SelectItem value="patient_not_ready">Not Ready</SelectItem>
                              <SelectItem value="facility_delay">Facility Delay</SelectItem>
                              <SelectItem value="cancelled">Cancel</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openTrip(trip)}>
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trip detail / clinical fields dialog */}
      <Dialog open={!!selectedTrip} onOpenChange={o => { if (!o) setSelectedTrip(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trip Record — {selectedTrip?.patient_name}</DialogTitle>
            <DialogDescription>
              {selectedTrip?.run_date} · {selectedTrip?.pickup_location} → {selectedTrip?.destination_location}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Clean claim status banner */}
            {currentCleanResult && (
              <div className={`rounded-md border p-3 space-y-2 ${
                currentCleanResult.level === "clean" ? "border-[hsl(var(--status-green))]/40 bg-[hsl(var(--status-green))]/5" :
                currentCleanResult.level === "review" ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))]" :
                "border-destructive/40 bg-destructive/5"
              }`}>
                <div className="flex items-center gap-2">
                  {currentCleanResult.level === "clean" ? (
                    <><CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))]" /><span className="text-sm font-semibold text-[hsl(var(--status-green))]">🟢 Clean Claim Ready</span></>
                  ) : currentCleanResult.level === "review" ? (
                    <><AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))]" /><span className="text-sm font-semibold text-[hsl(var(--status-yellow))]">🟡 Review Required</span></>
                  ) : (
                    <><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm font-semibold text-destructive">🔴 Blocked – Missing Required Items</span></>
                  )}
                  <CleanTripBadge
                    trip={{
                      ...selectedTrip!, origin_type: form.origin_type, destination_type: form.destination_type,
                      loaded_miles: form.loaded_miles ? parseFloat(form.loaded_miles) : null,
                      signature_obtained: form.signature_obtained, pcs_attached: form.pcs_attached,
                      necessity_notes: form.necessity_notes, loaded_at: form.loaded_at || null,
                      dropped_at: form.dropped_at || null, dispatch_time: form.dispatch_time || null,
                      bed_confined: form.bed_confined, cannot_transfer_safely: form.cannot_transfer_safely,
                      requires_monitoring: form.requires_monitoring, oxygen_during_transport: form.oxygen_during_transport,
                    }}
                    payerRules={payerRulesMap.get(selectedTrip?.payer ?? "") ?? null}
                    authInfo={{ auth_required: selectedTrip?.auth_required, auth_expiration: selectedTrip?.auth_expiration }}
                    size="md"
                  />
                </div>
                {currentCleanResult.structured_issues.length > 0 && (
                  <ul className="text-xs space-y-1">
                    {currentCleanResult.structured_issues.map((issue, i) => (
                      <li key={i} className={`flex items-center gap-1.5 ${issue.severity === "blocker" ? "text-destructive" : "text-[hsl(var(--status-yellow))]"}`}>
                        {issue.severity === "blocker" ? <XCircle className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {issue.message}
                        <button
                          className="ml-auto text-[10px] underline opacity-70 hover:opacity-100"
                          onClick={() => {
                            // Scroll to the relevant field
                            const el = document.querySelector(`[data-field="${issue.field}"]`);
                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                        >
                          Fix
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Origin / Destination Type */}
            <div className="grid grid-cols-2 gap-3" data-field="origin_type">
              <div data-field="origin_type">
                <LocationTypeSelect
                  label="Origin Type"
                  value={form.origin_type}
                  onChange={v => setForm({ ...form, origin_type: v })}
                  autoValue={selectedTrip ? inferLocationType(selectedTrip.pickup_location, facilityMap) : null}
                />
              </div>
              <div data-field="destination_type">
                <LocationTypeSelect
                  label="Destination Type"
                  value={form.destination_type}
                  onChange={v => setForm({ ...form, destination_type: v })}
                  autoValue={selectedTrip ? inferLocationType(selectedTrip.destination_location, facilityMap) : null}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PCR Type</Label>
                <Select value={form.pcr_type} onValueChange={v => setForm({ ...form, pcr_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PCR_TYPES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service Level</Label>
                <Select value={form.service_level} onValueChange={v => setForm({ ...form, service_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLS">BLS</SelectItem>
                    <SelectItem value="ALS1">ALS1</SelectItem>
                    <SelectItem value="ALS2">ALS2</SelectItem>
                    <SelectItem value="SCT">SCT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div data-field="loaded_miles">
                <Label>Loaded Miles</Label>
                <Input type="number" step="0.1" placeholder="0.0" value={form.loaded_miles}
                  onChange={e => setForm({ ...form, loaded_miles: e.target.value })} />
                {milesValidation && milesValidation.status !== "ok" && (
                  <p className={`text-[10px] mt-0.5 ${milesValidation.status === "error" ? "text-destructive" : "text-[hsl(var(--status-yellow))]"}`}>
                    ⚠ {milesValidation.message}
                  </p>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-3 gap-3">
              <div data-field="dispatch_time">
                <Label>Dispatch Time</Label>
                <Input type="datetime-local" value={form.dispatch_time}
                  onChange={e => setForm({ ...form, dispatch_time: e.target.value })} />
              </div>
              <div data-field="loaded_at">
                <Label>Loaded At</Label>
                <Input type="datetime-local" value={form.loaded_at}
                  onChange={e => setForm({ ...form, loaded_at: e.target.value })} />
              </div>
              <div data-field="dropped_at">
                <Label>Dropped At</Label>
                <Input type="datetime-local" value={form.dropped_at}
                  onChange={e => setForm({ ...form, dropped_at: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Wait Time (minutes)</Label>
              <Input type="number" placeholder="0" value={form.wait_time_minutes}
                onChange={e => setForm({ ...form, wait_time_minutes: e.target.value })} />
            </div>

            {/* Signature + PCS */}
            <div className="flex flex-col gap-3 rounded-md border p-3" data-field="signature_obtained">
              <div className="flex items-center justify-between" data-field="signature_obtained">
                <Label>Signature Obtained</Label>
                <Switch checked={form.signature_obtained}
                  onCheckedChange={v => setForm({ ...form, signature_obtained: v })} />
              </div>
              <div className="flex items-center justify-between" data-field="pcs_attached">
                <Label>PCS Attached (file uploaded)</Label>
                <Switch checked={form.pcs_attached}
                  onCheckedChange={v => setForm({ ...form, pcs_attached: v })} />
              </div>
            </div>

            {/* Structured Medical Necessity Checklist */}
            <div className="rounded-md border p-3 space-y-3" data-field="necessity_checklist">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medical Necessity (Medicare)</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="bed_confined" checked={form.bed_confined}
                    onCheckedChange={(v) => setForm({ ...form, bed_confined: !!v })} />
                  <label htmlFor="bed_confined" className="text-sm">Bed confined at origin</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cannot_transfer" checked={form.cannot_transfer_safely}
                    onCheckedChange={(v) => setForm({ ...form, cannot_transfer_safely: !!v })} />
                  <label htmlFor="cannot_transfer" className="text-sm">Cannot safely transfer without stretcher</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="requires_monitoring" checked={form.requires_monitoring}
                    onCheckedChange={(v) => setForm({ ...form, requires_monitoring: !!v })} />
                  <label htmlFor="requires_monitoring" className="text-sm">Requires medical monitoring</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="oxygen_transport" checked={form.oxygen_during_transport}
                    onCheckedChange={(v) => setForm({ ...form, oxygen_during_transport: !!v })} />
                  <label htmlFor="oxygen_transport" className="text-sm">Oxygen required during transport</label>
                </div>
              </div>
              <div data-field="necessity_notes">
                <Label className="text-xs">Clinical Justification Note</Label>
                <Textarea rows={2} value={form.necessity_notes}
                  onChange={e => setForm({ ...form, necessity_notes: e.target.value })}
                  placeholder="1–2 sentence clinical justification for transport necessity…" />
              </div>
            </div>

            {/* HCPCS preview */}
            {selectedTrip && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Auto HCPCS Codes</p>
                {(() => {
                  const { codes, modifiers } = computeHcpcsCodes({
                    service_level: form.service_level,
                    loaded_miles: form.loaded_miles ? parseFloat(form.loaded_miles) : null,
                    wait_time_minutes: form.wait_time_minutes ? parseInt(form.wait_time_minutes) : null,
                    oxygen_required: selectedTrip.oxygen_required,
                    bariatric: selectedTrip.bariatric,
                  });
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {codes.map(c => (
                        <span key={c} className="rounded bg-primary/10 text-primary text-xs font-mono px-2 py-0.5">{c}</span>
                      ))}
                      {modifiers.map(m => (
                        <span key={m} className="rounded bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] text-xs font-mono px-2 py-0.5">{m}</span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Auth warning */}
            {selectedTrip && authWarning(selectedTrip) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2" data-field="auth_expiration">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Authorization expired on {selectedTrip.auth_expiration}. Update patient authorization before billing.
              </div>
            )}

            <Button className="w-full" onClick={saveTrip} disabled={saving}>
              {saving ? "Saving…" : "Save Clinical Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
