import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, ShieldCheck, Bell, Globe } from "lucide-react";

export default function CreatorSettings() {
  return (
    <CreatorLayout title="System Settings">
      <div className="space-y-6 max-w-2xl">
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
      </div>
    </CreatorLayout>
  );
}
