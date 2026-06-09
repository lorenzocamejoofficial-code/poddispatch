import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationPreferences } from "@/hooks/useNotificationFeed";

export function NotificationPreferencesCard() {
  const { digestMode, setDigestMode, loading } = useNotificationPreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Notification Preferences</CardTitle>
        <CardDescription className="text-xs">
          Control how the notification bell behaves for your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="digest-mode" className="text-sm">Digest mode</Label>
            <p className="text-xs text-muted-foreground">
              Hide low-priority FYI notifications from the live bell. Action-required items still appear instantly.
              A daily morning summary email is on the roadmap.
            </p>
          </div>
          <Switch
            id="digest-mode"
            checked={digestMode}
            disabled={loading}
            onCheckedChange={setDigestMode}
          />
        </div>
      </CardContent>
    </Card>
  );
}