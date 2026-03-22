import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore as useGlobalSchedulingStore } from "@/hooks/useSchedulingStore";
import { supabase } from "@/integrations/supabase/client";
import { evaluateSafetyRules, type PatientNeeds, type CrewCapability, type TruckEquipment } from "@/lib/safety-rules";
import { useAuth } from "@/hooks/useAuth";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Link2, Trash2, Truck, AlertCircle, CalendarIcon, UserPlus, Phone, Mail, MessageSquareText, RefreshCw, Check } from "lucide-react";
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
  email: string | null;
  truck_id: string | null;
  truck_name: string | null;
}

function buildRunSheetUrl(token: string): string {
  return `${window.location.origin}/crew/${token}`;
}

export default function CrewScheduleAdmin() {
  const { user } = useAuth();
  const { trucks, legs, crews } = useSchedulingStore();
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [companyName, setCompanyName] = useState("Dispatch");
  const [downTruckIds, setDownTruckIds] = useState<Set<string>>(new Set());

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();
  const { selectedDate: scheduleDate, setSelectedDate: setScheduleDate } = useGlobalSchedulingStore();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Section 1: Crew invite
  const [inviteCrewId, setInviteCrewId] = useState("");
  const [inviteSendVia, setInviteSendVia] = useState<"phone" | "email">("phone");
  const [inviteCopied, setInviteCopied] = useState(false);

  // Section 2: Daily schedule text
  const [scheduleTruckId, setScheduleTruckId] = useState("");
  const [scheduleCopied, setScheduleCopied] = useState(false);

  // Section 3: Backup share link
  const [backupTruckId, setBackupTruckId] = useState("");

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
      id: t.id, token: t.token, truck_id: t.truck_id,
      truck_name: t.truck?.name ?? "Unknown",
      valid_from: t.valid_from, valid_until: t.valid_until,
      active: t.active, created_at: t.created_at,
    })));
  }, []);

  const fetchEmployees = useCallback(async () => {
    const [{ data: profiles }, { data: memberships }, { data: crewRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone_number, user_id, active, company_id").order("full_name"),
      supabase.from("company_memberships").select("user_id, role"),
      supabase.from("crews")
        .select("member1_id, member2_id, truck_id, truck:trucks!crews_truck_id_fkey(name)")
        .eq("active_date", scheduleDate),
    ]);
    // Build a set of user_ids that have an active crew membership
    const crewMemberUserIds = new Set(
      (memberships ?? []).filter((m: any) => m.role === "crew").map((m: any) => m.user_id)
    );
    // Only include profiles that are active AND have a crew membership
    const validProfiles = (profiles ?? []).filter((p: any) => p.active && crewMemberUserIds.has(p.user_id));

    const crewMap = new Map<string, { truck_id: string; truck_name: string }>();
    for (const c of (crewRows ?? []) as any[]) {
      const info = { truck_id: c.truck_id, truck_name: c.truck?.name ?? "" };
      if (c.member1_id) crewMap.set(c.member1_id, info);
      if (c.member2_id) crewMap.set(c.member2_id, info);
    }
    setEmployees(validProfiles.map((p: any) => ({
      id: p.id, full_name: p.full_name, phone_number: p.phone_number,
      email: null,
      truck_id: crewMap.get(p.id)?.truck_id ?? null,
      truck_name: crewMap.get(p.id)?.truck_name ?? null,
    })));
  }, [scheduleDate]);

  const fetchDownTrucks = useCallback(async () => {
    const { data } = await supabase.from("truck_availability").select("truck_id")
      .lte("start_date", scheduleDate).gte("end_date", scheduleDate);
    setDownTruckIds(new Set((data ?? []).map((r: any) => r.truck_id)));
  }, [scheduleDate]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchDownTrucks(); }, [fetchDownTrucks]);

  useEffect(() => {
    const channel = supabase
      .channel("crew-schedule-admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetchEmployees())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_availability" }, () => fetchDownTrucks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEmployees, fetchDownTrucks]);

  const formattedScheduleDate = (() => {
    try {
      const [y, m, d] = scheduleDate.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEE, MMM d, yyyy");
    } catch { return scheduleDate; }
  })();

  // ─── Section 1: Crew Login Invite ───
  const selectedInviteCrew = employees.find(e => e.id === inviteCrewId);
  const publishedUrl = "poddispatch.lovable.app";

  const buildInviteMessage = (emp: ActiveEmployee) => {
    if (inviteSendVia === "phone") {
      return `${companyName} — Crew Login\n\nYou've been set up as a crew member. To view your daily runs:\n\n1. Go to ${publishedUrl}\n2. Tap "Crew"\n3. Log in with your company email and password\n\nSave your password in your phone for quick access.`;
    }
    return `${companyName} — Crew Login\n\nYou've been set up as a crew member on ${companyName}. To view your daily assigned runs, go to ${publishedUrl}, click "Crew", and log in with your company email and password.\n\nSave your credentials in your browser for quick daily access.`;
  };

  const handleCopyInvite = () => {
    if (!selectedInviteCrew) return;
    navigator.clipboard.writeText(buildInviteMessage(selectedInviteCrew));
    setInviteCopied(true);
    toast.success("Crew login invite copied to clipboard");
    setTimeout(() => setInviteCopied(false), 2000);
  };

  // ─── Section 2: Daily Schedule Text ───
  const generateScheduleText = useCallback(() => {
    if (!scheduleTruckId) return "";

    const truck = trucks.find(t => t.id === scheduleTruckId);
    if (!truck) return "";

    const crew = crews.find(c => c.truck_id === scheduleTruckId);
    const truckLegs = legs
      .filter(l => l.assigned_truck_id === scheduleTruckId && l.slot_status !== "cancelled")
      .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));

    if (truckLegs.length === 0) return `Route ${truck.name} — No runs scheduled for ${formattedScheduleDate}`;

    // Determine transport mix
    const types = new Set(truckLegs.map(l => l.trip_type));
    const transportMix = types.size === 1 ? (types.has("dialysis") ? "Dialysis" : "Outpatient") : "Mix";

    const crewNames = crew
      ? `${crew.member1_name ?? "TBD"} / ${crew.member2_name ?? "TBD"}`
      : "No crew assigned";

    let text = `Route ${truck.name} — ${transportMix}\n${crewNames}\n\n`;

    truckLegs.forEach((leg, i) => {
      const time = leg.pickup_time ?? "TBD";
      const chairInfo = leg.chair_time ? `, CT-${leg.chair_time}` : "";
      text += `${i + 1}. ${leg.patient_name} ${leg.leg_type} @ ${time}\n`;
      text += `   ${leg.pickup_location} to ${leg.destination_location}`;
      text += `${chairInfo}\n\n`;
    });

    text += `**** Possible Discharges ****\n`;
    text += `*** Call If Patient Does Not Go ***\n`;
    text += `*** Paperwork Must Be Fully Completed ***\n`;
    text += `# of runs: ${truckLegs.length}`;

    return text;
  }, [scheduleTruckId, trucks, crews, legs, formattedScheduleDate]);

  const handleCopySchedule = () => {
    const text = generateScheduleText();
    if (!text) { toast.error("Select a truck first"); return; }
    navigator.clipboard.writeText(text);
    setScheduleCopied(true);
    toast.success("Schedule text copied to clipboard");
    setTimeout(() => setScheduleCopied(false), 2000);
  };

  // ─── Section 3: Backup Share Link ───
  const generateToken = async () => {
    if (!backupTruckId) { toast.error("Select a truck"); return; }

    // Check for blocked runs
    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("leg_id, leg:scheduling_legs!truck_run_slots_leg_id_fkey(id, patient:patients!scheduling_legs_patient_id_fkey(bariatric, weight_lbs, oxygen_required, oxygen_lpm, stairs_required, stair_chair_required, mobility, special_equipment_required), is_oneoff, oneoff_weight_lbs, oneoff_mobility, oneoff_oxygen)")
      .eq("truck_id", backupTruckId)
      .eq("run_date", scheduleDate);
    const { data: crewRow } = await supabase
      .from("crews")
      .select("*, member1:profiles!crews_member1_id_fkey(sex), member2:profiles!crews_member2_id_fkey(sex)")
      .eq("truck_id", backupTruckId).eq("active_date", scheduleDate).maybeSingle();
    const { data: truckRow } = await supabase
      .from("trucks").select("has_power_stretcher, has_stair_chair, has_oxygen_mount")
      .eq("id", backupTruckId).single();
    const { data: existingOverrides } = await supabase
      .from("safety_overrides").select("leg_id").eq("override_status", "BLOCKED");

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
        blockedLegs.push(isOneoff ? "One-off run" : `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Unknown");
      }
    }

    if (blockedLegs.length > 0) {
      toast.error(`Cannot generate share link — ${blockedLegs.length} run(s) BLOCKED: ${blockedLegs.join(", ")}`);
      return;
    }

    const existing = tokens.find((t) =>
      t.truck_id === backupTruckId && scheduleDate >= t.valid_from && scheduleDate <= t.valid_until
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
      truck_id: backupTruckId, valid_from: validFrom, valid_until: validUntil, created_by: user?.id,
    } as any);

    if (error) { toast.error("Failed to create share link"); return; }
    toast.success("Share link created");
    setBackupTruckId("");
    fetchTokens();
  };

  const revokeToken = async (id: string) => {
    await supabase.from("crew_share_tokens").update({ active: false } as any).eq("id", id);
    toast.success("Link revoked");
    fetchTokens();
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(buildRunSheetUrl(token));
    toast.success("Link copied to clipboard");
  };

  const activeTrucks = trucks.filter(t => !downTruckIds.has(t.id));

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── SCHEDULE DATE ── */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule Date</h3>
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
                  onSelect={(d) => { if (d) { setScheduleDate(d.toISOString().split("T")[0]); setCalendarOpen(false); } }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {scheduleDate !== today && (
              <Button variant="ghost" size="sm" onClick={() => setScheduleDate(today)}>Back to today</Button>
            )}
            {scheduleDate === today && <Badge variant="secondary" className="text-xs">Today</Badge>}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 — CREW LOGIN INVITE
        ══════════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Crew Login Invite</CardTitle>
            </div>
            <CardDescription>
              One-time setup: send a crew member instructions to log in at {publishedUrl}. They tap "Crew" and use their company email + password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label className="text-xs">Crew Member</Label>
                <Select value={inviteCrewId} onValueChange={setInviteCrewId}>
                  <SelectTrigger><SelectValue placeholder="Select crew member" /></SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 && <SelectItem value="__none" disabled>No employees found</SelectItem>}
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}{e.truck_name ? ` — ${e.truck_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Send Via</Label>
                <Select value={inviteSendVia} onValueChange={v => setInviteSendVia(v as "phone" | "email")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> SMS / Text</span></SelectItem>
                    <SelectItem value="email"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCopyInvite} disabled={!inviteCrewId} variant="outline" className="gap-1.5">
                {inviteCopied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--status-green))]" /> : <Copy className="h-3.5 w-3.5" />}
                {inviteCopied ? "Copied!" : "Copy Invite"}
              </Button>
            </div>

            {selectedInviteCrew && (
              <div className="rounded-md bg-muted p-3 space-y-2">
                {inviteSendVia === "phone" && selectedInviteCrew.phone_number && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Phone className="h-2.5 w-2.5 mr-1" /> {selectedInviteCrew.phone_number}
                  </Badge>
                )}
                {inviteSendVia === "phone" && !selectedInviteCrew.phone_number && (
                  <Badge variant="destructive" className="text-[10px]">No phone on file</Badge>
                )}
                <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {buildInviteMessage(selectedInviteCrew)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — DAILY SCHEDULE TEXT
        ══════════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Daily Schedule Text</CardTitle>
            </div>
            <CardDescription>
              Generate a plain-text formatted schedule for a truck. Copy and send via SMS to the crew.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 max-w-xs">
                <Label className="text-xs">Truck</Label>
                <Select value={scheduleTruckId} onValueChange={setScheduleTruckId}>
                  <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                  <SelectContent>
                    {activeTrucks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCopySchedule} disabled={!scheduleTruckId} className="gap-1.5">
                {scheduleCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {scheduleCopied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>

            {scheduleTruckId && (
              <div className="rounded-md bg-muted p-3">
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {generateScheduleText()}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — BACKUP SHARE LINK
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base text-muted-foreground">Backup Access Link</CardTitle>
            </div>
            <CardDescription>
              For crews without app login — generates a token-based link to view the daily run sheet in a browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 max-w-xs">
                <Label className="text-xs">Truck</Label>
                <Select value={backupTruckId} onValueChange={setBackupTruckId}>
                  <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                  <SelectContent>
                    {activeTrucks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generateToken} disabled={!backupTruckId} variant="outline" className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Generate Link
              </Button>
            </div>

            {/* Active tokens */}
            {tokens.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Links</p>
                  <Button variant="ghost" size="sm" onClick={fetchTokens} className="h-6 text-xs">
                    <RefreshCw className="mr-1 h-3 w-3" /> Refresh
                  </Button>
                </div>
                {tokens.map(t => {
                  const isForDate = scheduleDate >= t.valid_from && scheduleDate <= t.valid_until;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border bg-card p-3 gap-3",
                        isForDate && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-card-foreground">{t.truck_name}</span>
                          <p className="text-xs text-muted-foreground">{t.valid_from} → {t.valid_until}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => copyLink(t.token)}>
                          <Copy className="mr-1 h-3 w-3" /> Copy
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeToken(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
