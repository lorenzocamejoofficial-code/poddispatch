import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { ViewAsRole } from "./ViewAsSwitcher";

// Synthetic mock data for sandbox preview — NO real PHI
const MOCK_RUNS = [
  { id: 1, patient: "Test Patient A", pickup: "123 Test St", dest: "Test Dialysis Center", time: "06:30", status: "Pending" },
  { id: 2, patient: "Test Patient B", pickup: "456 Demo Ave", dest: "Test Dialysis Center", time: "07:00", status: "En Route" },
  { id: 3, patient: "Test Patient C", pickup: "789 Sample Blvd", dest: "Test Hospital", time: "08:15", status: "Completed" },
];

const MOCK_BILLING = [
  { id: 1, patient: "Test Patient A", date: "2026-02-20", status: "Ready to Bill", amount: "$245.00" },
  { id: 2, patient: "Test Patient B", date: "2026-02-19", status: "Submitted", amount: "$312.00" },
];

interface SandboxPreviewProps {
  viewAs: ViewAsRole;
}

export function SandboxPreview({ viewAs }: SandboxPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs border-[hsl(var(--status-yellow))] text-[hsl(var(--status-yellow))]">
          🧪 SANDBOX MODE
        </Badge>
        <span className="text-xs text-muted-foreground">
          Viewing as: <strong className="text-foreground capitalize">{viewAs}</strong> — All data is synthetic
        </span>
      </div>

      {(viewAs === "owner" || viewAs === "dispatcher") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Dispatch Board (Synthetic)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {MOCK_RUNS.map((run) => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{run.patient}</p>
                    <p className="text-xs text-muted-foreground">{run.pickup} → {run.dest}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{run.time}</p>
                    <Badge variant="secondary" className="text-[10px]">{run.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(viewAs === "owner" || viewAs === "biller") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Billing Queue (Synthetic)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {MOCK_BILLING.map((claim) => (
                <div key={claim.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{claim.patient}</p>
                    <p className="text-xs text-muted-foreground">{claim.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{claim.amount}</p>
                    <Badge variant="secondary" className="text-[10px]">{claim.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewAs === "crew" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Crew Run Sheet (Read-Only Preview)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Crew view renders via <code className="font-mono text-xs text-primary">/crew/:token</code> — mobile-only, no auth required.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Crew sees: truck info, partner name, run list with status buttons, and documentation capture panel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
