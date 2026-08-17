import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Phone, ChevronDown, ChevronUp, Droplets, Weight, Accessibility, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  transport_type: string;
  phone: string | null;
  schedule_days: string | null;
  pickup_address: string | null;
  dropoff_facility: string | null;
  sex: string | null;
  weight_lbs: number | null;
  mobility: string | null;
  oxygen_required: boolean | null;
  bariatric: boolean | null;
  stair_chair_required: boolean | null;
  notes: string | null;
  primary_payer: string | null;
  member_id: string | null;
  recurrence_days: number[] | null;
}

/** A one-off rider has no patient record — it only exists on the leg. */
interface OneOffRider {
  id: string;
  name: string;
  transport_type: string | null;
  pickup: string | null;
  destination: string | null;
  pickup_time: string | null;
}

type EmptyReason = "no_crew" | "no_runs" | "no_patients" | null;

const TRANSPORT_COLORS: Record<string, string> = {
  dialysis: "bg-primary/10 text-primary",
  outpatient: "bg-accent text-accent-foreground",
  ift: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  discharge: "bg-muted text-muted-foreground",
  outpatient_specialty: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  private_pay: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  emergency: "bg-destructive/10 text-destructive",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatScheduleDays(days: number[] | null, legacy: string | null): string {
  if (days && days.length > 0) return days.map(d => DAY_NAMES[d] ?? d).join(", ");
  if (legacy) return legacy.replace(/_/g, " ");
  return "—";
}

function formatSex(s: string | null): string {
  if (!s) return "—";
  if (s === "M") return "Male";
  if (s === "F") return "Female";
  if (s === "U") return "Unknown";
  return s;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CrewPatients() {
  const { profileId } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [oneOffs, setOneOffs] = useState<OneOffRider[]>([]);
  const [emptyReason, setEmptyReason] = useState<EmptyReason>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = toDateString(new Date());

  const fetchPatients = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    setEmptyReason(null);

    const fail = (msg: string) => { setError(msg); setPatients([]); setOneOffs([]); setLoading(false); };
    const empty = (reason: EmptyReason) => { setEmptyReason(reason); setPatients([]); setOneOffs([]); setLoading(false); };

    // 1. Find crew's truck for today
    const { data: crewRows, error: crewErr } = await supabase
      .from("crews")
      .select("truck_id")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
      .limit(1);

    if (crewErr) return fail(crewErr.message);

    const crewRow = crewRows?.[0];
    if (!crewRow) return empty("no_crew");

    // 2. Get leg ids from today's truck run slots
    const { data: slots, error: slotErr } = await supabase
      .from("truck_run_slots")
      .select("leg_id")
      .eq("truck_id", crewRow.truck_id)
      .eq("run_date", today);

    if (slotErr) return fail(slotErr.message);
    if (!slots?.length) return empty("no_runs");

    const legIds = slots.map(s => s.leg_id);

    // 3. Get patient ids from scheduling legs (one-off legs carry no patient_id)
    const { data: legs, error: legErr } = await supabase
      .from("scheduling_legs")
      .select("id, patient_id, is_oneoff, oneoff_name, trip_type, pickup_location, destination_location, pickup_time")
      .in("id", legIds);

    if (legErr) return fail(legErr.message);

    const riders: OneOffRider[] = (legs ?? [])
      .filter(l => !l.patient_id)
      .map(l => ({
        id: l.id,
        name: (l.oneoff_name as string | null)?.trim() || l.pickup_location || "One-off rider",
        transport_type: (l.trip_type as string | null) ?? null,
        pickup: l.pickup_location ?? null,
        destination: l.destination_location ?? null,
        pickup_time: l.pickup_time ?? null,
      }));
    setOneOffs(riders);

    const patientIds = [...new Set((legs ?? []).map(l => l.patient_id).filter(Boolean))] as string[];

    if (!patientIds.length) {
      setPatients([]);
      setEmptyReason(riders.length ? null : "no_runs");
      setLoading(false);
      return;
    }

    // 4. Fetch only those patients
    const { data, error: patErr } = await supabase
      .from("patients")
      .select("id, first_name, last_name, transport_type, phone, schedule_days, pickup_address, dropoff_facility, sex, weight_lbs, mobility, oxygen_required, bariatric, stair_chair_required, notes, primary_payer, member_id, recurrence_days")
      .in("id", patientIds)
      .order("last_name", { ascending: true });

    if (patErr) return fail(patErr.message);
    if (!data?.length && !riders.length) return empty("no_patients");

    setPatients((data as Patient[]) ?? []);
    setLoading(false);
  }, [profileId, today]);

  useEffect(() => {
    fetchPatients();

    const channel = supabase.channel("crew-patients-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => fetchPatients())
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs" }, () => fetchPatients())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchPatients())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPatients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const filteredOneOffs = useMemo(() => {
    if (!search.trim()) return oneOffs;
    const q = search.toLowerCase();
    return oneOffs.filter(o => o.name.toLowerCase().includes(q));
  }, [oneOffs, search]);

  const EMPTY_COPY: Record<Exclude<EmptyReason, null>, { title: string; body: string }> = {
    no_crew: {
      title: "No crew assignment for today",
      body: "You're not on a truck for today's date. Check with dispatch if you believe this is wrong.",
    },
    no_runs: {
      title: "Assigned, but no runs scheduled",
      body: "You're on a truck today, but dispatch hasn't put any runs on it yet.",
    },
    no_patients: {
      title: "Runs scheduled, but no patient records",
      body: "Your runs today don't have patient records attached yet. Dispatch can link them on the schedule.",
    },
  };

  return (
    <CrewLayout>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today's Assigned Patients</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search today's patients..."
            className="pl-9 h-11"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-1">
            <p className="text-sm font-medium text-destructive">Couldn't load today's patients</p>
            <p className="text-xs text-muted-foreground break-words">{error}</p>
          </div>
        ) : filtered.length === 0 && filteredOneOffs.length === 0 ? (
          search.trim() ? (
            <p className="text-center text-sm text-muted-foreground py-8">No matching patients</p>
          ) : (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                {EMPTY_COPY[emptyReason ?? "no_runs"].title}
              </p>
              <p className="text-xs text-muted-foreground">
                {EMPTY_COPY[emptyReason ?? "no_runs"].body}
              </p>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {filteredOneOffs.map(o => (
              <div key={o.id} className="border border-border rounded-lg bg-card px-4 py-3">
                <p className="font-medium text-sm text-foreground truncate">{o.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">One-off</Badge>
                  {o.transport_type && (
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", TRANSPORT_COLORS[o.transport_type])}>
                      {o.transport_type.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {o.pickup_time && (
                    <span className="text-xs text-muted-foreground font-mono">{o.pickup_time.substring(0, 5)}</span>
                  )}
                </div>
                {(o.pickup || o.destination) && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{o.pickup ?? "—"} → {o.destination ?? "—"}</p>
                )}
              </div>
            ))}
            {filtered.map(p => {
              const isExpanded = expandedId === p.id;
              return (
                <div key={p.id} className="border border-border rounded-lg bg-card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", TRANSPORT_COLORS[p.transport_type])}>
                          {p.transport_type?.replace(/_/g, " ") ?? "—"}
                        </Badge>
                        {p.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatScheduleDays(p.recurrence_days, p.schedule_days)}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/30">
                      <DetailRow label="Pickup Address" value={p.pickup_address} />
                      <DetailRow label="Dropoff Facility" value={p.dropoff_facility} />
                      <DetailRow label="Schedule" value={formatScheduleDays(p.recurrence_days, p.schedule_days)} />
                      <DetailRow label="Sex" value={formatSex(p.sex)} />
                      <DetailRow label="Weight" value={p.weight_lbs ? `${p.weight_lbs} lbs` : null} />
                      <DetailRow label="Mobility" value={p.mobility} />

                      <div className="flex flex-wrap gap-2">
                        {p.oxygen_required && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Droplets className="h-3 w-3" /> O₂ Required
                          </Badge>
                        )}
                        {p.bariatric && (
                          <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                            <Weight className="h-3 w-3" /> Bariatric
                          </Badge>
                        )}
                        {p.stair_chair_required && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Accessibility className="h-3 w-3" /> Stair Chair
                          </Badge>
                        )}
                      </div>

                      {p.notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Stethoscope className="h-3 w-3" /> Notes
                          </p>
                          <p className="text-sm text-foreground">{p.notes}</p>
                        </div>
                      )}

                      <div className="border-t border-border pt-2 space-y-1">
                        <DetailRow label="Primary Insurance" value={p.primary_payer} />
                        <DetailRow label="Member ID" value={p.member_id} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CrewLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value || "—"}</span>
    </div>
  );
}