import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseEDI835, type ParsedRemittanceItem } from "@/lib/edi-835-parser";

type FileRow = {
  id: string;
  file_name: string;
  file_content: string;
  imported_at: string;
  claims_matched: number;
  claims_updated: number;
  total_paid: number;
  status: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  imported: "default",
  unmatched: "secondary",
  quarantined: "destructive",
  no_claims: "outline",
  processing: "secondary",
};

export function RemittanceHistoryPanel() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<{ file: FileRow; parsed: ParsedRemittanceItem[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("remittance_files" as any)
      .select("id, file_name, file_content, imported_at, claims_matched, claims_updated, total_paid, status")
      .order("imported_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Failed to load: " + error.message);
    } else {
      setFiles((data ?? []) as unknown as FileRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (f: FileRow) => {
    try {
      const parsed = parseEDI835(f.file_content);
      setViewing({ file: f, parsed });
    } catch (e: any) {
      toast.error("Failed to parse file: " + e.message);
    }
  };

  const totals = files.reduce(
    (acc, f) => ({
      received: acc.received + 1,
      matched: acc.matched + (f.claims_matched ?? 0),
      paid: acc.paid + Number(f.total_paid ?? 0),
    }),
    { received: 0, matched: 0, paid: 0 }
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Remittance History
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            All 835 payment files received from the clearinghouse for this company.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">{totals.received}</div>
            <div className="text-xs text-muted-foreground">Files Received</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">{totals.matched}</div>
            <div className="text-xs text-muted-foreground">Claims Matched</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">${totals.paid.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Paid</div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : files.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No remittance files received yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs">{format(new Date(f.imported_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="text-xs font-mono">{f.file_name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[f.status] ?? "secondary"}>{f.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">{f.claims_matched}</TableCell>
                  <TableCell className="text-right text-xs">{f.claims_updated}</TableCell>
                  <TableCell className="text-right text-xs">${Number(f.total_paid ?? 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => open(f)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{viewing?.file.file_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {viewing.parsed.length} claim line{viewing.parsed.length !== 1 ? "s" : ""} in this file
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>DOS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pt Resp</TableHead>
                    <TableHead>Denials</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewing.parsed.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{c.patient_name || c.patient_member_id}</TableCell>
                      <TableCell className="text-xs">{c.date_of_service}</TableCell>
                      <TableCell className="text-xs">{c.claim_status_label}</TableCell>
                      <TableCell className="text-right text-xs">${c.charged_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">${c.paid_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">${c.patient_responsibility.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{c.raw_denial_codes.join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}