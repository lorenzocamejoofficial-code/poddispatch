import { useState, useEffect, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore as useGlobalSchedulingStore } from "@/hooks/useSchedulingStore";
import { supabase } from "@/integrations/supabase/client";
import { evaluateSafetyRules, type PatientNeeds, type CrewCapability, type TruckEquipment } from "@/lib/safety-rules";
import { useAuth } from "@/hooks/useAuth";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, RefreshCw, Link2, Trash2, Truck, AlertCircle, CalendarIcon, Search, X, ChevronDown, ChevronUp, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ShareToken {
  id: string;
  token: string;
  truck_id: string;
  truck_name: string;
  valid_from: string;
  valid_until: string;
  active: boolean;
  created_at: string;
}

interface ActiveEmployee {
  id: string;
  full_name: string;
  phone_number: string | null;
  truck_id: string | null;
  truck_name: string | null;
  role: "admin" | "crew" | null;
}

interface SendTarget {
  employee: ActiveEmployee;
  link?: string;
  message?: string;
}

type MessageTemplate = "daily" | "update";

function buildRunSheetUrl(token: string): string {
  const base = window.location.origin;
  return `${base}/crew/${token}`;
}

function isPreviewUrl(url: string): boolean {
  return url.includes("lovable.app") || url.includes("lovableproject.com");
}

function buildMessage(
  template: MessageTemplate,
  companyName: string,
  truckName: string,
  date: string,
  link: string
): string {
  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEEE, MMMM d");
    } catch { return date; }
  })();

  if (template === "daily") {
    return `${companyName} — Daily Run Sheet
Truck: ${truckName}
Date: ${formattedDate}

Open this link to view your runs and update statuses:
${link}

Keep this link open throughout your shift. Refresh to see dispatcher updates.`;
  }

  return `${companyName} — Schedule Update
Truck: ${truckName}
Date: ${formattedDate}

Your run sheet has been updated by dispatch. Open the link below to view the latest:
${link}

Refresh the page if you already have it open.`;
}

