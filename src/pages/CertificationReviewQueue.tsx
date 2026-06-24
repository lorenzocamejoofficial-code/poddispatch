import { useEffect, useMemo, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Check, X, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

type CertType = "medic_number" | "cpr" | "drivers_license";

interface PendingRow {
  id: string;
  user_id: string;
  cert_type: CertType;
  cert_level: string | null;
  cert_number: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  photo_path: string | null;
  created_at: string;
  full_name: string;
  photo_url?: string;
}

const CERT_LABELS: Record<CertType, string> = {
  medic_number: "Medic / EMT #",
  cpr: "CPR Card",
  drivers_license: "Driver's License",
};

export default function CertificationReviewQueue() {
  const { activeCompanyId, user, role } = useAuth();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectingRow, setRejectingRow] = useState<PendingRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin =
    role === "owner" || role === "manager" || role === "dispatcher" || role === "creator";

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crew_certifications" as any)
      .select(
        "id, user_id, cert_type, cert_level, cert_number, issue_date, expiration_date, photo_path, created_at",
      )
      .eq("company_id", activeCompanyId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    if (error) {
      setLoading(false);
      toast.error("Failed to load pending certifications");
      return;
    }
    const list = (data ?? []) as any[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      (profs ?? []).forEach((p: any) => nameMap.set(p.user_id, p.full_name || "—"));
    }
    const withNames: PendingRow[] = list.map((r) => ({
      ...r,
      full_name: nameMap.get(r.user_id) ?? "—",
    }));
    // Sign photo URLs in parallel.
    await Promise.all(
      withNames.map(async (r) => {
        if (!r.photo_path) return;
        const { data: signed } = await supabase.storage
          .from("crew-certifications")
          .createSignedUrl(r.photo_path, 60 * 10);
        if (signed?.signedUrl) r.photo_url = signed.signedUrl;
      }),
    );
    setRows(withNames);
    setSelected(new Set());
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        CERT_LABELS[r.cert_type].toLowerCase().includes(q) ||
        (r.cert_number ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const approveIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .in("id", ids);
    setBusy(false);
    if (error) {
      toast.error("Approve failed");
      return;
    }
    toast.success(ids.length === 1 ? "Approved" : `Approved ${ids.length}`);
    load();
  };

  const rejectOne = async () => {
    if (!rejectingRow) return;
    if (!rejectReason.trim()) {
      toast.error("Reason required");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      })
      .eq("id", rejectingRow.id);
    setBusy(false);
    if (error) {
      toast.error("Reject failed");
      return;
    }
    toast.success("Rejected");
    setRejectingRow(null);
    setRejectReason("");
    load();
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-sm text-muted-foreground">
          You don't have permission to review certifications.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Certification Review Queue
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rows.length} pending {rows.length === 1 ? "submission" : "submissions"} awaiting approval
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search name, cert, number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {selected.size > 0 && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => approveIds(Array.from(selected))}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve {selected.size} selected
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="grid grid-cols-[36px_1.4fr_1fr_1fr_1fr_1fr_auto] gap-3 px-3 py-2 border-b text-[11px] uppercase tracking-wide text-muted-foreground items-center">
            <Checkbox
              checked={filtered.length > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            <div>Employee</div>
            <div>Certification</div>
            <div>Number / Level</div>
            <div>Issued</div>
            <div>Expires</div>
            <div className="text-right pr-1">Actions</div>
          </div>

          {loading && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "🎉 No pending certifications to review."
                : "No matches for that search."}
            </div>
          )}

          {filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[36px_1.4fr_1fr_1fr_1fr_1fr_auto] gap-3 px-3 py-3 border-b last:border-b-0 items-center text-sm"
            >
              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
              <div className="min-w-0">
                <div className="font-medium truncate">{r.full_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Submitted {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{CERT_LABELS[r.cert_type]}</Badge>
                {r.photo_url && (
                  <a
                    href={r.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-0.5 hover:underline"
                  >
                    Photo <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="text-xs">
                {r.cert_number || <span className="text-muted-foreground">—</span>}
                {r.cert_level && (
                  <span className="ml-1 text-muted-foreground">({r.cert_level.replace("_", "-")})</span>
                )}
              </div>
              <div className="text-xs">{r.issue_date || <span className="text-muted-foreground">—</span>}</div>
              <div className="text-xs">
                {r.expiration_date || <span className="text-muted-foreground">—</span>}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => approveIds([r.id])}
                >
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRejectingRow(r);
                    setRejectReason("");
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          Need to add or manually override a cert?{" "}
          <Link to="/employees" className="text-primary hover:underline">
            Go to Employees → click the shield icon
          </Link>
          .
        </div>
      </div>

      <Dialog open={!!rejectingRow} onOpenChange={(v) => !v && setRejectingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject certification</DialogTitle>
            <DialogDescription>
              {rejectingRow && (
                <>
                  {rejectingRow.full_name} — {CERT_LABELS[rejectingRow.cert_type]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">Reason (shown to the crew member)</label>
            <Input
              placeholder="e.g. Photo is unreadable; please re-upload"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingRow(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rejectOne} disabled={busy}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}