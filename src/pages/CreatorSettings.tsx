import { useState } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, ShieldCheck, Bell, Globe, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CreatorSettings() {
  const [clearing, setClearing] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

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
      </div>
    </CreatorLayout>
  );
}