// ─── Multi-select recipient picker ───────────────────────────────────────────
interface RecipientPickerProps {
  employees: ActiveEmployee[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

function RecipientPicker({ employees, selectedIds, onChange }: RecipientPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(true);

  const withPhone = employees.filter(e => e.phone_number);
  const noPhone = employees.filter(e => !e.phone_number);

  const filtered = withPhone.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.truck_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const allVisibleSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      filtered.forEach(e => next.delete(e.id));
    } else {
      filtered.forEach(e => next.add(e.id));
    }
    onChange(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const removeChip = (id: string) => {
    const next = new Set(selectedIds);
    next.delete(id);
    onChange(next);
  };

  const selected = employees.filter(e => selectedIds.has(e.id));

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(e => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
            >
              {e.full_name}
              <button onClick={() => removeChip(e.id)} className="hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center text-xs text-muted-foreground pl-1">
            Selected: {selected.length}
          </span>
        </div>
      )}

      {/* Collapsible picker */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              {selected.length === 0 ? "Select recipients" : `${selected.length} selected — click to edit`}
            </span>
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-md border bg-background">
            {/* Search + select all */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name or truck…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="px-3 py-2 border-b">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAll}
                />
                {allVisibleSelected ? "Deselect all" : `Select all${search ? " matching" : ""}`} ({filtered.length})
              </label>
            </div>
            {/* Employee list */}
            <div className="max-h-52 overflow-y-auto divide-y">
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground">No results.</p>
              )}
              {filtered.map(e => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{e.full_name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {e.truck_name && (
                        <span className="text-xs text-muted-foreground">{e.truck_name}</span>
                      )}
                      {e.role && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4">
                          {e.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{e.phone_number}</span>
                </label>
              ))}
              {noPhone.length > 0 && !search && (
                <div className="px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">No phone on file (excluded)</p>
                  {noPhone.map(e => (
                    <p key={e.id} className="text-xs text-muted-foreground/60 line-through py-0.5">{e.full_name}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CrewScheduleAdmin() {
  const { user } = useAuth();
  const { trucks } = useSchedulingStore();
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [selectedTruck, setSelectedTruck] = useState("");
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [companyName, setCompanyName] = useState("Dispatch");
  const [downTruckIds, setDownTruckIds] = useState<Set<string>>(new Set());

  // ── Schedule date: synced with global scheduling store ──
  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();
  const { selectedDate: scheduleDate, setSelectedDate: setScheduleDate } = useGlobalSchedulingStore();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Send panel state
  const [sendMode, setSendMode] = useState<"individual" | "collective">("individual");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [messageTemplate, setMessageTemplate] = useState<MessageTemplate>("daily");
  const [modalTargets, setModalTargets] = useState<ActiveEmployee[]>([]);

  // Individual picker search
  const [indivSearch, setIndivSearch] = useState("");
  const [indivOpen, setIndivOpen] = useState(false);
  const indivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("company_settings").select("company_name").limit(1).maybeSingle().then(({ data }) => {
      if (data?.company_name) setCompanyName(data.company_name);
    });
  }, []);

  const fetchTokens = useCallback(async () => {
    const { data } = await supabase
      .from("crew_share_tokens")
      .select("*, truck:trucks!crew_share_tokens_truck_id_fkey(name)")
      .eq("active", true)
      .order("created_at", { ascending: false });

    setTokens((data ?? []).map((t: any) => ({
      id: t.id,
      token: t.token,
      truck_id: t.truck_id,
      truck_name: t.truck?.name ?? "Unknown",
      valid_from: t.valid_from,
      valid_until: t.valid_until,
      active: t.active,
      created_at: t.created_at,
    })));
  }, []);

  const fetchEmployees = useCallback(async () => {
    const [{ data: profiles }, { data: crews }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone_number").eq("active", true).order("full_name"),
      supabase.from("crews")
        .select("member1_id, member2_id, truck_id, truck:trucks!crews_truck_id_fkey(name)")
        .eq("active_date", scheduleDate),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const crewMap = new Map<string, { truck_id: string; truck_name: string }>();
    for (const c of (crews ?? []) as any[]) {
      const info = { truck_id: c.truck_id, truck_name: c.truck?.name ?? "" };
      if (c.member1_id) crewMap.set(c.member1_id, info);
      if (c.member2_id) crewMap.set(c.member2_id, info);
    }

    // Build profile_id → role map via user_id
    const userRoleMap = new Map<string, "admin" | "crew">();
    for (const r of (roles ?? []) as any[]) {
      userRoleMap.set(r.user_id, r.role);
    }

    // We need user_id from profiles to match roles — fetch it separately
    const { data: fullProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("active", true);
    const profileUserMap = new Map<string, string>();
    for (const p of (fullProfiles ?? []) as any[]) {
      profileUserMap.set(p.id, p.user_id);
    }

    setEmployees((profiles ?? []).map((p: any) => {
      const userId = profileUserMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        phone_number: p.phone_number,
        truck_id: crewMap.get(p.id)?.truck_id ?? null,
        truck_name: crewMap.get(p.id)?.truck_name ?? null,
        role: userId ? (userRoleMap.get(userId) ?? null) : null,
      };
    }));
  }, [scheduleDate]);

  const fetchDownTrucks = useCallback(async () => {
    const { data } = await supabase
      .from("truck_availability")
      .select("truck_id")
      .lte("start_date", scheduleDate)
      .gte("end_date", scheduleDate);
    setDownTruckIds(new Set((data ?? []).map((r: any) => r.truck_id)));
  }, [scheduleDate]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchDownTrucks(); }, [fetchDownTrucks]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("crew-schedule-admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetchEmployees())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_availability" }, () => fetchDownTrucks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEmployees, fetchDownTrucks]);

  const generateToken = async (truckId?: string) => {
    const tid = truckId ?? selectedTruck;
    if (!tid) { toast.error("Select a truck"); return; }

    // Check for unoverridden BLOCKED runs on this truck
    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("leg_id, leg:scheduling_legs!truck_run_slots_leg_id_fkey(id, patient:patients!scheduling_legs_patient_id_fkey(bariatric, weight_lbs, oxygen_required, oxygen_lpm, stairs_required, stair_chair_required, mobility, special_equipment_required), is_oneoff, oneoff_weight_lbs, oneoff_mobility, oneoff_oxygen)")
      .eq("truck_id", tid)
      .eq("run_date", scheduleDate);
    const { data: crewRow } = await supabase
      .from("crews")
      .select("*, member1:profiles!crews_member1_id_fkey(sex), member2:profiles!crews_member2_id_fkey(sex)")
      .eq("truck_id", tid)
      .eq("active_date", scheduleDate)
      .maybeSingle();
    const { data: truckRow } = await supabase
      .from("trucks")
      .select("has_power_stretcher, has_stair_chair, has_oxygen_mount")
      .eq("id", tid)
      .single();
    const { data: existingOverrides } = await supabase
      .from("safety_overrides")
      .select("leg_id")
      .eq("override_status", "BLOCKED");

    const overriddenLegIds = new Set((existingOverrides ?? []).map((o: any) => o.leg_id));
    const crewCap: CrewCapability = {
      member1: crewRow?.member1 ? { sex: (crewRow.member1 as any).sex } : null,
      member2: crewRow?.member2 ? { sex: (crewRow.member2 as any).sex } : null,
    };
    const truckEquip: TruckEquipment = {
      has_power_stretcher: truckRow?.has_power_stretcher ?? false,
      has_stair_chair: truckRow?.has_stair_chair ?? false,
      has_oxygen_mount: truckRow?.has_oxygen_mount ?? false,
    };

    const blockedLegs: string[] = [];
    for (const slot of (slots ?? []) as any[]) {
      const leg = slot.leg;
      if (!leg) continue;
      const patient = leg.patient;
      const isOneoff = leg.is_oneoff;
      const needs: PatientNeeds = isOneoff ? {
        weight_lbs: leg.oneoff_weight_lbs, mobility: leg.oneoff_mobility, oxygen_required: leg.oneoff_oxygen,
        bariatric: null, stairs_required: null, stair_chair_required: null, oxygen_lpm: null, special_equipment_required: null,
      } : {
        weight_lbs: patient?.weight_lbs, mobility: patient?.mobility, stairs_required: patient?.stairs_required,
        stair_chair_required: patient?.stair_chair_required, oxygen_required: patient?.oxygen_required,
        oxygen_lpm: patient?.oxygen_lpm, special_equipment_required: patient?.special_equipment_required,
        bariatric: patient?.bariatric,
      };
      const result = evaluateSafetyRules(needs, crewCap, truckEquip);
      if (result.status === "BLOCKED" && !overriddenLegIds.has(leg.id)) {
        const name = isOneoff ? "One-off run" : `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim();
        blockedLegs.push(name || "Unknown patient");
      }
    }

    if (blockedLegs.length > 0) {
      toast.error(`Cannot generate share link — ${blockedLegs.length} run(s) have BLOCKED safety status requiring dispatcher override: ${blockedLegs.join(", ")}`);
      return;
    }

    const existing = tokens.find((t) =>
      t.truck_id === tid && scheduleDate >= t.valid_from && scheduleDate <= t.valid_until
    );
    if (existing) {
      toast.info("A share link already exists for this truck and date.");
      return;
    }

    const validFrom = scheduleDate;
    const until = new Date(scheduleDate + "T12:00:00");
    until.setDate(until.getDate() + 1);
    const validUntil = until.toISOString().split("T")[0];

    const { error } = await supabase.from("crew_share_tokens").insert({
      truck_id: tid,
      valid_from: validFrom,
      valid_until: validUntil,
      created_by: user?.id,
    } as any);

    if (error) { toast.error("Failed to create share link"); return; }
    toast.success("Share link created");
    setSelectedTruck("");
    fetchTokens();
  };

  const revokeToken = async (id: string) => {
    await supabase.from("crew_share_tokens").update({ active: false } as any).eq("id", id);
    toast.success("Link revoked");
    fetchTokens();
  };

  const copyLink = (token: string) => {
    const url = buildRunSheetUrl(token);
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  // Range-aware lookup against scheduleDate
  const getLinkForTruck = (truckId: string, targetDate: string = scheduleDate): string | undefined => {
    const matching = tokens
      .filter((tk) => tk.truck_id === truckId && targetDate >= tk.valid_from && targetDate <= tk.valid_until)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!matching.length) return undefined;
    return buildRunSheetUrl(matching[0].token);
  };

  const truckHasAnyLink = (truckId: string): boolean =>
    tokens.some((tk) => tk.truck_id === truckId);

  // Check if there are runs for selected truck on scheduleDate
  const [runCountForDate, setRunCountForDate] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedTruck) { setRunCountForDate(null); return; }
    supabase
      .from("truck_run_slots")
      .select("id", { count: "exact", head: true })
      .eq("truck_id", selectedTruck)
      .eq("run_date", scheduleDate)
      .then(({ count }) => setRunCountForDate(count ?? 0));
  }, [selectedTruck, scheduleDate]);

  const employeesWithPhone = employees.filter(e => e.phone_number);

  const getTargets = (): ActiveEmployee[] => {
    if (sendMode === "individual") {
      const e = employees.find((e) => e.id === selectedEmployeeId);
      return e ? [e] : [];
    }
    return employees.filter((e) => selectedEmployeeIds.has(e.id));
  };

  const handleSendLink = () => {
    const targets = getTargets();
    if (!targets.length) { toast.error("Select at least one crew member"); return; }
    setModalTargets(targets);
  };

  const readyModal: SendTarget[] = modalTargets.map((e) => {
    const link = e.truck_id ? getLinkForTruck(e.truck_id) : undefined;
    const truckName = e.truck_name ?? "Unknown";
    const msg = link
      ? buildMessage(messageTemplate, companyName, truckName, scheduleDate, link)
      : undefined;
    return { employee: e, link, message: msg };
  });

  const copyAllMessages = () => {
    const lines = readyModal.map((t) => {
      return `--- ${t.employee.full_name} | ${t.employee.phone_number ?? "(no phone)"} ---\n${t.message ?? "(no link — generate one first)"}`;
    }).join("\n\n");
    navigator.clipboard.writeText(lines);
    toast.success("All messages copied to clipboard");
  };

  const previewLink = buildRunSheetUrl("PREVIEW");
  const showDomainNotice = isPreviewUrl(previewLink);

  const formattedScheduleDate = (() => {
    try {
      const [y, m, d] = scheduleDate.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEE, MMM d, yyyy");
    } catch { return scheduleDate; }
  })();

  // Individual picker filtered
  const indivFiltered = employeesWithPhone.filter(e =>
    e.full_name.toLowerCase().includes(indivSearch.toLowerCase()) ||
    (e.truck_name ?? "").toLowerCase().includes(indivSearch.toLowerCase())
  );
  const selectedIndivEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Determine if selected truck has a link for scheduleDate
  const selectedTruckHasLink = selectedTruck
    ? !!getLinkForTruck(selectedTruck)
    : false;

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Domain Notice */}
        {showDomainNotice && (
          <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--status-yellow-bg))] bg-[hsl(var(--status-yellow-bg))]/30 p-3">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--status-yellow))] shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              <strong>Preview mode:</strong> Generated links use this preview URL. After publishing the app, links will use your permanent domain.
            </p>
          </div>
        )}

        {/* ── SCHEDULE DATE ── */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Schedule Date
          </h3>
          <p className="text-xs text-muted-foreground">
            All link lookups, recipient assignments, and message templates use this date.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-[200px] justify-start">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {formattedScheduleDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduleDate ? new Date(scheduleDate + "T12:00:00") : undefined}
                  onSelect={(d) => {
                    if (d) {
                      setScheduleDate(d.toISOString().split("T")[0]);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {scheduleDate !== today && (
              <Button variant="ghost" size="sm" onClick={() => setScheduleDate(today)}>
                Back to today
              </Button>
            )}
            {scheduleDate === today && (
              <Badge variant="secondary" className="text-xs">Today</Badge>
            )}
          </div>
        </section>

        {/* ── SEND PANEL ── */}
        <section className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Send Run Sheet to Crew
          </h3>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sendMode === "individual" ? "default" : "outline"}
              onClick={() => { setSendMode("individual"); setSelectedEmployeeIds(new Set()); }}
            >
              Individual
            </Button>
            <Button
              size="sm"
              variant={sendMode === "collective" ? "default" : "outline"}
              onClick={() => { setSendMode("collective"); setSelectedEmployeeId(""); }}
            >
              Collective
            </Button>
          </div>

          {/* ── Individual picker ── */}
          {sendMode === "individual" ? (
            <div className="max-w-xs space-y-1">
              <Label className="text-xs">Crew Member</Label>
              <div className="relative" ref={indivRef}>
                <div
                  className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                  onClick={() => setIndivOpen(o => !o)}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {selectedIndivEmployee ? (
                    <span className="flex-1 truncate">{selectedIndivEmployee.full_name}</span>
                  ) : (
                    <span className="flex-1 text-muted-foreground">Search by name…</span>
                  )}
                  {selectedIndivEmployee && (
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); setSelectedEmployeeId(""); setIndivSearch(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {indivOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search…"
                        value={indivSearch}
                        onChange={e => setIndivSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y">
                      {indivFiltered.length === 0 && (
                        <p className="px-3 py-3 text-xs text-muted-foreground">No results.</p>
                      )}
                      {indivFiltered.map(e => (
                        <button
                          key={e.id}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
                          onClick={() => { setSelectedEmployeeId(e.id); setIndivOpen(false); setIndivSearch(""); }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{e.full_name}</p>
                            {e.truck_name && (
                              <p className="text-xs text-muted-foreground">{e.truck_name}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{e.phone_number}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Employees without phone */}
              {employees.filter(e => !e.phone_number).length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {employees.filter(e => !e.phone_number).length} employee(s) without phone excluded.
                </p>
              )}
            </div>
          ) : (
            /* ── Collective picker ── */
            <RecipientPicker
              employees={employees}
              selectedIds={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
            />
          )}

          {/* Message template */}
          <div className="max-w-xs">
            <Label className="mb-1 block text-xs">Message Template</Label>
            <Select value={messageTemplate} onValueChange={(v) => setMessageTemplate(v as MessageTemplate)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily Run Sheet (default)</SelectItem>
                <SelectItem value="update">Schedule Update (revised)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live message preview */}
          {sendMode === "individual" && selectedIndivEmployee?.truck_id && (
            <div className="max-w-lg space-y-1">
              <Label className="text-xs text-muted-foreground">Message Preview</Label>
              <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                {(() => {
                  const link = getLinkForTruck(selectedIndivEmployee.truck_id!);
                  if (link) {
                    return buildMessage(messageTemplate, companyName, selectedIndivEmployee.truck_name ?? "?", scheduleDate, link);
                  }
                  return `(No active link for ${selectedIndivEmployee.truck_name ?? "this truck"} on ${formattedScheduleDate}.\nGenerate a link in the "Generate Crew Share Link" section below.)`;
                })()}
              </pre>
            </div>
          )}

          <Button
            onClick={handleSendLink}
            variant="default"
            disabled={sendMode === "individual" ? !selectedEmployeeId : selectedEmployeeIds.size === 0}
          >
            <Link2 className="mr-1.5 h-4 w-4" /> Prepare Run Sheet Message
          </Button>
        </section>

        {/* ── GENERATE SHARE LINKS ── */}
        <section>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Generate Crew Share Link
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Link for selected truck on <strong>{formattedScheduleDate}</strong>. Stays stable throughout the shift — crews refresh to see updates.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 max-w-xs">
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                <SelectContent>
                  {trucks.filter((t) => !downTruckIds.has(t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTruck && (
              <>
                {selectedTruckHasLink ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30">
                      ✓ Link active for this date
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => {
                      const tk = tokens.find(t => t.truck_id === selectedTruck && scheduleDate >= t.valid_from && scheduleDate <= t.valid_until);
                      if (tk) copyLink(tk.token);
                    }}>
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {runCountForDate === 0 && (
                      <p className="text-xs text-[hsl(var(--status-yellow))]">
                        ⚠ No runs scheduled for this truck on this date.
                      </p>
                    )}
                    <Button onClick={() => generateToken()}>
                      <Link2 className="mr-1.5 h-4 w-4" /> Generate Link for {formattedScheduleDate}
                    </Button>
                  </div>
                )}
              </>
            )}
            {!selectedTruck && (
              <Button onClick={() => generateToken()} disabled>
                <Link2 className="mr-1.5 h-4 w-4" /> Generate Link
              </Button>
            )}
          </div>
        </section>

        {/* ── ACTIVE LINKS ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active Share Links
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchTokens}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {tokens.length === 0 && (
              <p className="text-sm text-muted-foreground">No active share links.</p>
            )}
            {tokens.map((t) => {
              const isForSelectedDate = scheduleDate >= t.valid_from && scheduleDate <= t.valid_until;
              const isToday = today >= t.valid_from && today <= t.valid_until;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-card p-3 gap-3",
                    isForSelectedDate && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-card-foreground">{t.truck_name}</span>
                        {isForSelectedDate && (
                          <Badge className="text-[10px] py-0 bg-primary/10 text-primary border-primary/20">
                            Selected date
                          </Badge>
                        )}
                        {isToday && !isForSelectedDate && (
                          <Badge variant="secondary" className="text-[10px] py-0">Today</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.valid_from} → {t.valid_until}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => copyLink(t.token)}>
                      <Copy className="mr-1 h-3 w-3" /> Copy Link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => revokeToken(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── CREW LOGIN INVITES ── */}
        <CrewInviteSection scheduleDate={scheduleDate} employees={employees} />
      </div>

      {/* ── READY TO SEND MODAL ── */}
      <Dialog open={readyModal.length > 0} onOpenChange={(o) => { if (!o) setModalTargets([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run Sheet Messages — Ready to Send</DialogTitle>
            <DialogDescription>
              Sending for: <strong>{formattedScheduleDate}</strong>. Copy each message and send via SMS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {readyModal.map(({ employee, link, message }) => {
              const hasLinkForTruck = employee.truck_id ? truckHasAnyLink(employee.truck_id) : false;
              const linkExistsForDate = employee.truck_id ? !!getLinkForTruck(employee.truck_id) : false;
              return (
                <div key={employee.id} className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{employee.full_name}</p>
                      <p className="text-xs text-muted-foreground">📞 {employee.phone_number ?? "No phone on file"}</p>
                      {employee.truck_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {employee.truck_name}
                          {linkExistsForDate
                            ? <span className="text-[hsl(var(--status-green))] font-medium ml-1">• link active</span>
                            : <span className="text-destructive font-medium ml-1">• no link for date</span>
                          }
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!message}
                      onClick={() => {
                        navigator.clipboard.writeText(message ?? "");
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                  </div>
                  {message ? (
                    <pre className="text-xs text-foreground bg-muted rounded p-2 whitespace-pre-wrap font-sans leading-relaxed">
                      {message}
                    </pre>
                  ) : !employee.truck_id ? (
                    <p className="text-xs text-muted-foreground italic">
                      No truck assigned to this crew member for {formattedScheduleDate}.
                    </p>
                  ) : hasLinkForTruck ? (
                    <div className="space-y-1.5">
                      <p className="text-xs italic text-[hsl(var(--status-yellow))]">
                        A link exists for this truck, but not for {formattedScheduleDate}.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={async () => {
                          await generateToken(employee.truck_id!);
                          setModalTargets(prev => [...prev]); // trigger re-render
                        }}
                      >
                        <Link2 className="mr-1 h-3 w-3" /> Generate link for this date
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-destructive italic">
                        No active link for this truck on {formattedScheduleDate}.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={async () => {
                          await generateToken(employee.truck_id!);
                          setModalTargets(prev => [...prev]);
                        }}
                      >
                        <Link2 className="mr-1 h-3 w-3" /> Generate link for this date
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={copyAllMessages}>
            <Copy className="mr-2 h-4 w-4" /> Copy All to Clipboard
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
