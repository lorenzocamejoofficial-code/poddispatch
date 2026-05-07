import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Phone, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface PayerEntry {
  id: string;
  payer_name: string;
  payer_type: string | null;
  phone_number: string | null;
  fax_number: string | null;
  claims_address: string | null;
  portal_url: string | null;
  timely_filing_days: number | null;
  notes: string | null;
}

interface EnrollmentRow {
  id: string;
  payer_id: string;
  era_enrolled: boolean;
  era_enrolled_at: string | null;
  eft_enrolled: boolean;
  eft_enrolled_at: string | null;
  edi_enrolled: boolean;
  edi_enrolled_at: string | null;
  notes: string | null;
}

const PAYER_TYPES = ["medicare", "medicaid", "facility", "commercial", "other"];

const emptyForm = {
  payer_name: "",
  payer_type: "other",
  phone_number: "",
  fax_number: "",
  claims_address: "",
  portal_url: "",
  timely_filing_days: "365",
  notes: "",
};

const emptyEnrollment = {
  era_enrolled: false,
  era_enrolled_at: "",
  eft_enrolled: false,
  eft_enrolled_at: "",
  edi_enrolled: false,
  edi_enrolled_at: "",
  notes: "",
};

function EnrollmentBadges({ e }: { e: EnrollmentRow | undefined }) {
  const cell = (label: string, on: boolean) => (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
        on
          ? "border-[hsl(var(--status-green))]/40 bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))]"
          : "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex gap-1">
      {cell("ERA", !!e?.era_enrolled)}
      {cell("EFT", !!e?.eft_enrolled)}
      {cell("EDI", !!e?.edi_enrolled)}
    </div>
  );
}

