import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tripId: string;
  patientId: string | null;
  onCompleted?: () => void;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface PcsFormState {
  pcs_physician_name: string;
  pcs_physician_npi: string;
  pcs_certification_date: string;
  pcs_diagnosis: string;
}

const EMPTY: PcsFormState = {
  pcs_physician_name: "",
  pcs_physician_npi: "",
  pcs_certification_date: "",
  pcs_diagnosis: "",
};

export function BillerPcsPanel({ tripId, patientId, onCompleted }: Props) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [form, setForm] = useState<PcsFormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // PCS-typed documents attached to this trip OR this patient
    const recordIds = [tripId, patientId].filter(Boolean) as string[];
    const [{ data: docRows }, { data: claim }] = await Promise.all([
      supabase
        .from("document_attachments" as any)
        .select("id, file_name, file_path, document_type, uploaded_by_name, created_at")
        .in("record_id", recordIds)
        .eq("document_type", "pcs")
        .order("created_at", { ascending: false }),
      supabase
        .from("claim_records" as any)
        .select("pcs_physician_name, pcs_physician_npi, pcs_certification_date, pcs_diagnosis, pcs_completed_at")
        .eq("trip_id", tripId)
        .maybeSingle(),
    ]);
    setDocs(((docRows as unknown) as UploadedDoc[]) ?? []);
    const c = claim as any;
    if (c) {
      setForm({
        pcs_physician_name: c.pcs_physician_name ?? "",
        pcs_physician_npi: c.pcs_physician_npi ?? "",
        pcs_certification_date: c.pcs_certification_date ?? "",
        pcs_diagnosis: c.pcs_diagnosis ?? "",
      });
      setCompletedAt(c.pcs_completed_at ?? null);
    }
    setLoading(false);
  }, [tripId, patientId]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (doc: UploadedDoc) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleSave = async () => {
    if (!form.pcs_physician_name.trim() || !form.pcs_physician_npi.trim() || !form.pcs_certification_date || !form.pcs_diagnosis.trim()) {
      toast.error("All four fields are required to mark PCS complete");
      return;
    }
    if (!/^\d{10}$/.test(form.pcs_physician_npi.trim())) {
      toast.error("NPI must be exactly 10 digits");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("claim_records" as any)
      .update({
        pcs_physician_name: form.pcs_physician_name.trim(),
        pcs_physician_npi: form.pcs_physician_npi.trim(),
        pcs_certification_date: form.pcs_certification_date,
        pcs_diagnosis: form.pcs_diagnosis.trim(),
        pcs_completed_at: new Date().toISOString(),
        pcs_completed_by: user?.id ?? null,
      } as any)
      .eq("trip_id", tripId);
    setSaving(false);
    if (error) {
      toast.error("Could not save PCS details");
      return;
    }
    toast.success("PCS marked complete");
    setCompletedAt(new Date().toISOString());
    onCompleted?.();
  };

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading PCS data…
      </div>
    );
  }

  const isComplete = !!completedAt
    && form.pcs_physician_name.trim() && form.pcs_physician_npi.trim()
    && form.pcs_certification_date && form.pcs_diagnosis.trim();

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          PCS — Physician Certification Statement
        </p>
        {isComplete && (
          <span className="text-[10px] font-medium text-[hsl(var(--status-green))]">✓ Complete</span>
        )}
      </div>

      {/* Uploaded PCS documents from crew */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Uploaded by Crew</p>
        {docs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No PCS documents uploaded</p>
        ) : (
          docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded border bg-card p-2">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{d.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {d.uploaded_by_name ?? "Crew"} · {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(d)}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Biller data entry form */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PCS Data Entry (837P)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Physician Name</Label>
            <Input
              className="h-8 text-xs"
              value={form.pcs_physician_name}
              onChange={e => setForm(f => ({ ...f, pcs_physician_name: e.target.value }))}
              placeholder="Dr. Jane Smith"
            />
          </div>
          <div>
            <Label className="text-[10px]">Physician NPI</Label>
            <Input
              className="h-8 text-xs"
              value={form.pcs_physician_npi}
              onChange={e => setForm(f => ({ ...f, pcs_physician_npi: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              placeholder="10 digits"
              inputMode="numeric"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Certification Date</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={form.pcs_certification_date}
            onChange={e => setForm(f => ({ ...f, pcs_certification_date: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[10px]">Diagnosis / Reason for Transport</Label>
          <Textarea
            className="text-xs min-h-[60px]"
            value={form.pcs_diagnosis}
            onChange={e => setForm(f => ({ ...f, pcs_diagnosis: e.target.value }))}
            placeholder="ESRD, bed-confined, requires stretcher transport for dialysis…"
          />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ClipboardCheck className="h-3 w-3 mr-1" />}
          {isComplete ? "Update PCS Details" : "Mark PCS Complete"}
        </Button>
      </div>
    </div>
  );
}
