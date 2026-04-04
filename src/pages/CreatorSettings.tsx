import { useState, useEffect } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, ShieldCheck, Bell, Globe, Trash2, RotateCcw, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CreatorSettings() {
  const [clearing, setClearing] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  const [resetCompanyId, setResetCompanyId] = useState("");
  const [resetConfirmName, setResetConfirmName] = useState("");
  const [resetting, setResetting] = useState(false);

  const [cacValue, setCacValue] = useState("");
  const [savingCac, setSavingCac] = useState(false);

  const selectedResetCompany = companies.find((c) => c.id === resetCompanyId);
  const resetNameMatch = selectedResetCompany && resetConfirmName === selectedResetCompany.name;

  useEffect(() => {
    supabase
      .from("creator_settings")
      .select("value")
      .eq("key", "cac_per_customer")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCacValue(data.value);
      });
  }, []);

  const handleSaveCac = async () => {
    setSavingCac(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("creator_settings")
      .update({ value: cacValue, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("key", "cac_per_customer");
    if (error) {
      toast.error("Failed to save CAC: " + error.message);
    } else {
      toast.success("Customer Acquisition Cost updated.");
    }
    setSavingCac(false);
  };

  const handleResetCompanyData = async () => {
    if (!resetCompanyId || !resetNameMatch || !selectedResetCompany) return;
    setResetting(true);

    const steps: { label: string; fn: () => Promise<{ error: any }> }[] = [
      {
        label: "notifications",
        fn: async () => {
          const { data: profileIds } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("company_id", resetCompanyId);
          if (!profileIds || profileIds.length === 0) return { error: null };
          const userIds = profileIds.map((p) => p.user_id);
          return supabase.from("notifications").delete().in("user_id", userIds);
        },
      },
      { label: "alerts", fn: async () => supabase.from("alerts").delete().eq("company_id", resetCompanyId) },
      { label: "hold_timers", fn: async () => supabase.from("hold_timers").delete().eq("company_id", resetCompanyId) },
      { label: "qa_reviews", fn: async () => supabase.from("qa_reviews").delete().eq("company_id", resetCompanyId) },
      {
        label: "billing_overrides",
        fn: async () => {
          const { data: tripIds } = await supabase
            .from("trip_records")
            .select("id")
            .eq("company_id", resetCompanyId);
          if (!tripIds || tripIds.length === 0) return { error: null };
          return supabase.from("billing_overrides").delete().in("trip_id", tripIds.map((t) => t.id));
        },
      },
      { label: "claim_records", fn: async () => supabase.from("claim_records").delete().eq("company_id", resetCompanyId) },
      { label: "trip_records", fn: async () => supabase.from("trip_records").delete().eq("company_id", resetCompanyId) },
      { label: "truck_run_slots", fn: async () => supabase.from("truck_run_slots").delete().eq("company_id", resetCompanyId) },
      { label: "schedule_change_log", fn: async () => supabase.from("schedule_change_log").delete().eq("company_id", resetCompanyId) },
      { label: "scheduling_legs", fn: async () => supabase.from("scheduling_legs").delete().eq("company_id", resetCompanyId) },
      { label: "crews", fn: async () => supabase.from("crews").delete().eq("company_id", resetCompanyId) },
    ];

    for (const step of steps) {
      const { error } = await step.fn();
      if (error) {
        toast.error(`Reset failed at "${step.label}": ${error.message}`);
        setResetting(false);
        return;
      }
    }

    // Audit log
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      await supabase.from("audit_logs").insert({
        action: "creator_data_reset",
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        table_name: "companies",
        record_id: resetCompanyId,
        notes: `Operational data reset for "${selectedResetCompany.name}" at ${new Date().toISOString()}`,
        company_id: resetCompanyId,
      });
    }

    toast.success(`Company data reset complete — ${selectedResetCompany.name} is ready for fresh data.`);
    setResetCompanyId("");
    setResetConfirmName("");
    setResetting(false);
  };

  const loadCompanies = async () => {
    if (companiesLoaded) return;
    const { data } = await supabase.from("companies").select("id, name").order("name");
    if (data) setCompanies(data);
    setCompaniesLoaded(true);
  };

  const handleClearTestEmployees = async () => {
    if (!targetCompanyId) { toast.error("Select a company first"); return; }
    setClearing(true);
    // Protect the owner's profile
    const { data: ownerMembership } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", targetCompanyId)
      .eq("role", "owner")
      .maybeSingle();
    const ownerUserId = ownerMembership?.user_id;
    let query = supabase.from("profiles").delete().eq("company_id", targetCompanyId);
    if (ownerUserId) {
      query = query.neq("user_id", ownerUserId);
    }
    const { error } = await query;
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Non-owner employees cleared for selected company.");
    }
    setClearing(false);
  };

  return (
    <CreatorLayout title="System Settings">
      <div className="space-y-6 max-w-2xl">
        <Collapsible className="mb-2">
          <CollapsibleTrigger className="text-xs text-primary hover:underline">ℹ️ How this works</CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p>System-level settings control platform-wide behavior — approval workflows, notifications, and access policies.</p>
            <p>These are separate from company-level settings, which are managed inside each tenant's App Simulation.</p>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Platform Configuration</h3>
          <p className="text-xs text-muted-foreground">
            System-level settings for the PodDispatch platform. Company-level settings are managed inside App Simulation.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Approval & Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Manual Approval Required</Label>
                <p className="text-xs text-muted-foreground">New companies require creator approval before activation</p>
              </div>
              <Switch checked={true} disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Training Mode for Pending Companies</Label>
                <p className="text-xs text-muted-foreground">Give pending companies access to tutorial environment</p>
              </div>
              <Switch checked={true} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Email on New Signup</Label>
                <p className="text-xs text-muted-foreground">Receive email when a new company signs up</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                <Switch checked={false} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Signup Enabled</Label>
                <p className="text-xs text-muted-foreground">Allow new companies to register via the signup page</p>
              </div>
              <Switch checked={true} disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Temporarily disable access for all non-creator users</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                <Switch checked={false} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Data Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Remove leftover test/demo employee profiles from a company. The company Owner's profile is always preserved.
            </p>
            <div className="flex items-center gap-3">
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId} onOpenChange={(open) => open && loadCompanies()}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleClearTestEmployees}
                disabled={clearing || !targetCompanyId}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {clearing ? "Clearing…" : "Clear Test Employees"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-destructive" />
              Reset Company Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Wipe all operational data for a company — trips, scheduling, billing, crews, alerts, and notifications.
              Preserves the company record, users, trucks, facilities, patients, and settings.
            </p>
            <div className="space-y-3">
              <Select value={resetCompanyId} onValueChange={(v) => { setResetCompanyId(v); setResetConfirmName(""); }} onOpenChange={(open) => open && loadCompanies()}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedResetCompany && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Type <span className="font-mono font-bold text-foreground">{selectedResetCompany.name}</span> to confirm
                  </Label>
                  <Input
                    value={resetConfirmName}
                    onChange={(e) => setResetConfirmName(e.target.value)}
                    placeholder={selectedResetCompany.name}
                    className="w-64 font-mono"
                    autoComplete="off"
                  />
                </div>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetCompanyData}
                disabled={resetting || !resetNameMatch}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Reset Operational Data"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CAC Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Customer Acquisition Cost (CAC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter your average cost to acquire a new customer. This feeds the LTV:CAC ratio on the SaaS Metrics dashboard.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  value={cacValue}
                  onChange={(e) => setCacValue(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
              <Button size="sm" onClick={handleSaveCac} disabled={savingCac}>
                {savingCac ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </CreatorLayout>
  );
}
