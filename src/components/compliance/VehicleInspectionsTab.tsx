import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle, AlertTriangle, ClipboardCheck, Download, ChevronDown, ChevronUp } from "lucide-react";
import { INSPECTION_CATEGORIES } from "@/lib/vehicle-inspection-items";

interface InspectionRecord {
  id: string;
  truck_id: string;
  truck_name: string;
  run_date: string;
  submitted_by_name: string | null;
  submitted_at: string;
  total_items: number;
  missing_count: number;
  status: string;
  items_checked: any[];
}

interface AlertRecord {
  id: string;
  inspection_id: string;
  missing_item_label: string;
  crew_note: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  dispatcher_response: string | null;
  dispatcher_note: string | null;
}

export function VehicleInspectionsTab() {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [trucks, setTrucks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [truckFilter, setTruckFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: inspRows }, { data: alertRows }, { data: truckRows }] = await Promise.all([
      supabase
        .from("vehicle_inspections" as any)
        .select("*, truck:trucks!vehicle_inspections_truck_id_fkey(name)")
        .gte("run_date", dateFrom)
        .lte("run_date", dateTo)
        .order("run_date", { ascending: false }),
      supabase.from("vehicle_inspection_alerts" as any).select("*"),
      supabase.from("trucks").select("id, name").eq("active", true).order("name"),
    ]);

    const mapped: InspectionRecord[] = ((inspRows ?? []) as any[]).map((r: any) => ({
      id: r.id,
      truck_id: r.truck_id,
      truck_name: r.truck?.name ?? "Unknown",
      run_date: r.run_date,
      submitted_by_name: r.submitted_by_name,
      submitted_at: r.submitted_at,
      total_items: r.total_items,
      missing_count: r.missing_count,
      status: r.status,
      items_checked: r.items_checked ?? [],
    }));

    setInspections(truckFilter === "all" ? mapped : mapped.filter(i => i.truck_id === truckFilter));
    setAlerts((alertRows ?? []) as any[]);
    setTrucks((truckRows ?? []) as any[]);
    setLoading(false);
  }, [dateFrom, dateTo, truckFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = () => {
    const headers = ["Date", "Truck", "Submitted By", "Submitted At", "Total Items", "Missing", "Status"];
    const rows = inspections.map(i => [
      i.run_date,
      i.truck_name,
      i.submitted_by_name ?? "",
      new Date(i.submitted_at).toLocaleString(),
      i.total_items,
      i.missing_count,
      i.status === "has_missing" ? "Has Missing" : "Complete",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicle-inspections-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Truck</label>
          <Select value={truckFilter} onValueChange={setTruckFilter}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trucks</SelectItem>
              {trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      {inspections.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No inspection records"
          description="Vehicle inspection records will appear here once crews start submitting daily inspections."
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Truck</th>
                <th className="px-4 py-3 text-left">Submitted By</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-center">Missing</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Acknowledged</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {inspections.map(insp => {
                const inspAlerts = alerts.filter(a => a.inspection_id === insp.id);
                const allAcknowledged = inspAlerts.length > 0 && inspAlerts.every(a => a.acknowledged_by_name);
                const isExpanded = expandedId === insp.id;

                return (
                  <tr key={insp.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : insp.id)}>
                    <td className="px-4 py-3 text-foreground">{insp.run_date}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{insp.truck_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{insp.submitted_by_name ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{insp.total_items}</td>
                    <td className="px-4 py-3 text-center">
                      {insp.missing_count > 0 ? (
                        <span className="text-destructive font-semibold">{insp.missing_count}</span>
                      ) : "0"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {insp.status === "has_missing" ? (
                        <Badge variant="destructive" className="text-[10px]">Has Missing</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green))]/90">Complete</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inspAlerts.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : allAcknowledged ? (
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Expanded detail */}
          {expandedId && (() => {
            const insp = inspections.find(i => i.id === expandedId);
            if (!insp) return null;
            const inspAlerts = alerts.filter(a => a.inspection_id === insp.id);
            return (
              <div className="border-t bg-muted/10 p-4 space-y-3">
                {INSPECTION_CATEGORIES.map(cat => {
                  const catItems = insp.items_checked.filter((i: any) => i.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat}>
                      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{cat}</h5>
                      <div className="space-y-0.5">
                        {catItems.map((item: any) => {
                          const alert = inspAlerts.find(a => a.missing_item_label === item.item_label);
                          return (
                            <div key={item.item_key} className="flex items-start gap-2 text-xs">
                              {item.status === "ok" ? (
                                <CheckCircle className="h-3 w-3 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                              )}
                              <span className="flex-1 text-foreground">{item.item_label}</span>
                              {item.crew_note && <span className="text-muted-foreground italic">Crew: {item.crew_note}</span>}
                              {alert?.dispatcher_response && (
                                <span className={`font-medium ${alert.dispatcher_response === "cleared" ? "text-[hsl(var(--status-green))]" : "text-destructive"}`}>
                                  {alert.dispatcher_response === "cleared" ? "Cleared" : "Hold"} by {alert.acknowledged_by_name}
                                  {alert.dispatcher_note && ` — ${alert.dispatcher_note}`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
