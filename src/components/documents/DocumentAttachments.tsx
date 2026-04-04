import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  recordType: "patient" | "trip" | "pcr";
  recordId: string;
  companyId: string | null;
  allowUpload?: boolean;
  allowDelete?: boolean;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string;
  uploaded_by_name: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: "pcs", label: "PCS Form" },
  { value: "standing_order", label: "Standing Order" },
  { value: "dnr", label: "DNR / Advance Directive" },
  { value: "prior_auth", label: "Prior Authorization" },
  { value: "insurance_card", label: "Insurance Card" },
  { value: "signed_form", label: "Signed Form" },
  { value: "other", label: "Other" },
];

export function DocumentAttachments({ recordType, recordId, companyId, allowUpload = true, allowDelete = false }: Props) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("pcs");

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("document_attachments" as any)
      .select("*")
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });
    setAttachments((data as any[]) ?? []);
  }, [recordType, recordId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !companyId) return;
    setUploading(true);
    try {
      const path = `${companyId}/${recordType}/${recordId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

      await supabase.from("document_attachments" as any).insert({
        company_id: companyId,
        record_type: recordType,
        record_id: recordId,
        file_name: file.name,
        file_path: path,
        document_type: docType,
        uploaded_by: user.id,
        uploaded_by_name: (profile as any)?.full_name ?? user.email,
      });
      toast.success("Document uploaded");
      fetch();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDownload = async (att: Attachment) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (att: Attachment) => {
    await supabase.storage.from("documents").remove([att.file_path]);
    await supabase.from("document_attachments" as any).delete().eq("id", att.id);
    toast.success("Document removed");
    fetch();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents & Attachments</p>

      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{att.file_name}</p>
            <p className="text-[10px] text-muted-foreground">
              {DOC_TYPES.find(d => d.value === att.document_type)?.label ?? att.document_type} · 
              {att.uploaded_by_name ?? "Unknown"} · {new Date(att.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(att)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          {allowDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(att)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {attachments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No documents attached</p>
      )}

      {allowUpload && (
        <div className="flex items-center gap-2">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex-1">
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            <Button variant="outline" size="sm" className="w-full text-xs" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Upload Document
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
