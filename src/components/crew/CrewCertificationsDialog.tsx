import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Check, X, ShieldCheck, AlertTriangle } from "lucide-react";

type CertType = "medic_number" | "cpr" | "drivers_license";
type CertStatus = "pending_review" | "approved" | "rejected" | "expired";
import { CERT_LEVELS, type CertLevel } from "@/lib/cert-levels";

interface CertRow {
  id: string;
  user_id: string;
  company_id: string;
  cert_type: CertType;
  cert_level: CertLevel | null;
  cert_number: string | null;
  photo_path: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  status: CertStatus;
  rejection_reason: string | null;
  manually_verified: boolean;
  manual_verification_reason: string | null;
  manual_verification_expires_at: string | null;
  confirmed_by_user_at: string | null;
  uploaded_by: string | null;
}

const CERT_LABELS: Record<CertType, string> = {
  medic_number: "Medic / EMT Number",
  cpr: "CPR Card",
  drivers_license: "Driver's License",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The crew member whose certs we are viewing. */
  userId: string;
  /** Display name (header only). */
  displayName?: string;
  /** If true, render admin actions (approve/reject/override). */
  adminMode?: boolean;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00").getTime();
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function statusBadge(c: CertRow) {
  const d = daysUntil(c.expiration_date);
  if (c.status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (c.status === "pending_review") return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending review</Badge>;
  if (c.expiration_date && d !== null && d < 0) return <Badge variant="destructive">Expired</Badge>;
  if (d !== null && d <= 30) return <Badge variant="outline" className="border-red-500 text-red-600">Expires in {d}d</Badge>;
  if (d !== null && d <= 60) return <Badge variant="outline" className="border-orange-500 text-orange-600">Expires in {d}d</Badge>;
  if (d !== null && d <= 90) return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Expires in {d}d</Badge>;
  if (c.status === "approved") return <Badge variant="outline" className="border-emerald-500 text-emerald-600">Approved</Badge>;
  return <Badge variant="outline">Not submitted</Badge>;
}

export function CrewCertificationsPanel({ userId, adminMode }: { userId: string; adminMode?: boolean }) {
  const { user } = useAuth();
  const isSelf = user?.id === userId;
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crew_certifications" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Failed to load certifications"); return; }
    const seen = new Set<string>();
    const latest = (data as any as CertRow[]).filter((r) => {
      if (seen.has(r.cert_type)) return false;
      seen.add(r.cert_type);
      return true;
    });
    setRows(latest);
    const urls: Record<string, string> = {};
    for (const r of latest) {
      if (r.photo_path) {
        const { data: signed } = await supabase.storage
          .from("crew-certifications")
          .createSignedUrl(r.photo_path, 60 * 10);
        if (signed?.signedUrl) urls[r.id] = signed.signedUrl;
      }
    }
    setPhotoUrls(urls);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const types: CertType[] = ["medic_number", "cpr", "drivers_license"];

  // Rows the employer entered that this crew member has not reviewed yet.
  const unconfirmed = rows.filter((r) => !r.confirmed_by_user_at);

  const confirmAll = async () => {
    setConfirming(true);
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({ confirmed_by_user_at: new Date().toISOString() })
      .in("id", unconfirmed.map((r) => r.id));
    setConfirming(false);
    if (error) { toast.error("Could not confirm — try again"); return; }
    toast.success("Thanks — your certifications are confirmed");
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;
  return (
    <div className="space-y-4">
      {isSelf && unconfirmed.length > 0 && (
        <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold">Review what your employer entered</p>
          <p className="text-xs text-muted-foreground">
            Your employer filled in {unconfirmed.length === 1 ? "one of your certifications" : `${unconfirmed.length} of your certifications`}.
            Check the details below. If something is wrong, tap <strong>Update</strong> on that card to correct it — your change
            goes back to your manager for approval. If everything is right, confirm below to unlock the crew tools.
          </p>
          <Button size="sm" onClick={confirmAll} disabled={confirming}>
            <Check className="h-3.5 w-3.5 mr-1.5" />{confirming ? "Confirming…" : "Everything looks right — confirm"}
          </Button>
        </div>
      )}
      {types.map((t) => {
        const row = rows.find((r) => r.cert_type === t);
        return (
          <CertCard
            key={t}
            type={t}
            row={row}
            photoUrl={row ? photoUrls[row.id] : undefined}
            userId={userId}
            isSelf={isSelf}
            adminMode={!!adminMode}
            onChanged={load}
          />
        );
      })}
    </div>
  );
}

export function CrewCertificationsDialog({ open, onOpenChange, userId, displayName, adminMode }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Certifications {displayName ? `— ${displayName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Crew members must keep these three certifications current to be assignable to a truck.
          </DialogDescription>
        </DialogHeader>
        {open && <CrewCertificationsPanel userId={userId} adminMode={adminMode} />}
      </DialogContent>
    </Dialog>
  );
}

interface CardProps {
  type: CertType;
  row: CertRow | undefined;
  photoUrl: string | undefined;
  userId: string;
  isSelf: boolean;
  adminMode: boolean;
  onChanged: () => void;
}

function CertCard({ type, row, photoUrl, userId, isSelf, adminMode, onChanged }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(row?.cert_number ?? "");
  const [level, setLevel] = useState<CertLevel>(row?.cert_level ?? "EMT-B");
  const [issue, setIssue] = useState(row?.issue_date ?? "");
  const [exp, setExp] = useState(row?.expiration_date ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    setNumber(row?.cert_number ?? "");
    setLevel(row?.cert_level ?? "EMT-B");
    setIssue(row?.issue_date ?? "");
    setExp(row?.expiration_date ?? "");
  }, [row?.id]);

  const submit = async () => {
    if (!exp) { toast.error("Expiration date is required"); return; }
    if (type !== "medic_number" && !file && !row?.photo_path) {
      toast.error("Photo of the card is required");
      return;
    }
    setSaving(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user: actor } } = await supabase.auth.getUser();
      const actorId = actor?.id ?? null;
      const enteringForSelf = actorId ? actorId === userId : isSelf;

      // Resolve the existing row for this (user, cert_type) — one row per pair.
      let existing: CertRow | null = row ?? null;
      if (!existing) {
        const { data: found } = await supabase
          .from("crew_certifications" as any)
          .select("*")
          .eq("user_id", userId)
          .eq("cert_type", type)
          .maybeSingle();
        existing = (found as any as CertRow) ?? null;
      }

      let photoPath = row?.photo_path ?? null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${type}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("crew-certifications")
          .upload(path, file, { upsert: false });
        if (upErr) { toast.error("Photo upload failed"); setSaving(false); return; }
        photoPath = path;
      }

      const nextNumber = number.trim() || null;
      const nextLevel = type === "medic_number" ? level : null;
      const materialChanged = !!existing && (
        (existing.cert_number ?? null) !== nextNumber ||
        (existing.expiration_date ?? null) !== exp ||
        (type === "medic_number" && (existing.cert_level ?? null) !== nextLevel)
      );

      let nextStatus: CertStatus;
      if (adminMode || !enteringForSelf) {
        // Entered from the admin side (the reviewer): lands approved.
        nextStatus = "approved";
      } else if (!existing) {
        nextStatus = "pending_review";
      } else if (existing.status === "approved") {
        nextStatus = materialChanged ? "pending_review" : "approved";
      } else {
        nextStatus = "pending_review";
      }

      const payload: any = {
        user_id: userId,
        company_id: companyId,
        cert_type: type,
        cert_level: nextLevel,
        cert_number: nextNumber,
        photo_path: photoPath,
        issue_date: issue || null,
        expiration_date: exp,
        status: nextStatus,
        rejection_reason: null,
        uploaded_by: actorId,
      };
      if (enteringForSelf) {
        // The crew member typed it themselves — nothing for them to review.
        payload.confirmed_by_user_at = new Date().toISOString();
      } else if (!existing) {
        // Employer entered it at hire — the employee must review it on first login.
        payload.confirmed_by_user_at = null;
      }
      if (nextStatus === "pending_review") {
        payload.reviewed_by = null;
        payload.reviewed_at = null;
      }

      // One row per (user_id, cert_type): update in place, insert only when new.
      const { error } = existing
        ? await supabase.from("crew_certifications" as any).update(payload).eq("id", existing.id)
        : await supabase.from("crew_certifications" as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Re-pend / new submission from the crew side: tell the reviewers.
      // (Admin-side entries land approved and need no notification.)
      if (nextStatus === "pending_review" && companyId) {
        try {
          const { data: reviewers } = await supabase
            .from("company_memberships")
            .select("user_id, role")
            .eq("company_id", companyId)
            .in("role", ["owner", "manager", "dispatcher", "creator"]);
          const targets = (reviewers ?? []).map((r: any) => r.user_id).filter(Boolean);
          if (targets.length > 0) {
            const who = fullName || "A crew member";
            const label = type === "medic_number" ? "Medic / EMT #" : type === "cpr" ? "CPR card" : "Driver's license";
            await supabase.from("notifications").insert(
              targets.map((uid: string) => ({
                user_id: uid,
                notification_type: "general",
                message: `${who} submitted a ${label} for certification review.`,
              })) as any,
            );
          }
        } catch {
          // Notification failure must never block the certification save.
        }
      }

      toast.success(nextStatus === "pending_review" ? "Submitted for review" : "Certification saved");
      setEditing(false);
      setFile(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!row) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", row.id);
    if (error) { toast.error("Approve failed"); return; }
    toast.success("Approved");
    onChanged();
  };

  const reject = async () => {
    if (!row) return;
    if (!rejectReason.trim()) { toast.error("Reason required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), rejection_reason: rejectReason.trim() })
      .eq("id", row.id);
    if (error) { toast.error("Reject failed"); return; }
    toast.success("Rejected");
    setShowReject(false); setRejectReason("");
    onChanged();
  };

  const override = async () => {
    if (!row) return;
    if (!overrideReason.trim()) { toast.error("Reason required"); return; }
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("crew_certifications" as any)
      .update({
        manually_verified: true,
        manual_verification_reason: overrideReason.trim(),
        manual_verification_expires_at: in30.toISOString().slice(0, 10),
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) { toast.error("Override failed"); return; }
    toast.success("Manually verified for 30 days");
    setShowOverride(false); setOverrideReason("");
    onChanged();
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{CERT_LABELS[type]}</h4>
          {row ? statusBadge(row) : <Badge variant="outline">Not submitted</Badge>}
          {row?.manually_verified && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />Manually verified
            </Badge>
          )}
          {row && !row.confirmed_by_user_at && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              {isSelf ? "Needs your review" : "Awaiting employee review"}
            </Badge>
          )}
        </div>
        {!editing && (isSelf || adminMode) && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {row ? "Update" : "Add"}
          </Button>
        )}
      </div>

      {!editing && row && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {type === "medic_number" && row.cert_level && (
            <div><span className="text-muted-foreground">Level:</span> {row.cert_level.replace("_", "-")}</div>
          )}
          {row.cert_number && <div><span className="text-muted-foreground">Number:</span> {row.cert_number}</div>}
          {row.issue_date && <div><span className="text-muted-foreground">Issued:</span> {row.issue_date}</div>}
          {row.expiration_date && <div><span className="text-muted-foreground">Expires:</span> {row.expiration_date}</div>}
          {row.rejection_reason && (
            <div className="col-span-2 text-destructive">Rejected: {row.rejection_reason}</div>
          )}
          {photoUrl && (
            <div className="col-span-2 pt-2">
              <a href={photoUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img src={photoUrl} alt="cert" className="max-h-32 rounded border" />
              </a>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-2 border-t pt-3">
          {type === "medic_number" && (
            <div>
              <Label className="text-xs">Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as CertLevel)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CERT_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">{type === "medic_number" ? "Medic Number" : "Number on card"}</Label>
            <Input className="h-8" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Issue date</Label>
              <Input className="h-8" type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Expiration date *</Label>
              <Input className="h-8" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Photo of card</Label>
            <Input className="h-8" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {row?.photo_path && !file && <p className="text-[11px] text-muted-foreground mt-1">Current photo on file — uploading a new one replaces it.</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setFile(null); }}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {adminMode
                ? (saving ? "Saving…" : "Save & approve")
                : (saving ? "Submitting…" : "Submit for review")}
            </Button>
          </div>
        </div>
      )}

      {adminMode && row && row.status === "pending_review" && !editing && (
        <div className="border-t pt-3 space-y-2">
          {!showReject ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={approve}><Check className="h-3.5 w-3.5 mr-1.5" />Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => setShowReject(true)}><X className="h-3.5 w-3.5 mr-1.5" />Reject</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={reject}>Confirm reject</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {adminMode && row && !editing && (
        <div className="border-t pt-3">
          {!showOverride ? (
            <Button size="sm" variant="outline" onClick={() => setShowOverride(true)}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Manually verify (30-day override)
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea placeholder="Reason for manual verification (audited)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowOverride(false)}>Cancel</Button>
                <Button size="sm" onClick={override}>Confirm override</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}