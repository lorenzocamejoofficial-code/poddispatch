import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { History, FileText, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openClaimTimeline } from "@/components/billing/ClaimTimelineDrawer";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

interface Props {
  patient: Patient | null;
  onOpenChange: (open: boolean) => void;
}

interface TripRow {
  id: string;
  run_date: string;
  pickup_location: string | null;
  destination_location: string | null;
  pcr_status: string | null;
  claim_creation_status: string | null;
  status: string;
}

interface ClaimRow {
  id: string;
  run_date: string;
  total_charge: number | null;
  status: string;
  payer_name: string | null;
  payer_type: string | null;
  payer_claim_control_number: string | null;
}

const DEFAULT_TRIPS_WINDOW_DAYS = 90;
const ROW_CAP = 200;

function formatDays(p: Patient): string {
  const rd = (p as any).recurrence_days as number[] | null;
  const sd = p.schedule_days as string | null;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (rd && rd.length > 0)
    return rd
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d] ?? `Day${d}`)
      .join(", ");
  if (sd === "MWF") return "Mon, Wed, Fri";
  if (sd === "TTS") return "Tue, Thu, Sat";
  return sd || "No schedule";
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b last:border-0 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{value || "—"}</div>
    </div>
  );
}

export function PatientViewDialog({ patient, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("profile");
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Reset per patient
  useEffect(() => {
    if (!patient) return;
    setTab("profile");
    setTrips(null);
    setClaims(null);
    setShowAllTrips(false);
  }, [patient?.id]);

  // Lazy-load trips when Trips tab is opened
  useEffect(() => {
    if (!patient || tab !== "trips" || trips !== null) return;
    let cancelled = false;
    (async () => {
      setLoadingTrips(true);
      const cutoff = showAllTrips
        ? null
        : format(subDays(new Date(), DEFAULT_TRIPS_WINDOW_DAYS), "yyyy-MM-dd");
      let q = supabase
        .from("trip_records")
        .select(
          "id, run_date, pickup_location, destination_location, pcr_status, claim_creation_status, status"
        )
        .eq("patient_id", patient.id)
        .order("run_date", { ascending: false })
        .limit(ROW_CAP);
      if (cutoff) q = q.gte("run_date", cutoff);
      const { data } = await q;
      if (!cancelled) setTrips((data as TripRow[]) ?? []);
      setLoadingTrips(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [patient?.id, tab, showAllTrips, trips]);

  // Lazy-load claims when Claims tab is opened
  useEffect(() => {
    if (!patient || tab !== "claims" || claims !== null) return;
    let cancelled = false;
    (async () => {
      setLoadingClaims(true);
      const { data } = await supabase
        .from("claim_records")
        .select(
          "id, run_date, total_charge, status, payer_name, payer_type, payer_claim_control_number"
        )
        .eq("patient_id", patient.id)
        .order("run_date", { ascending: false })
        .limit(ROW_CAP);
      if (!cancelled) setClaims((data as ClaimRow[]) ?? []);
      setLoadingClaims(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [patient?.id, tab, claims]);

  const open = !!patient;

  const openTripDetails = (trip: TripRow) => {
    onOpenChange(false);
    navigate(`/trips?date=${trip.run_date}`);
  };

  const openClaim = (claim: ClaimRow) => {
    // Open the URL-driven ClaimTimelineDrawer (mounted on /patients). Drawer
    // close just removes ?claim — does NOT affect this dialog's open state.
    openClaimTimeline(setSearchParams, claim.id);
  };

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {patient.first_name} {patient.last_name}
          </DialogTitle>
          <DialogDescription>
            Read-only patient summary, trip history, and claim history.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="trips" className="gap-1">
              <Truck className="h-3.5 w-3.5" /> Trips
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1">
              <FileText className="h-3.5 w-3.5" /> Claims
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="flex-1 overflow-y-auto mt-3">
            <ProfileTab patient={patient} />
          </TabsContent>

          <TabsContent value="trips" className="flex-1 overflow-y-auto mt-3">
            <TripsTab
              loading={loadingTrips}
              trips={trips}
              showAll={showAllTrips}
              onToggleShowAll={() => {
                setShowAllTrips((v) => !v);
                setTrips(null);
              }}
              onRowClick={openTripDetails}
            />
          </TabsContent>

          <TabsContent value="claims" className="flex-1 overflow-y-auto mt-3">
            <ClaimsTab loading={loadingClaims} claims={claims} onRowClick={openClaim} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab({ patient }: { patient: Patient }) {
  const p = patient as any;
  return (
    <div className="space-y-4 px-1">
      <Section title="Identity">
        <Row label="Name" value={`${patient.first_name} ${patient.last_name}`} />
        <Row label="DOB" value={patient.dob ? format(parseISO(patient.dob), "MMM d, yyyy") : null} />
        <Row label="Sex" value={patient.sex} />
        <Row label="Status" value={<Badge variant="outline">{p.status ?? "active"}</Badge>} />
      </Section>

      <Section title="Contact">
        <Row label="Phone" value={patient.phone} />
        <Row label="Pickup address" value={patient.pickup_address} />
        <Row label="Dropoff facility" value={patient.dropoff_facility} />
        <Row label="Home location type" value={p.location_type} />
      </Section>

      <Section title="Coverage">
        <Row label="Primary payer" value={patient.primary_payer} />
        <Row label="Member ID" value={patient.member_id} />
        <Row label="Secondary payer" value={patient.secondary_payer} />
        <Row label="Secondary member ID" value={p.secondary_member_id} />
        <Row
          label="Prior auth UTN"
          value={p.prior_auth_utn || (patient.auth_required ? "Required (no UTN on file)" : null)}
        />
      </Section>

      <Section title="Mobility & Equipment">
        <Row label="Mobility" value={patient.mobility} />
        <Row label="Bariatric" value={patient.bariatric ? "Yes" : "No"} />
        <Row label="Oxygen required" value={patient.oxygen_required ? "Yes" : "No"} />
        <Row label="Weight" value={patient.weight_lbs ? `${patient.weight_lbs} lbs` : null} />
        <Row label="Special handling" value={patient.special_handling} />
      </Section>

      <Section title="PCS">
        <Row label="PCS on file" value={p.pcs_on_file ? "Yes" : "No"} />
        <Row
          label="PCS expiration"
          value={p.pcs_expiration_date ? format(parseISO(p.pcs_expiration_date), "MMM d, yyyy") : null}
        />
        <Row label="PCS physician" value={p.pcs_physician_name} />
        <Row label="PCS physician NPI" value={p.pcs_physician_npi} />
      </Section>

      <Section title="Recurrence">
        <Row label="Transport type" value={patient.transport_type} />
        <Row label="Schedule days" value={formatDays(patient)} />
        <Row label="Standing order" value={patient.standing_order ? "Yes" : "No"} />
        <Row
          label="Recurrence window"
          value={
            patient.recurrence_start_date || patient.recurrence_end_date
              ? `${patient.recurrence_start_date ?? "—"} → ${patient.recurrence_end_date ?? "no end"}`
              : null
          }
        />
        <Row label="Chair time" value={patient.chair_time as any} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function TripsTab({
  loading,
  trips,
  showAll,
  onToggleShowAll,
  onRowClick,
}: {
  loading: boolean;
  trips: TripRow[] | null;
  showAll: boolean;
  onToggleShowAll: () => void;
  onRowClick: (t: TripRow) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!trips || trips.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No trips for this patient"
        description={
          showAll
            ? "This patient has no trip records yet."
            : `No trips in the last ${DEFAULT_TRIPS_WINDOW_DAYS} days. Show all to see older trips.`
        }
        action={
          <Button variant="outline" size="sm" onClick={onToggleShowAll}>
            {showAll ? `Last ${DEFAULT_TRIPS_WINDOW_DAYS} days` : "Show all"}
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-2 px-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {showAll ? "All trips" : `Last ${DEFAULT_TRIPS_WINDOW_DAYS} days`} · {trips.length}
          {trips.length === ROW_CAP ? " (capped)" : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={onToggleShowAll}>
          {showAll ? `Last ${DEFAULT_TRIPS_WINDOW_DAYS} days` : "Show all"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Origin → Destination</th>
              <th className="py-2 pr-3">PCR</th>
              <th className="py-2 pr-3">Claim</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr
                key={t.id}
                onClick={() => onRowClick(t)}
                className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
              >
                <td className="py-2 pr-3 whitespace-nowrap">
                  {format(parseISO(t.run_date), "MMM d, yyyy")}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <span className="text-foreground">{t.pickup_location ?? "—"}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="text-foreground">{t.destination_location ?? "—"}</span>
                </td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px]">
                    {t.pcr_status ?? "not_started"}
                  </Badge>
                </td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px]">
                    {t.claim_creation_status ?? "—"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimsTab({
  loading,
  claims,
  onRowClick,
}: {
  loading: boolean;
  claims: ClaimRow[] | null;
  onRowClick: (c: ClaimRow) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!claims || claims.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No claims for this patient"
        description="This patient has no claim records yet."
      />
    );
  }
  return (
    <div className="space-y-2 px-1">
      <div className="text-xs text-muted-foreground">
        {claims.length}
        {claims.length === ROW_CAP ? " (capped)" : ""} claims
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-3">Claim Ref</th>
              <th className="py-2 pr-3">DOS</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Payer</th>
              <th className="py-2 pr-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
              >
                <td className="py-2 pr-3 font-mono text-xs">
                  {c.payer_claim_control_number ?? c.id.slice(0, 8)}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {format(parseISO(c.run_date), "MMM d, yyyy")}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  ${Number(c.total_charge ?? 0).toFixed(2)}
                </td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px]">
                    {c.status}
                  </Badge>
                </td>
                <td className="py-2 pr-3 text-xs">{c.payer_name ?? c.payer_type ?? "—"}</td>
                <td className="py-2 pr-3">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}