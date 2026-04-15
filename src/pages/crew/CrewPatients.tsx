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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = toDateString(new Date());

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      // 1. Find crew's truck for today
      const { data: crewRow } = await supabase
        .from("crews")
        .select("truck_id")
        .eq("active_date", today)
        .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
        .maybeSingle();

      if (!crewRow) { setPatients([]); setLoading(false); return; }

      // 2. Get leg ids from today's truck run slots
      const { data: slots } = await supabase
        .from("truck_run_slots")
        .select("leg_id")
        .eq("truck_id", crewRow.truck_id)
        .eq("run_date", today);

      if (!slots?.length) { setPatients([]); setLoading(false); return; }

      const legIds = slots.map(s => s.leg_id);

      // 3. Get patient ids from scheduling legs
      const { data: legs } = await supabase
        .from("scheduling_legs")
        .select("patient_id")
        .in("id", legIds)
        .not("patient_id", "is", null);

      const patientIds = [...new Set((legs ?? []).map(l => l.patient_id).filter(Boolean))] as string[];

      if (!patientIds.length) { setPatients([]); setLoading(false); return; }

      // 4. Fetch only those patients
      const { data } = await supabase
        .from("patients")
        .select("id, first_name, last_name, transport_type, phone, schedule_days, pickup_address, dropoff_facility, sex, weight_lbs, mobility, oxygen_required, bariatric, stair_chair_required, notes, primary_payer, member_id, recurrence_days")
        .in("id", patientIds)
        .order("last_name", { ascending: true });

      setPatients((data as Patient[]) ?? []);
      setLoading(false);
    })();

    // Realtime: refetch when slots or legs change
    const channel = supabase.channel("crew-patients-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => {
        if (!profileId) return;
        // Re-run the fetch
        setLoading(true);
        (async () => {
          const { data: crewRow } = await supabase
            .from("crews")
            .select("truck_id")
            .eq("active_date", today)
            .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
            .maybeSingle();
          if (!crewRow) { setPatients([]); setLoading(false); return; }
          const { data: slots } = await supabase
            .from("truck_run_slots")
            .select("leg_id")
            .eq("truck_id", crewRow.truck_id)
            .eq("run_date", today);
          if (!slots?.length) { setPatients([]); setLoading(false); return; }
          const legIds = slots.map(s => s.leg_id);
          const { data: legs } = await supabase
            .from("scheduling_legs")
            .select("patient_id")
            .in("id", legIds)
            .not("patient_id", "is", null);
          const patientIds = [...new Set((legs ?? []).map(l => l.patient_id).filter(Boolean))] as string[];
          if (!patientIds.length) { setPatients([]); setLoading(false); return; }
          const { data } = await supabase
            .from("patients")
            .select("id, first_name, last_name, transport_type, phone, schedule_days, pickup_address, dropoff_facility, sex, weight_lbs, mobility, oxygen_required, bariatric, stair_chair_required, notes, primary_payer, member_id, recurrence_days")
            .in("id", patientIds)
            .order("last_name", { ascending: true });
          setPatients((data as Patient[]) ?? []);
          setLoading(false);
        })();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs" }, () => {
        // Also refetch when legs change (patient_id might be set)
        if (!profileId) return;
        setLoading(true);
        (async () => {
          const { data: crewRow } = await supabase
            .from("crews")
            .select("truck_id")
            .eq("active_date", today)
            .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
            .maybeSingle();
          if (!crewRow) { setPatients([]); setLoading(false); return; }
          const { data: slots } = await supabase
            .from("truck_run_slots")
            .select("leg_id")
            .eq("truck_id", crewRow.truck_id)
            .eq("run_date", today);
          if (!slots?.length) { setPatients([]); setLoading(false); return; }
          const legIds = slots.map(s => s.leg_id);
          const { data: legs } = await supabase
            .from("scheduling_legs")
            .select("patient_id")
            .in("id", legIds)
            .not("patient_id", "is", null);
          const patientIds = [...new Set((legs ?? []).map(l => l.patient_id).filter(Boolean))] as string[];
          if (!patientIds.length) { setPatients([]); setLoading(false); return; }
          const { data } = await supabase
            .from("patients")
            .select("id, first_name, last_name, transport_type, phone, schedule_days, pickup_address, dropoff_facility, sex, weight_lbs, mobility, oxygen_required, bariatric, stair_chair_required, notes, primary_payer, member_id, recurrence_days")
            .in("id", patientIds)
            .order("last_name", { ascending: true });
          setPatients((data as Patient[]) ?? []);
          setLoading(false);
        })();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId, today]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    );
  }, [patients, search]);

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
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {search.trim() ? "No matching patients" : "No patients assigned for today."}
          </p>
        ) : (
          <div className="space-y-2">
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