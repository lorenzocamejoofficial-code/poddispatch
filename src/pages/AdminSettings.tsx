import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings2, Network, Phone, Mail } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { TrialBanner } from "@/components/onboarding/TrialBanner";

export default function AdminSettings() {
  const { role } = useAuth();
  const isOwner = role === "owner" || role === "creator";
  const isAdmin = isOwner || role === "manager";
  const [settingsId, setSettingsId] = useState("");
  const [graceWindow, setGraceWindow] = useState("15");
  const [loadTime, setLoadTime] = useState("10");
  const [unloadTime, setUnloadTime] = useState("10");
  const [facilityDelay, setFacilityDelay] = useState("10");
  const [dialysisBuffer, setDialysisBuffer] = useState("15");
  const [dischargeBuffer, setDischargeBuffer] = useState("20");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [sessionWarningEnabled, setSessionWarningEnabled] = useState(true);
  const [retentionYears, setRetentionYears] = useState("7");
  const [verifiedCallerId, setVerifiedCallerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {},
      });
      if (error) {
        toast.error("Test email failed", { description: error.message });
        return;
      }
      if (!data?.ok) {
        toast.error("Test email failed", { description: data?.error ?? "Unknown error" });
        return;
      }
      toast.success("Test email sent", {
        description: `Sent to ${data.sent_to} from "${data.from_label}". Check your inbox (and spam).`,
      });
    } catch (e: any) {
      toast.error("Test email failed", { description: e?.message ?? "Unknown error" });
    } finally {
      setSendingTestEmail(false);
    }
  };

  useEffect(() => {
    supabase.from("company_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setGraceWindow(String((data as any).grace_window_minutes ?? 15));
        setLoadTime(String((data as any).load_time_minutes ?? 10));
        setUnloadTime(String((data as any).unload_time_minutes ?? 10));
        setFacilityDelay(String((data as any).facility_delay_minutes ?? 10));
        setDialysisBuffer(String((data as any).dialysis_b_leg_buffer_minutes ?? 15));
        setDischargeBuffer(String((data as any).discharge_buffer_minutes ?? 20));
        setSessionTimeout(String((data as any).session_timeout_minutes ?? 30));
        setSessionWarningEnabled((data as any).session_warning_enabled ?? true);
        setRetentionYears(String((data as any).retention_policy_years ?? 7));
        setVerifiedCallerId(String((data as any).verified_caller_id ?? ""));
      }
    });

  }, []);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      grace_window_minutes: parseInt(graceWindow),
      load_time_minutes: parseInt(loadTime),
      unload_time_minutes: parseInt(unloadTime),
      facility_delay_minutes: parseInt(facilityDelay),
      dialysis_b_leg_buffer_minutes: parseInt(dialysisBuffer),
      discharge_buffer_minutes: parseInt(dischargeBuffer),
      session_timeout_minutes: parseInt(sessionTimeout),
      session_warning_enabled: sessionWarningEnabled,
      verified_caller_id: verifiedCallerId.trim() || null,
    };
    // Retention policy is owner-narrow (legal/compliance commitment).
    if (isOwner) payload.retention_policy_years = parseInt(retentionYears);
    await supabase.from("company_settings").update(payload as any).eq("id", settingsId);
    toast.success("Settings saved");
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <TrialBanner />
        <OnboardingChecklist />

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList>
            <TabsTrigger value="company" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Company
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <div className="max-w-lg space-y-8">
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Company Settings</h3>
           <p className="text-sm text-muted-foreground">Manage operational parameters.</p>
          </div>
        </section>

        {/* Email Diagnostics */}
        {isAdmin && (
          <section className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Email Diagnostics</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a test email to your own address to verify deliverability and preview the
                  sender name your crews and patients will see.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail}
            >
              {sendingTestEmail ? "Sending…" : "Send test email to me"}
            </Button>
          </section>
        )}

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

        {/* Session Security */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Session Security</h3>
            <p className="text-sm text-muted-foreground">HIPAA-compliant session timeout for all users.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Session Timeout</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sessionWarningEnabled
                  ? "Auto-logout after 30 minutes of inactivity with a 5-minute warning"
                  : "Disabled — users stay logged in until they sign out manually (not recommended)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{sessionWarningEnabled ? "ON" : "OFF"}</span>
              <Checkbox
                id="sessionToggle"
                checked={sessionWarningEnabled}
                onCheckedChange={(v) => {
                  const enabled = v === true;
                  setSessionWarningEnabled(enabled);
                  setSessionTimeout(enabled ? "30" : "0");
                }}
              />
            </div>
          </div>
          {!sessionWarningEnabled && (
            <p className="text-xs text-destructive font-medium">⚠️ Disabling session timeout may violate HIPAA compliance requirements.</p>
          )}
        </section>

        {/* Data Retention Policy */}
        {isOwner && (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Data Retention Policy</h3>
            <p className="text-sm text-muted-foreground">Medicare requires 7-year minimum retention for transport records.</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Retention Period</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trip records, PCR data, and billing documents are retained for {retentionYears} year{retentionYears !== "1" ? "s" : ""}.
                </p>
              </div>
              <Select value={retentionYears} onValueChange={setRetentionYears}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 years</SelectItem>
                  <SelectItem value="10">10 years</SelectItem>
                  <SelectItem value="15">15 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t pt-2">
              ℹ️ No records are automatically deleted. This setting documents your company's retention commitment for audit compliance.
            </p>
          </div>
        </section>
        )}

        {/* Limits info */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">System Limits</h3>
            <p className="text-sm text-muted-foreground">Operational caps for this deployment.</p>
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
              <p className="text-lg font-bold text-foreground">30</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-muted-foreground">Runs per Truck</p>
              <p className="text-lg font-bold text-foreground">10</p>
            </div>
            <div className="rounded-lg border bg-card p-3 col-span-2">
              <p className="text-muted-foreground text-xs">Overload threshold (snapshot warning)</p>
              <p className="text-lg font-bold text-foreground">8 <span className="text-sm font-normal text-muted-foreground">runs/truck</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Trucks with &gt;8 runs show as "Overloaded" in the Daily Ops Snapshot. Green = 6–8, Yellow = 3–5, Red = 0–2 or &gt;10.</p>
            </div>
          </div>
        </section>

        {/* Communications */}
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Communications
            </h3>
            <p className="text-sm text-muted-foreground">
              Outbound caller ID for automated patient and facility calls.
            </p>
          </div>
          <div>
            <Label>Verified Caller ID</Label>
            <Input
              type="tel"
              value={verifiedCallerId}
              onChange={(e) => setVerifiedCallerId(e.target.value)}
              placeholder="+15555550123"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Enter the business phone number you've verified with our calling provider as an outgoing caller ID. Use E.164 format (e.g. +15555550123). If left blank, our default outbound number will be used.
            </p>
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
