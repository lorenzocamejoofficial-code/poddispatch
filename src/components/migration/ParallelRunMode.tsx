import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ParallelRunModeProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}

export function ParallelRunMode({ enabled, onToggle }: ParallelRunModeProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Parallel Run Mode</CardTitle>
              <CardDescription>
                Run PodDispatch alongside your current system. Trips marked "Test Mode" won't affect real billing.
              </CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={onToggle} />
          </div>
        </CardHeader>
        {enabled && (
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">Safe Mode Active</span>
                <Badge variant="outline" className="text-xs ml-auto">No billing impact</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                All new trips will be flagged as test data. You can compare outputs against your current system for 30–90 days.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Accuracy Score</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Start entering trips to measure</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Missing Data</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Fields needed before going live</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Billing Ready</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">% of trips ready to bill</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Readiness Checklist</h4>
              <div className="space-y-2">
                {[
                  "Active patients imported",
                  "Facilities configured",
                  "Charge Master rates set",
                  "Payer billing rules configured",
                  "Crew accounts created",
                  "7+ days of parallel trips entered",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
