import { useCallback, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, XCircle, AlertTriangle, Info, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  parseEDI835,
  isValid835,
  mapClaimStatus,
  extractCO45WriteOff,
  getPrimaryDenialCode,
  parsePatientControlNumber,
  type ParsedRemittanceItem,
} from "@/lib/edi-835-parser";
import { getDenialTranslation } from "@/lib/denial-code-translations";

interface MatchedItem {
  remittance: ParsedRemittanceItem;
  matchedClaimId: string | null;
  matchedPatientId: string | null;
  hasSecondaryPayer: boolean;
  errors: string[];
}

export default function RemittanceImport() {
  const [fileName, setFileName] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    matched: number;
    updated: number;
    totalPaid: number;
    secondaryOpportunities: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);
    setImportSummary(null);

    const text = await file.text();
    if (!isValid835(text)) {
      toast.error("This does not appear to be a valid 835 remittance file.");
      return;
    }

    setRawContent(text);
    setParsing(true);

    try {
      const parsed = parseEDI835(text);
      if (parsed.length === 0) {
        toast.error("No claims found in the 835 file.");
        setMatchedItems([]);
        return;
      }

      // Match against claim_records in DB
      const { data: claims } = await supabase
        .from("claim_records" as any)
        .select("id, member_id, run_date, patient_id, status, hcpcs_codes")
        .in("status", ["submitted", "ready_to_bill", "needs_correction", "needs_review"]);

      const { data: patients } = await supabase
        .from("patients")
        .select("id, member_id, secondary_payer, first_name, last_name");

      const claimsList = (claims || []) as any[];
      const patientsList = (patients || []) as any[];
      const patientMap = new Map(patientsList.map((p) => [p.id, p]));
      const memberToPatient = new Map<string, any>();
      patientsList.forEach((p) => {
        if (p.member_id) memberToPatient.set(p.member_id.trim().toUpperCase(), p);
      });

      const matched: MatchedItem[] = parsed.map((rem) => {
        const errors: string[] = [];
        let matchedClaimId: string | null = null;
        let matchedPatientId: string | null = null;
        let hasSecondaryPayer = false;

        // Primary match: CLP01 patient control number (YYMMDD-XXXXXXXX)
        const pcn = parsePatientControlNumber(rem.patient_control_number);
        if (pcn) {
          // The id prefix is the first 8 hex chars of the claim UUID (no dashes)
          const candidate = claimsList.find((c: any) => {
            const cId = (c.id || "").replace(/-/g, "").slice(0, 8).toLowerCase();
            return cId === pcn.idPrefix;
          });
          if (candidate) {
            matchedClaimId = candidate.id;
            matchedPatientId = candidate.patient_id;
          }
        }

        // Fallback: member_id + date_of_service
        if (!matchedClaimId) {
          const remMemberId = rem.patient_member_id?.trim().toUpperCase();
          const remDate = rem.date_of_service;

          if (remMemberId && remDate) {
            const candidateClaims = claimsList.filter((c: any) => {
              const cMember = (c.member_id || "").trim().toUpperCase();
              return cMember === remMemberId && c.run_date === remDate;
            });

            if (candidateClaims.length === 1) {
              matchedClaimId = candidateClaims[0].id;
              matchedPatientId = candidateClaims[0].patient_id;
            } else if (candidateClaims.length > 1) {
              // Multiple matches — try to narrow by charge amount
              const exact = candidateClaims.find(
                (c: any) => Math.abs((c.total_charge || 0) - rem.charged_amount) < 0.01
              );
              if (exact) {
                matchedClaimId = exact.id;
                matchedPatientId = exact.patient_id;
              } else {
                matchedClaimId = candidateClaims[0].id;
                matchedPatientId = candidateClaims[0].patient_id;
                errors.push("Multiple claims matched — used first");
              }
            }
          }
        }

        if (!matchedClaimId) {
          errors.push("No matching claim found");
        }

        // Check secondary payer
        if (matchedPatientId) {
          const pat = patientMap.get(matchedPatientId);
          if (pat?.secondary_payer) {
            hasSecondaryPayer = true;
          }
        } else {
          const fallbackMemberId = rem.patient_member_id?.trim().toUpperCase();
          if (fallbackMemberId) {
            const pat = memberToPatient.get(fallbackMemberId);
            if (pat?.secondary_payer) {
              hasSecondaryPayer = true;
            }
          }
        }

        return { remittance: rem, matchedClaimId, matchedPatientId, hasSecondaryPayer, errors };
      });

      setMatchedItems(matched);
      toast.success(`Parsed ${parsed.length} claims from 835 file`);
    } catch (err: any) {
      toast.error("Failed to parse 835: " + err.message);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleImport = async () => {
    const toUpdate = matchedItems.filter((m) => m.matchedClaimId);
    if (toUpdate.length === 0) {
      toast.error("No matched claims to import");
      return;
    }

    setImporting(true);
    let updated = 0;
    let totalPaid = 0;
    let secondaryOpps = 0;

    try {
      for (const item of toUpdate) {
        const rem = item.remittance;
        const newStatus = mapClaimStatus(rem.claim_status_code);
        const co45 = extractCO45WriteOff(rem.adjustment_groups);
        const primaryDenial = getPrimaryDenialCode(rem.adjustment_groups);
        const adjustmentCodes = rem.raw_denial_codes;
        const prAmount = rem.adjustment_groups
          .filter((a) => a.group_code === "PR")
          .reduce((sum, a) => sum + a.amount, 0);

        // Use actual payment date from 835 (BPR16 or DTM), fall back to today
        const paymentDateISO = rem.payment_date
          ? `${rem.payment_date}T00:00:00Z`
          : new Date().toISOString();
        const remittanceDateStr = rem.payment_date || new Date().toISOString().slice(0, 10);

        const updatePayload: Record<string, any> = {
          amount_paid: rem.paid_amount,
          allowed_amount: rem.charged_amount - co45,
          write_off_amount: co45 > 0 ? co45 : null,
          patient_responsibility_amount: prAmount > 0 ? prAmount : null,
          adjustment_codes: adjustmentCodes,
          remittance_date: remittanceDateStr,
          payer_claim_control_number: rem.payer_claim_control_number || null,
          status: newStatus,
        };

        if (newStatus === "paid") {
          updatePayload.paid_at = paymentDateISO;
        }

        if (primaryDenial && (newStatus === "denied" || newStatus === "needs_correction")) {
          updatePayload.denial_code = primaryDenial.code;
          // Store plain English explanation; fall back to raw code if unrecognized
          const translation = getDenialTranslation(primaryDenial.code);
          updatePayload.denial_reason = translation?.plain_english_explanation ?? primaryDenial.code;
        }

        // Flag secondary opportunity
        if (newStatus === "paid" && item.hasSecondaryPayer && prAmount > 0) {
          updatePayload.secondary_claim_generated = false; // flag it as opportunity
          secondaryOpps++;
        }

        const { error } = await supabase
          .from("claim_records" as any)
          .update(updatePayload as any)
          .eq("id", item.matchedClaimId);

        if (!error) {
          updated++;
          totalPaid += rem.paid_amount;
        }
      }

      // Write remittance file record
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from("remittance_files" as any).insert({
        file_name: fileName,
        file_content: rawContent,
        claims_matched: toUpdate.length,
        claims_updated: updated,
        total_paid: totalPaid,
        status: "completed",
        company_id: companyId,
        imported_by: currentUser?.id ?? null,
      } as any);

      await logAuditEvent({
        action: "export",
        tableName: "remittance_files",
        notes: `Imported 835 file "${fileName}" — ${updated} claims updated, $${totalPaid.toFixed(2)} total paid`,
        newData: { fileName, matched: toUpdate.length, updated, totalPaid },
      });

      setImported(true);
      setImportSummary({
        matched: toUpdate.length,
        updated,
        totalPaid,
        secondaryOpportunities: secondaryOpps,
      });

      toast.success(`Import complete — ${updated} claims updated`);
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = matchedItems.filter((m) => m.matchedClaimId).length;
  const unmatchedCount = matchedItems.filter((m) => !m.matchedClaimId).length;
  const secondaryCount = matchedItems.filter((m) => m.hasSecondaryPayer && m.matchedClaimId).length;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">835 Remittance Import</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload payment response files from your clearinghouse
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            ANSI X12 835
          </Badge>
        </div>

        {/* Upload Area */}
        {!matchedItems.length && !parsing && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">
                Upload an 835 Remittance File
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Drop a .txt or .835 file from your clearinghouse
              </p>
              <Button onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                Select File
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.835,.edi"
                className="hidden"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>
        )}

        {parsing && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
              <span className="text-sm text-muted-foreground">Parsing 835 file...</span>
            </CardContent>
          </Card>
        )}

        {/* Match Summary */}
        {matchedItems.length > 0 && !imported && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Claims</p>
                  <p className="text-2xl font-bold">{matchedItems.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-2xl font-bold text-[hsl(var(--status-green))]">{matchedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-2xl font-bold text-destructive">{unmatchedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold font-mono">
                    ${matchedItems.reduce((s, m) => s + m.remittance.paid_amount, 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {secondaryCount > 0 && (
              <Alert className="border-primary/30 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  <strong>{secondaryCount} claim{secondaryCount > 1 ? "s" : ""}</strong> have a secondary
                  payer on file and may be eligible for secondary billing after import.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Preview — {fileName}</CardTitle>
                <CardDescription className="text-xs">
                  Review parsed remittance data before importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                        <th className="p-2 text-left">Match</th>
                        <th className="p-2 text-left">Patient</th>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-right">Charged</th>
                        <th className="p-2 text-right">Paid</th>
                        <th className="p-2 text-right">Patient Resp.</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Denial Codes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedItems.map((item, idx) => {
                        const rem = item.remittance;
                        const status = mapClaimStatus(rem.claim_status_code);
                        return (
                          <tr
                            key={idx}
                            className={`border-b last:border-0 ${
                              !item.matchedClaimId ? "bg-destructive/5" : ""
                            }`}
                          >
                            <td className="p-2">
                              {item.matchedClaimId ? (
                                <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))]" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </td>
                            <td className="p-2">
                              <p className="font-medium text-xs">
                                {rem.patient_name || rem.patient_member_id || "Unknown"}
                              </p>
                              {rem.patient_member_id && (
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  ID: {rem.patient_member_id}
                                </p>
                              )}
                              {item.hasSecondaryPayer && (
                                <Badge variant="outline" className="text-[10px] mt-0.5 border-primary/40 text-primary">
                                  2nd payer
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground text-xs">
                              {rem.date_of_service || "—"}
                            </td>
                            <td className="p-2 text-right font-mono text-xs">
                              ${rem.charged_amount.toFixed(2)}
                            </td>
                            <td className="p-2 text-right font-mono text-xs font-semibold">
                              ${rem.paid_amount.toFixed(2)}
                            </td>
                            <td className="p-2 text-right font-mono text-xs">
                              {rem.patient_responsibility > 0
                                ? `$${rem.patient_responsibility.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  status === "paid"
                                    ? "default"
                                    : status === "denied"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {rem.claim_status_label}
                              </Badge>
                            </td>
                            <td className="p-2 max-w-[200px]">
                              {rem.raw_denial_codes.length > 0 ? (
                                <div className="space-y-0.5">
                                  {rem.raw_denial_codes.slice(0, 3).map((code) => {
                                    const translation = getDenialTranslation(code);
                                    return (
                                      <p key={code} className="text-[10px]">
                                        <span className="font-mono font-medium">{code}</span>
                                        {translation && (
                                          <span className="text-muted-foreground ml-1">
                                            — {translation.plain_english_explanation}
                                          </span>
                                        )}
                                      </p>
                                    );
                                  })}
                                  {rem.raw_denial_codes.length > 3 && (
                                    <p className="text-[10px] text-muted-foreground">
                                      +{rem.raw_denial_codes.length - 3} more
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Fix 12: Match summary before confirm */}
            {unmatchedCount > 0 && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  <strong>{matchedCount} of {matchedItems.length} items matched</strong> — {unmatchedCount} item{unmatchedCount !== 1 ? "s" : ""} could not be matched and will be skipped.
                </AlertDescription>
              </Alert>
            )}

            {/* Import Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setMatchedItems([]);
                  setRawContent("");
                  setFileName("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || matchedCount === 0}
                size="lg"
                className="gap-2"
              >
                {importing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Confirm Import ({matchedCount} claims)
              </Button>
            </div>
          </>
        )}

        {/* Post-Import Summary */}
        {imported && importSummary && (
          <Card className="border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-8 w-8 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Import Complete</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {importSummary.updated} of {importSummary.matched} matched claims were updated.
                      Total payments applied: <strong>${importSummary.totalPaid.toFixed(2)}</strong>
                    </p>
                  </div>

                  {importSummary.secondaryOpportunities > 0 && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-sm">
                        <strong>{importSummary.secondaryOpportunities} claims</strong> have patient
                        responsibility amounts and a secondary payer on file. Navigate to the Claims
                        Board to generate secondary claims.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMatchedItems([]);
                        setRawContent("");
                        setFileName("");
                        setImported(false);
                        setImportSummary(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      Import Another File
                    </Button>
                    <a href="/billing">
                      <Button size="sm" className="gap-1.5">
                        Go to Claims Board <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Alert className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs text-muted-foreground">
            Upload the 835 file exactly as received from your clearinghouse. The parser matches claims
            by member ID and date of service. Unmatched claims will be skipped — no data is modified
            until you click Confirm Import.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  );
}
