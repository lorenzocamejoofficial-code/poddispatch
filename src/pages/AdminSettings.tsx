import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList } from "lucide-react";

export default function AdminSettings() {
  const [settingsId, setSettingsId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [graceWindow, setGraceWindow] = useState("15");
  const [loadTime, setLoadTime] = useState("10");
  const [unloadTime, setUnloadTime] = useState("10");
  const [facilityDelay, setFacilityDelay] = useState("10");
  const [dialysisBuffer, setDialysisBuffer] = useState("15");
  const [dischargeBuffer, setDischargeBuffer] = useState("20");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("company_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setCompanyName(data.company_name);
        setGraceWindow(String((data as any).grace_window_minutes ?? 15));
        setLoadTime(String((data as any).load_time_minutes ?? 10));
        setUnloadTime(String((data as any).unload_time_minutes ?? 10));
        setFacilityDelay(String((data as any).facility_delay_minutes ?? 10));
        setDialysisBuffer(String((data as any).dialysis_b_leg_buffer_minutes ?? 15));
        setDischargeBuffer(String((data as any).discharge_buffer_minutes ?? 20));
      }
    });
  }, []);

  const save = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    await supabase.from("company_settings").update({
      company_name: companyName.trim(),
      grace_window_minutes: parseInt(graceWindow),
      load_time_minutes: parseInt(loadTime),
      unload_time_minutes: parseInt(unloadTime),
      facility_delay_minutes: parseInt(facilityDelay),
      dialysis_b_leg_buffer_minutes: parseInt(dialysisBuffer),
      discharge_buffer_minutes: parseInt(dischargeBuffer),
    } as any).eq("id", settingsId);
    toast.success("Settings saved");
    setSaving(false);
  };

  const CHECKLIST = [
    { id: "A1", label: "Create at least one Truck (Trucks & Crews page → Add Truck)" },
    { id: "A2", label: "Create at least two Employees marked Active with phone numbers (Employees page → Add Employee)" },
    { id: "A3", label: "Assign crew members to a Truck for the test date (Trucks & Crews → assign crew)" },
    { id: "A4", label: "Create at least 3 patient runs on the test date and assign to a truck (Scheduling page)" },
    { id: "A5", label: "Generate a Crew Run Sheet share link for that truck/date and confirm it appears in Active Share Links (Crew Schedule Delivery)" },
    { id: "A6", label: "Open the run sheet link on a phone WITHOUT login and confirm truck/date/runs display correctly" },
    { id: "A7", label: "Crew updates a run status on the link — confirm it reflects in the Dispatch Board" },
  ];

  const RECURRENCE_CHECKLIST = [
    { id: "R1", label: "Create a Dialysis patient with Transport Type = Dialysis, MWF schedule, recurrence start = next Monday, no end date" },
    { id: "R2", label: "In Scheduling, navigate to the next 4 MWF dates and run Auto-Fill — verify runs appear in the Run Pool on each correct day" },
    { id: "R3", label: "Assign a run to a truck, reorder it, then click the pencil icon and edit that one day's pickup location — confirm crew run sheet shows the exception" },
    { id: "R4", label: "Change the patient's status to 'In Hospital', then run Auto-Fill on a future MWF date — verify that patient is NOT included in the Run Pool" },
    { id: "R5", label: "Restore patient status to Active — verify Auto-Fill includes them again on the next scheduled date" },
  ];

  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("testChecklist") ?? "[]")); }
    catch { return new Set(); }
  });
  const [recChecked, setRecChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("recurrenceChecklist") ?? "[]")); }
    catch { return new Set(); }
  });
  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("testChecklist", JSON.stringify([...next]));
      return next;
    });
  };
  const toggleRecCheck = (id: string) => {
    setRecChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("recurrenceChecklist", JSON.stringify([...next]));
      return next;
    });
  };
  const allDone = CHECKLIST.every((c) => checked.has(c.id));
  const allRecDone = RECURRENCE_CHECKLIST.every((c) => recChecked.has(c.id));

  return (
    <AdminLayout>
      <div className="max-w-lg space-y-8">
        {/* Company */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Company Settings</h3>
            <p className="text-sm text-muted-foreground">Manage company name and operational parameters.</p>
          </div>
          <div>
            <Label>Company Display Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
        </section>

        {/* Grace Window */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">On-Time Settings</h3>
            <p className="text-sm text-muted-foreground">Grace window for pickup arrivals and feasibility checks.</p>
          </div>
          <div>
            <Label>Late Threshold (Grace Window)</Label>
            <Select value={graceWindow} onValueChange={setGraceWindow}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Service Time Defaults */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Service Time Defaults</h3>
            <p className="text-sm text-muted-foreground">Default times used in schedule feasibility calculations.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Load Time (min)</Label>
              <Input type="number" value={loadTime} onChange={(e) => setLoadTime(e.target.value)} />
            </div>
            <div>
              <Label>Unload Time (min)</Label>
              <Input type="number" value={unloadTime} onChange={(e) => setUnloadTime(e.target.value)} />
            </div>
            <div>
              <Label>Facility Delay Buffer (min)</Label>
              <Input type="number" value={facilityDelay} onChange={(e) => setFacilityDelay(e.target.value)} />
            </div>
            <div>
              <Label>Dialysis B-Leg Buffer (min)</Label>
              <Input type="number" value={dialysisBuffer} onChange={(e) => setDialysisBuffer(e.target.value)} />
            </div>
            <div>
              <Label>Discharge Buffer (min)</Label>
              <Input type="number" value={dischargeBuffer} onChange={(e) => setDischargeBuffer(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Limits info */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">System Limits</h3>
            <p className="text-sm text-muted-foreground">Hard-capped for this version.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-muted-foreground">Max Admins</p>
              <p className="text-lg font-bold text-foreground">4</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-muted-foreground">Max Crews</p>
              <p className="text-lg font-bold text-foreground">30</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-muted-foreground">Max Trucks</p>
              <p className="text-lg font-bold text-foreground">12</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-muted-foreground">Runs per Truck</p>
              <p className="text-lg font-bold text-foreground">10</p>
            </div>
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>

        {/* ── TEST READINESS CHECKLIST ── */}
        <section className="space-y-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Staging Test Readiness Checklist</h3>
            {allDone && (
              <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[hsl(var(--status-green))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> All steps complete
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Check each step once verified. Progress is saved locally in this browser.
          </p>
          <div className="space-y-2.5">
            {CHECKLIST.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <Checkbox
                  checked={checked.has(item.id)}
                  onCheckedChange={() => toggleCheck(item.id)}
                  className="mt-0.5 shrink-0"
                />
                <span className={`text-xs leading-relaxed ${checked.has(item.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  <strong className="text-primary mr-1">{item.id}.</strong>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
          {!allDone && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setChecked(new Set());
                localStorage.removeItem("testChecklist");
              }}
            >
              Reset all
            </Button>
          )}
        </section>

        {/* ── RECURRENCE QUICK TEST ── */}
        <section className="space-y-3 rounded-lg border-2 border-dashed border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[hsl(var(--status-yellow))]" />
            <h3 className="text-sm font-semibold text-foreground">Recurrence Quick Test Checklist</h3>
            {allRecDone && (
              <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[hsl(var(--status-green))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> All steps verified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Verify recurring dialysis scheduling, Run Pool, exception editing, and patient status suppression.
          </p>
          <div className="space-y-2.5">
            {RECURRENCE_CHECKLIST.map((item) => (
              <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  checked={recChecked.has(item.id)}
                  onCheckedChange={() => toggleRecCheck(item.id)}
                  className="mt-0.5 shrink-0"
                />
                <span className={`text-xs leading-relaxed ${recChecked.has(item.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  <strong className="text-[hsl(var(--status-yellow))] mr-1">{item.id}.</strong>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
          {!allRecDone && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setRecChecked(new Set());
                localStorage.removeItem("recurrenceChecklist");
              }}
            >
              Reset all
            </Button>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
