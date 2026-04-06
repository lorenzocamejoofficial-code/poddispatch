import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileWarning, Download, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

interface IncidentRow {
  id: string;
  incident_date: string;
  incident_type: string;
  description: string | null;
  crew_names: string | null;
  additional_personnel: string | null;
  emergency_services_contacted: boolean;
  patient_affected: string | null;
  status: string;
  truck_id: string | null;
  truck_name: string | null;
  trip_id: string | null;
  submitted_by: string;
  submitted_by_name: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const INCIDENT_TYPES = [
  "Patient Refused Transport",
  "Patient Fall During Transfer",
  "Vehicle Accident",
  "Patient Adverse Medical Event",
  "Equipment Failure",
  "Scene Safety Issue",
  "Other",
];

export function IncidentsTab() {
  const { user, role } = useAuth();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [trucks, setTrucks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [truckFilter, setTruckFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Review dialog
  const [reviewTarget, setReviewTarget] = useState<IncidentRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const canReview = role === "owner" || role === "creator";

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("incident_reports")
      .select("*, truck:trucks!incident_reports_truck_id_fkey(name), submitter:profiles!incident_reports_submitted_by_fkey(full_name)")
      .gte("incident_date", dateFrom + "T00:00:00")
      .lte("incident_date", dateTo + "T23:59:59")
      .order("incident_date", { ascending: false });

    if (truckFilter !== "all") query = query.eq("truck_id", truckFilter);
    if (typeFilter !== "all") query = query.eq("incident_type", typeFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const [{ data: rows }, { data: truckRows }] = await Promise.all([
      query,
      supabase.from("trucks").select("id, name").eq("active", true).order("name"),
    ]);

    setIncidents(((rows ?? []) as any[]).map((r: any) => ({
      id: r.id,
      incident_date: r.incident_date,
      incident_type: r.incident_type,
      description: r.description,
      crew_names: r.crew_names,
      additional_personnel: r.additional_personnel,
      emergency_services_contacted: r.emergency_services_contacted,
      patient_affected: r.patient_affected ?? "not_applicable",
      status: r.status ?? "open",
      truck_id: r.truck_id,
      truck_name: r.truck?.name ?? null,
      trip_id: r.trip_id,
      submitted_by: r.submitted_by,
      submitted_by_name: r.submitter?.full_name ?? null,
      review_note: r.review_note,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
    })));
    setTrucks((truckRows ?? []) as any[]);
    setLoading(false);
  }, [dateFrom, dateTo, truckFilter, typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReview = async () => {
    if (!reviewTarget || !user) return;
    setReviewSaving(true);
    const { error } = await supabase
      .from("incident_reports")
      .update({
        status: "reviewed",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote.trim() || null,
      } as any)
      .eq("id", reviewTarget.id);

    if (error) {
      toast.error("Failed to update incident");
    } else {
      toast.success("Incident marked as reviewed");
      setReviewTarget(null);
      setReviewNote("");
      fetchData();
    }
    setReviewSaving(false);
  };

  const exportCSV = () => {
    const rows = incidents.map(i => ({
      Date: new Date(i.incident_date).toLocaleString(),
      Type: i.incident_type,
      Truck: i.truck_name ?? "",
      "Submitted By": i.submitted_by_name ?? "",
      Description: i.description ?? "",
      "Patient Affected": i.patient_affected ?? "",
      "Emergency Services": i.emergency_services_contacted ? "Yes" : "No",
      "Additional Personnel": i.additional_personnel ?? "",
      Status: i.status,
      "Review Note": i.review_note ?? "",
      "Reviewed At": i.reviewed_at ? new Date(i.reviewed_at).toLocaleString() : "",
    }));
    downloadCSV(rows, `incident-reports-${dateFrom}-to-${dateTo}.csv`);
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
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trucks</SelectItem>
              {trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCSV} disabled={incidents.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
        {!loading && (
          <span className="text-[10px] text-muted-foreground ml-auto">{incidents.length} incident{incidents.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={FileWarning}
          title="No incident reports"
          description="Incident reports submitted by crew will appear here."
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left">Date/Time</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Truck</th>
                <th className="px-4 py-3 text-left">Reported By</th>
                <th className="px-4 py-3 text-center">EMS</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => {
                const isExpanded = expandedId === inc.id;
                return (
                  <Fragment key={inc.id}>
                    <tr
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                    >
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {new Date(inc.incident_date).toLocaleDateString()}{" "}
                        <span className="text-muted-foreground">{new Date(inc.incident_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{inc.incident_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inc.truck_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inc.submitted_by_name ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {inc.emergency_services_contacted ? (
                          <Badge variant="destructive" className="text-[10px]">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inc.status === "reviewed" ? (
                          <Badge className="text-[10px] bg-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green))]/90">Reviewed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Open</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-muted/10 p-0">
                          <div className="p-4 space-y-3">
                            {inc.description && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Description</p>
                                <p className="text-sm text-foreground mt-0.5">{inc.description}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Patient Affected</p>
                                <p className="text-sm text-foreground capitalize">{inc.patient_affected === "not_applicable" ? "N/A" : inc.patient_affected ?? "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Emergency Services</p>
                                <p className={`text-sm font-medium ${inc.emergency_services_contacted ? "text-destructive" : "text-foreground"}`}>
                                  {inc.emergency_services_contacted ? "Yes — Called" : "No"}
                                </p>
                              </div>
                              {inc.additional_personnel && (
                                <div className="col-span-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Additional Personnel</p>
                                  <p className="text-sm text-foreground">{inc.additional_personnel}</p>
                                </div>
                              )}
                              {inc.crew_names && (
                                <div className="col-span-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Crew</p>
                                  <p className="text-sm text-foreground">{inc.crew_names}</p>
                                </div>
                              )}
                            </div>

                            {inc.status === "reviewed" && (
                              <div className="rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3">
                                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-green))] font-medium">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Reviewed {inc.reviewed_at ? `on ${new Date(inc.reviewed_at).toLocaleDateString()}` : ""}
                                </div>
                                {inc.review_note && <p className="text-sm text-foreground mt-1">{inc.review_note}</p>}
                              </div>
                            )}

                            {inc.status === "open" && canReview && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); setReviewTarget(inc); setReviewNote(""); }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Mark as Reviewed
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={o => { if (!o) setReviewTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Review Incident</DialogTitle>
            <DialogDescription>
              {reviewTarget?.incident_type} — {reviewTarget?.truck_name ?? "Unknown unit"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground">Review Note (optional)</label>
              <Textarea
                rows={3}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Add findings, corrective actions taken, or follow-up needed..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReviewTarget(null)}>Cancel</Button>
              <Button className="flex-1" onClick={handleReview} disabled={reviewSaving}>
                {reviewSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Mark Reviewed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
