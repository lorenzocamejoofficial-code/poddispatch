import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  generateEDI837P,
  validateClaimForEDI,
  generateEDIFilename,
  extractFacilityName,
  parseAddressString,
  type ClaimForEDI,
  type ProviderInfo,
  type SubmitterInfo,
} from "@/lib/edi-837p-generator";

interface ExportableClaim {
  id: string;
  trip_id: string;
  patient_id: string;
  run_date: string;
  payer_type: string;
  payer_name: string | null;
  member_id: string | null;
  base_charge: number;
  mileage_charge: number;
  total_charge: number;
  status: string;
  hcpcs_codes: string[] | null;
  hcpcs_modifiers: string[] | null;
  origin_type: string | null;
  destination_type: string | null;
  origin_zip: string | null;
  destination_zip: string | null;
  icd10_codes: string[] | null;
  auth_number: string | null;
  exported_at: string | null;
  // joined patient fields
  patient_first_name?: string;
  patient_last_name?: string;
  patient_dob?: string;
  patient_pickup_address?: string;
  patient_member_id?: string;
  patient_primary_payer?: string;
  // joined trip fields
  trip_loaded_miles?: number;
}

export default function EDIExport() {
  const [claims, setClaims] = useState<ExportableClaim[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showExported, setShowExported] = useState(false);

  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({
    npi: "",
    tax_id: "",
    organization_name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });

  const [submitterInfo, setSubmitterInfo] = useState<SubmitterInfo>({
    submitter_id: "",
    submitter_name: "",
    contact_name: "",
    contact_phone: "",
  });

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch claims that are ready_to_bill or submitted
      const { data: claimsData, error: claimsError } = await supabase
        .from("claim_records" as any)
        .select("*")
        .in("status", ["ready_to_bill", "submitted"])
        .order("run_date", { ascending: false });

      if (claimsError) throw claimsError;
      const rawClaims = (claimsData || []) as any[];

      // Fetch associated patients
      const patientIds = [...new Set(rawClaims.map((c) => c.patient_id).filter(Boolean))];
      let patientsMap: Record<string, any> = {};
      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from("patients")
          .select("id, first_name, last_name, dob, pickup_address, member_id, primary_payer, sex, prior_auth_number, auth_required, weight_lbs")
          .in("id", patientIds);
        (patients || []).forEach((p) => {
          patientsMap[p.id] = p;
        });
      }

      // Fetch associated trips for loaded_miles + oneoff leg data
      const tripIds = [...new Set(rawClaims.map((c) => c.trip_id).filter(Boolean))];
      let tripsMap: Record<string, any> = {};
      if (tripIds.length > 0) {
        const { data: trips } = await supabase
          .from("trip_records")
          .select("id, loaded_miles, bed_confined, requires_monitoring, stretcher_placement, oxygen_during_transport, weight_lbs, pickup_location, destination_location, leg_id, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_dob, oneoff_primary_payer, oneoff_member_id, oneoff_sex, oneoff_pickup_address)")
          .in("id", tripIds);
        (trips || []).forEach((t: any) => {
          tripsMap[t.id] = t;
        });
      }

      const enriched = rawClaims.map((c: any) => {
        const pat = patientsMap[c.patient_id] || {};
        const trip = tripsMap[c.trip_id] || {};
        const leg = trip.leg as any;
        const isOneoff = !c.patient_id && leg?.is_oneoff;
        // One-off patients have no patient record — pickup address lives on the trip
        // itself (pickup_location), with leg.oneoff_pickup_address as fallback.
        const oneoffAddress = isOneoff
          ? (trip.pickup_location ?? leg?.oneoff_pickup_address ?? null)
          : null;
        // For oneoff, split oneoff_name into first/last
        let oneoffFirst = "";
        let oneoffLast = "";
        if (isOneoff && leg?.oneoff_name) {
          const parts = leg.oneoff_name.trim().split(/\s+/);
          oneoffFirst = parts[0] ?? "";
          oneoffLast = parts.slice(1).join(" ") || "";
        }
        return {
          ...c,
          patient_first_name: pat.first_name ?? (isOneoff ? oneoffFirst : undefined),
          patient_last_name: pat.last_name ?? (isOneoff ? oneoffLast : undefined),
          patient_dob: pat.dob ?? (isOneoff ? leg?.oneoff_dob : undefined),
          patient_pickup_address: pat.pickup_address ?? oneoffAddress ?? undefined,
          patient_member_id: pat.member_id || c.member_id || (isOneoff ? leg?.oneoff_member_id : null),
          patient_primary_payer: pat.primary_payer ?? (isOneoff ? leg?.oneoff_primary_payer : null),
          trip_loaded_miles: trip.loaded_miles,
        };
      });

      setClaims(enriched);
    } catch (err: any) {
      toast.error("Failed to load claims: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load company settings for provider info
  const fetchProviderDefaults = useCallback(async () => {
    await supabase
      .from("company_settings")
      .select("company_name")
      .limit(1)
      .maybeSingle();

    const { data: company } = await supabase
      .from("companies")
      .select("name, npi_number, state_of_operation")
      .limit(1)
      .maybeSingle();

    if (company) {
      setProviderInfo((prev) => ({
        ...prev,
        organization_name: prev.organization_name || company.name || "",
        npi: prev.npi || company.npi_number || "",
        state: prev.state || company.state_of_operation || "",
      }));
      setSubmitterInfo((prev) => ({
        ...prev,
        submitter_name: prev.submitter_name || company.name || "",
      }));
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchProviderDefaults();
  }, [fetchClaims, fetchProviderDefaults]);

  const filteredClaims = showExported
    ? claims
    : claims.filter((c) => !c.exported_at);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredClaims.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClaims.map((c) => c.id)));
    }
  };

  const selectedClaims = filteredClaims.filter((c) => selectedIds.has(c.id));

  const handleGenerate = async () => {
    if (selectedClaims.length === 0) {
      toast.error("Select at least one claim to export");
      return;
    }
    if (!providerInfo.npi || !providerInfo.tax_id) {
      toast.error("Provider NPI and Tax ID are required");
      return;
    }

    setGenerating(true);
    try {
      // Fetch trip and patient data for EDI generation
      const selTripIds = [...new Set(selectedClaims.map(c => (c as any).trip_id).filter(Boolean))];
      const selPatIds = [...new Set(selectedClaims.map(c => (c as any).patient_id).filter(Boolean))];
      const localTripsMap: Record<string, any> = {};
      const localPatsMap: Record<string, any> = {};
      if (selTripIds.length > 0) {
        const { data: trs } = await supabase.from("trip_records").select("id, loaded_miles, bed_confined, requires_monitoring, stretcher_placement, oxygen_during_transport, weight_lbs, pickup_location, destination_location").in("id", selTripIds);
        (trs || []).forEach(t => { localTripsMap[t.id] = t; });
      }
      if (selPatIds.length > 0) {
        const { data: ps } = await supabase.from("patients").select("id, sex, weight_lbs").in("id", selPatIds);
        (ps || []).forEach(p => { localPatsMap[p.id] = p; });
      }

      // Build ClaimForEDI array
      const ediClaims: ClaimForEDI[] = selectedClaims.map((c) => {
        const trip = localTripsMap[(c as any).trip_id] || {};
        const pat = localPatsMap[(c as any).patient_id] || {};
        // Parse the patient pickup address into street/city/state/zip — never
        // substitute placeholders. validateClaimForEDI will block export if any
        // of street/city/zip is missing.
        const rawPatientAddr = String(c.patient_pickup_address ?? "").trim();
        const parsedPat = parseAddressString(rawPatientAddr);
        return {
          claim_id: c.id,
          patient_name: `${c.patient_last_name || "UNKNOWN"}, ${c.patient_first_name || "UNKNOWN"}`,
          patient_dob: c.patient_dob || "1900-01-01",
          patient_sex: pat.sex || (c as any).patient_sex || null,
          patient_address: parsedPat.street || rawPatientAddr,
          patient_city: parsedPat.city || "",
          patient_state: parsedPat.state || providerInfo.state || "",
          patient_zip: parsedPat.zip || c.origin_zip || "",
          member_id: c.patient_member_id || c.member_id || "UNKNOWN",
          payer_name: c.payer_name || c.payer_type || "MEDICARE",
          payer_id: c.payer_type === "medicare" ? "MEDICARE" : c.payer_type === "medicaid" ? "MEDICAID" : c.payer_name || "UNKNOWN",
          payer_type: c.payer_type || "medicare",
          run_date: c.run_date,
          hcpcs_codes: c.hcpcs_codes || ["A0428"],
          hcpcs_modifiers: c.hcpcs_modifiers || [],
          total_charge: c.total_charge || 0,
          base_charge: c.base_charge || 0,
          mileage_charge: c.mileage_charge || 0,
          loaded_miles: c.trip_loaded_miles || 0,
          origin_type: c.origin_type,
          destination_type: c.destination_type,
          origin_address: trip.pickup_location || c.patient_pickup_address || null,
          origin_city: "",
          origin_state: providerInfo.state || null,
          origin_zip: c.origin_zip,
          destination_address: trip.destination_location || null,
          destination_city: "",
          destination_state: providerInfo.state || null,
          destination_zip: c.destination_zip,
          diagnosis_codes: [],
          auth_number: c.auth_number,
          icd10_codes: c.icd10_codes || [],
          bed_confined: !!trip.bed_confined,
          requires_monitoring: !!trip.requires_monitoring,
          stretcher_placement: trip.stretcher_placement || null,
          oxygen_required: !!trip.oxygen_during_transport,
          weight_lbs: trip.weight_lbs || pat.weight_lbs || null,
          pickup_facility_name: extractFacilityName(trip.pickup_location) || null,
          dropoff_facility_name: extractFacilityName(trip.destination_location) || null,
          pcs_physician_name: (c as any).pcs_physician_name ?? null,
          pcs_physician_npi: (c as any).pcs_physician_npi ?? null,
          pcs_certification_date: (c as any).pcs_certification_date ?? null,
          pcs_diagnosis: (c as any).pcs_diagnosis ?? null,
        };
      });

      // Validate (pass billing state for state-specific timely filing rules)
      const allErrors: string[] = [];
      ediClaims.forEach((ec, i) => {
        const errs = validateClaimForEDI(ec, providerInfo.state);
        if (errs.length > 0) {
          allErrors.push(`Claim ${i + 1} (${ec.patient_name}): ${errs.join(", ")}`);
        }
      });
      if (allErrors.length > 0) {
        toast.error(`Validation errors:\n${allErrors.join("\n")}`, { duration: 8000 });
        setGenerating(false);
        return;
      }

      // Generate 837P
      const ediContent = generateEDI837P(ediClaims, providerInfo, submitterInfo);
      const filename = generateEDIFilename();

      // Download
      const blob = new Blob([ediContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      // Mark claims as exported
      const ids = selectedClaims.map((c) => c.id);
      const now = new Date().toISOString();
      await supabase
        .from("claim_records" as any)
        .update({ exported_at: now } as any)
        .in("id", ids);

      // Audit log
      await logAuditEvent({
        action: "edi_837p_export",
        tableName: "claim_records",
        notes: `Exported ${ids.length} claims to ${filename}`,
        newData: { claim_ids: ids, filename },
      });

      toast.success(`${filename} downloaded with ${ids.length} claims`);

      // Refresh
      await fetchClaims();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const totalCharge = selectedClaims.reduce((sum, c) => sum + (c.total_charge || 0), 0);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">EDI 837P Export</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate standard 837P files for clearinghouse submission
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            ANSI X12 005010X222A1
          </Badge>
        </div>

        {/* Provider & Submitter Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Billing Provider</CardTitle>
              <CardDescription className="text-xs">NPI and Tax ID are required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">NPI *</Label>
                  <Input
                    value={providerInfo.npi}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, npi: e.target.value }))}
                    placeholder="1234567890"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tax ID (EIN) *</Label>
                  <Input
                    value={providerInfo.tax_id}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, tax_id: e.target.value }))}
                    placeholder="12-3456789"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Organization Name</Label>
                <Input
                  value={providerInfo.organization_name}
                  onChange={(e) => setProviderInfo((p) => ({ ...p, organization_name: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Street Address *</Label>
                <Input
                  value={providerInfo.address}
                  onChange={(e) => setProviderInfo((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input
                    value={providerInfo.city}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, city: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Input
                    value={providerInfo.state}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, state: e.target.value }))}
                    className="h-8 text-sm"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">ZIP</Label>
                  <Input
                    value={providerInfo.zip}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, zip: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Submitter</CardTitle>
              <CardDescription className="text-xs">Clearinghouse contact info</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Submitter ID</Label>
                  <Input
                    value={submitterInfo.submitter_id}
                    onChange={(e) => setSubmitterInfo((s) => ({ ...s, submitter_id: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Submitter Name</Label>
                  <Input
                    value={submitterInfo.submitter_name}
                    onChange={(e) => setSubmitterInfo((s) => ({ ...s, submitter_name: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input
                    value={submitterInfo.contact_name}
                    onChange={(e) => setSubmitterInfo((s) => ({ ...s, contact_name: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input
                    value={submitterInfo.contact_phone}
                    onChange={(e) => setSubmitterInfo((s) => ({ ...s, contact_phone: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims Selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">
                  Claims to Export ({filteredClaims.length} available)
                </CardTitle>
                <CardDescription className="text-xs">
                  Select claims to include in the 837P file
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={showExported}
                    onCheckedChange={(v) => setShowExported(!!v)}
                  />
                  Show previously exported
                </label>
                <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                  {selectedIds.size === filteredClaims.length && filteredClaims.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No claims ready for export. Claims must be in "Ready to Bill" or "Submitted" status.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Patient</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Payer</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">HCPCS</th>
                      <th className="p-2 text-right font-medium text-muted-foreground">Charge</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClaims.map((claim) => (
                      <tr
                        key={claim.id}
                        className={`border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors ${
                          selectedIds.has(claim.id) ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleSelection(claim.id)}
                      >
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={selectedIds.has(claim.id)}
                            onCheckedChange={() => toggleSelection(claim.id)}
                          />
                        </td>
                        <td className="p-2 font-medium">
                          {claim.patient_last_name}, {claim.patient_first_name}
                          {claim.exported_at && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                              Exported
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">{claim.run_date}</td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {claim.payer_type}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs font-mono">
                          {(claim.hcpcs_codes || []).join(", ") || "—"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          ${(claim.total_charge || 0).toFixed(2)}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={claim.status === "ready_to_bill" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {claim.status === "ready_to_bill" ? "Ready" : "Submitted"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Summary & Action */}
        {selectedClaims.length > 0 && (
          <Card className="border-primary/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Selected Claims</p>
                    <p className="text-lg font-bold">{selectedClaims.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Charges</p>
                    <p className="text-lg font-bold font-mono">${totalCharge.toFixed(2)}</p>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  size="lg"
                  className="gap-2"
                >
                  {generating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Generate 837P
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Alert className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs text-muted-foreground">
            The generated 837P file follows ANSI X12 005010X222A1 format compatible with Office Ally,
            Availity, Trizetto, and other standard clearinghouses. Upload the downloaded .txt file to
            your clearinghouse portal for submission.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  );
}
