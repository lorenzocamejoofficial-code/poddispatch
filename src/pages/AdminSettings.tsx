import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
      </div>
    </AdminLayout>
  );
}
