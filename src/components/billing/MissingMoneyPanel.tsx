import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import {
  useMissingMoneyScan,
  type MissingMoneyCategorySummary,
} from "@/hooks/useMissingMoneyScan";
import {
  DollarSign, AlertTriangle, ChevronDown, ChevronRight,
  ArrowRight, CheckCircle, FileText, Send, Shield, XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  no_pcr: { icon: <FileText className="h-4 w-4" />, color: "text-destructive" },
  pcr_not_billed: { icon: <Send className="h-4 w-4" />, color: "text-[hsl(var(--status-yellow))]" },
  no_followup: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-[hsl(var(--status-yellow))]" },
  secondary_not_billed: { icon: <Shield className="h-4 w-4" />, color: "text-primary" },
  denial_no_action: { icon: <XCircle className="h-4 w-4" />, color: "text-destructive" },
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact version for Owner Command Center */
export function MissingMoneySummary() {
  const { loading, categories, totalAmount, lastScanAt, hasIssues } = useMissingMoneyScan();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasIssues) {
    return (
      <Card className="border-[hsl(var(--status-green))]/40">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[hsl(var(--status-green))]" />
            <p className="text-sm font-semibold text-[hsl(var(--status-green))]">All Revenue Captured</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            No missing money detected across all five checks.
            {lastScanAt && ` Last scanned ${lastScanAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeCategories = categories.filter((c) => c.count > 0);

  return (
    <Card className="border-destructive/30">
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-destructive" />
            <p className="text-sm font-semibold">Missing Money Detected</p>
            <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">
              ${fmt(totalAmount)} at risk
            </Badge>
          </div>
          {lastScanAt && (
            <p className="text-[10px] text-muted-foreground">
              Scanned {lastScanAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat.category];
            return (
              <Card key={cat.category} className="bg-muted/30">
                <CardContent className="pt-4 pb-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={config?.color}>{config?.icon}</span>
                    <p className="text-xs font-medium truncate">{cat.label}</p>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-muted-foreground">{cat.count} {cat.count === 1 ? "item" : "items"}</p>
                    <p className={`text-sm font-bold ${config?.color}`}>${fmt(cat.amount)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-[11px] h-7"
                    onClick={() => navigate(cat.route)}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />Resolve
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Full detail version for Billing & Claims Missing Money tab */
export function MissingMoneyDetail() {
  const { loading, categories, totalAmount, lastScanAt, hasIssues } = useMissingMoneyScan();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!hasIssues) {
    return (
      <Card className="border-[hsl(var(--status-green))]/40">
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-10 w-10 text-[hsl(var(--status-green))] mx-auto mb-3" />
          <p className="font-semibold text-[hsl(var(--status-green))]">All Revenue Captured</p>
          <p className="text-sm text-muted-foreground mt-1">
            No missing money detected.
            {lastScanAt && ` Last scanned ${lastScanAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-semibold">Total Missing Money</p>
            <p className="text-2xl font-bold text-destructive">${fmt(totalAmount)}</p>
          </div>
        </div>
        {lastScanAt && (
          <p className="text-xs text-muted-foreground">
            Last scanned {lastScanAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>

      {/* Category cards with expandable items */}
      {categories.filter((c) => c.count > 0).map((cat) => (
        <CategoryDetailCard key={cat.category} cat={cat} navigate={navigate} />
      ))}
    </div>
  );
}

function CategoryDetailCard({ cat, navigate }: { cat: MissingMoneyCategorySummary; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const config = CATEGORY_CONFIG[cat.category];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardContent className="pt-4 pb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <span className={config?.color}>{config?.icon}</span>
                <p className="text-sm font-medium">{cat.label}</p>
                <Badge variant="outline" className="text-[10px]">{cat.count}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm font-bold ${config?.color}`}>${fmt(cat.amount)}</p>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Patient</TableHead>
                    {cat.category === "no_pcr" || cat.category === "pcr_not_billed" ? (
                      <TableHead className="text-xs">Truck</TableHead>
                    ) : (
                      <TableHead className="text-xs">Payer</TableHead>
                    )}
                    <TableHead className="text-xs">Date</TableHead>
                    {(cat.category === "no_followup") && (
                      <TableHead className="text-xs text-right">Days Out</TableHead>
                    )}
                    {cat.category === "denial_no_action" && (
                      <TableHead className="text-xs">Denial</TableHead>
                    )}
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cat.items.slice(0, 50).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.patientName}</TableCell>
                      <TableCell className="text-xs">{item.truckName ?? item.payerName ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(item.runDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </TableCell>
                      {cat.category === "no_followup" && (
                        <TableCell className="text-xs text-right">{item.daysOutstanding ?? "—"}</TableCell>
                      )}
                      {cat.category === "denial_no_action" && (
                        <TableCell className="text-xs">
                          <span className="font-mono">{item.denialCode}</span>
                          {item.denialExplanation && (
                            <span className="text-muted-foreground ml-1 text-[10px]">— {item.denialExplanation}</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-xs text-right font-medium">${fmt(item.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            if (cat.category === "no_pcr" || cat.category === "pcr_not_billed") {
                              navigate("/trips");
                            } else if (cat.category === "no_followup" || cat.category === "denial_no_action") {
                              navigate("/ar-command-center");
                            } else {
                              navigate("/billing");
                            }
                          }}
                        >
                          {cat.category === "no_pcr" || cat.category === "pcr_not_billed"
                            ? "Open PCR"
                            : cat.category === "no_followup" || cat.category === "denial_no_action"
                              ? "Go to AR"
                              : "Open Claim"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {cat.items.length > 50 && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Showing 50 of {cat.items.length} items.{" "}
                  <button className="underline" onClick={() => navigate(cat.route)}>View all</button>
                </p>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