export function PayerDirectoryTab() {
  const { activeCompanyId } = useAuth();
  const [payers, setPayers] = useState<PayerEntry[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentRow>>({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [enrollment, setEnrollment] = useState({ ...emptyEnrollment });
  const [saving, setSaving] = useState(false);

  const fetchPayers = useCallback(async () => {
    if (!activeCompanyId) return;
    const [{ data: pd }, { data: en }] = await Promise.all([
      supabase.from("payer_directory").select("*").eq("company_id", activeCompanyId).order("payer_name"),
      supabase.from("customer_payer_enrollments" as any).select("*").eq("company_id", activeCompanyId),
    ]);
    setPayers((pd as any[]) ?? []);
    const map: Record<string, EnrollmentRow> = {};
    for (const r of (en as any[]) ?? []) map[r.payer_id] = r as EnrollmentRow;
    setEnrollments(map);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchPayers(); }, [fetchPayers]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEnrollment({ ...emptyEnrollment });
    setSheetOpen(true);
  };

  const openEdit = (p: PayerEntry) => {
    setEditingId(p.id);
    setForm({
      payer_name: p.payer_name,
      payer_type: p.payer_type ?? "other",
      phone_number: p.phone_number ?? "",
      fax_number: p.fax_number ?? "",
      claims_address: p.claims_address ?? "",
      portal_url: p.portal_url ?? "",
      timely_filing_days: String(p.timely_filing_days ?? 365),
      notes: p.notes ?? "",
    });
    const e = enrollments[p.id];
    setEnrollment({
      era_enrolled: !!e?.era_enrolled,
      era_enrolled_at: e?.era_enrolled_at ?? "",
      eft_enrolled: !!e?.eft_enrolled,
      eft_enrolled_at: e?.eft_enrolled_at ?? "",
      edi_enrolled: !!e?.edi_enrolled,
      edi_enrolled_at: e?.edi_enrolled_at ?? "",
      notes: e?.notes ?? "",
    });
    setSheetOpen(true);
  };

  const toggleEnroll = (key: "era" | "eft" | "edi", on: boolean) => {
    setEnrollment(prev => ({
      ...prev,
      [`${key}_enrolled`]: on,
      [`${key}_enrolled_at`]: on
        ? (prev[`${key}_enrolled_at` as keyof typeof prev] as string) || new Date().toISOString()
        : "",
    }));
  };

  const handleSave = async () => {
    if (!activeCompanyId || !form.payer_name.trim()) return;
    setSaving(true);

    const payload: any = {
      company_id: activeCompanyId,
      payer_name: form.payer_name.trim(),
      payer_type: form.payer_type,
      phone_number: form.phone_number.trim() || null,
      fax_number: form.fax_number.trim() || null,
      claims_address: form.claims_address.trim() || null,
      portal_url: form.portal_url.trim() || null,
      timely_filing_days: parseInt(form.timely_filing_days) || 365,
      notes: form.notes.trim() || null,
    };

    let payerId = editingId;
    if (editingId) {
      const { error } = await supabase
        .from("payer_directory")
        .update(payload)
        .eq("id", editingId);
      if (error) { toast.error("Failed to update"); setSaving(false); return; }
    } else {
      const { data: inserted, error } = await supabase
        .from("payer_directory")
        .insert(payload)
        .select("id")
        .single();
      if (error) { toast.error("Failed to add payer"); setSaving(false); return; }
      payerId = inserted?.id ?? null;
      // Seed an enrollment row (all flags false by default).
      if (payerId) {
        await supabase.from("customer_payer_enrollments" as any).insert({
          company_id: activeCompanyId,
          payer_id: payerId,
        });
      }
    }

    // Upsert enrollment row with current toggle state.
    if (payerId) {
      const enrollPayload: any = {
        company_id: activeCompanyId,
        payer_id: payerId,
        era_enrolled: enrollment.era_enrolled,
        era_enrolled_at: enrollment.era_enrolled ? (enrollment.era_enrolled_at || new Date().toISOString()) : null,
        eft_enrolled: enrollment.eft_enrolled,
        eft_enrolled_at: enrollment.eft_enrolled ? (enrollment.eft_enrolled_at || new Date().toISOString()) : null,
        edi_enrolled: enrollment.edi_enrolled,
        edi_enrolled_at: enrollment.edi_enrolled ? (enrollment.edi_enrolled_at || new Date().toISOString()) : null,
        notes: enrollment.notes.trim() || null,
      };
      await supabase
        .from("customer_payer_enrollments" as any)
        .upsert(enrollPayload, { onConflict: "company_id,payer_id" });
    }

    toast.success(editingId ? "Payer updated" : "Payer added");
    setSaving(false);
    setSheetOpen(false);
    fetchPayers();
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading payer directory…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payer Directory</h2>
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Payer</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Payer Name</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Enrollment</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Portal</th>
              <th className="text-right p-3 font-medium">Timely Filing</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payers.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No payers in directory. Add one to get started.</td></tr>
            )}
            {payers.map(p => (
              <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium">{p.payer_name}</td>
                <td className="p-3">
                  <Badge variant="outline" className="text-xs capitalize">{p.payer_type ?? "—"}</Badge>
                </td>
                <td className="p-3"><EnrollmentBadges e={enrollments[p.id]} /></td>
                <td className="p-3">
                  {p.phone_number ? (
                    <a href={`tel:${p.phone_number}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />{p.phone_number}
                    </a>
                  ) : "—"}
                </td>
                <td className="p-3">
                  {p.portal_url ? (
                    <a href={p.portal_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />Portal
                    </a>
                  ) : "—"}
                </td>
                <td className="p-3 text-right">{p.timely_filing_days ?? 365} days</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Payer" : "Add Payer"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Payer Name *</Label>
              <Input value={form.payer_name} onChange={e => setForm(f => ({ ...f, payer_name: e.target.value }))} />
            </div>
            <div>
              <Label>Payer Type</Label>
              <Select value={form.payer_type} onValueChange={v => setForm(f => ({ ...f, payer_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYER_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="1-800-..." />
            </div>
            <div>
              <Label>Fax Number</Label>
              <Input value={form.fax_number} onChange={e => setForm(f => ({ ...f, fax_number: e.target.value }))} />
            </div>
            <div>
              <Label>Claims Address</Label>
              <Textarea value={form.claims_address} onChange={e => setForm(f => ({ ...f, claims_address: e.target.value }))} className="min-h-[60px]" />
            </div>
            <div>
              <Label>Portal URL</Label>
              <Input value={form.portal_url} onChange={e => setForm(f => ({ ...f, portal_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>Timely Filing (days)</Label>
              <Input type="number" value={form.timely_filing_days} onChange={e => setForm(f => ({ ...f, timely_filing_days: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="min-h-[60px]" />
            </div>

            {/* Enrollment Status section */}
            <div className="rounded-md border p-3 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Enrollment Status</p>
              <p className="text-xs text-muted-foreground">
                Office Ally requires each customer to file enrollment forms per payer for ERA, EFT, and EDI separately. Mark each as confirmed once your enrollment is approved by the payer.
              </p>

              {(["era", "eft", "edi"] as const).map(k => {
                const enabled = enrollment[`${k}_enrolled` as const] as boolean;
                const at = enrollment[`${k}_enrolled_at` as const] as string;
                const dateValue = at ? at.slice(0, 10) : "";
                return (
                  <div key={k} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <div>
                      <Label className="uppercase">{k} enrolled</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        disabled={!enabled}
                        value={dateValue}
                        onChange={e => setEnrollment(prev => ({
                          ...prev,
                          [`${k}_enrolled_at`]: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : "",
                        }))}
                      />
                    </div>
                    <Switch checked={enabled} onCheckedChange={v => toggleEnroll(k, v)} />
                  </div>
                );
              })}

              <div>
                <Label>Enrollment Notes</Label>
                <Textarea
                  value={enrollment.notes}
                  onChange={e => setEnrollment(prev => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[60px]"
                  placeholder="e.g. ERA submitted 2026-04-01, awaiting confirmation"
                />
              </div>
            </div>

            <Button className="w-full" disabled={!form.payer_name.trim() || saving} onClick={handleSave}>
              {saving ? "Saving…" : editingId ? "Update Payer" : "Add Payer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* Reusable lookup component for AR detail panel */
export function PayerContactLookup({ payerType, payerName }: { payerType: string | null; payerName: string | null }) {
  const { activeCompanyId } = useAuth();
  const [entry, setEntry] = useState<PayerEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      // Try payer_type match first
      if (payerType) {
        const { data } = await supabase
          .from("payer_directory")
          .select("*")
          .eq("company_id", activeCompanyId)
          .eq("payer_type", payerType.toLowerCase())
          .limit(1)
          .maybeSingle();
        if (data) { setEntry(data as any); setLoaded(true); return; }
      }
      // Fallback: payer_name match
      if (payerName) {
        const { data } = await supabase
          .from("payer_directory")
          .select("*")
          .eq("company_id", activeCompanyId)
          .ilike("payer_name", payerName)
          .limit(1)
          .maybeSingle();
        if (data) { setEntry(data as any); setLoaded(true); return; }
      }
      setLoaded(true);
    })();
  }, [activeCompanyId, payerType, payerName]);

  if (!loaded) return null;

  if (!entry) {
    return (
      <div className="text-xs text-muted-foreground">
        No contact on file · <a href="/billing?tab=payer-directory" className="text-primary hover:underline">Add to Payer Directory</a>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
      <p className="font-medium">{entry.payer_name}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {entry.phone_number && (
          <a href={`tel:${entry.phone_number}`} className="text-primary hover:underline inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />{entry.phone_number}
          </a>
        )}
        {entry.portal_url && (
          <a href={entry.portal_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />Portal
          </a>
        )}
        {entry.timely_filing_days && (
          <span className="text-muted-foreground">Filing limit: {entry.timely_filing_days} days</span>
        )}
      </div>
    </div>
  );
}
