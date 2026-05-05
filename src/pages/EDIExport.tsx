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
import { FileText, Download, Info, FlaskConical, Eye, FileCheck2, Upload, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link as RouterLink, Link } from "react-router-dom";
import { logAuditEvent } from "@/lib/audit-logger";
import { RecordRejectionDialog } from "@/components/billing/RecordRejectionDialog";
import {
  generateEDI837P,
  validateClaimForEDI,
  validateProviderInfo,
  validateSubmitterInfo,
  generateEDIFilename,
  extractFacilityName,
  parseAddressString,
  type ClaimForEDI,
  type ProviderInfo,
  type SubmitterInfo,
} from "@/lib/edi-837p-generator";
import { evaluateClaimReadiness, type ReadinessIssue } from "@/lib/claim-readiness";
import { useAuth } from "@/hooks/useAuth";

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
  const { activeCompanyId } = useAuth();
  const [claims, setClaims] = useState<ExportableClaim[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showExported, setShowExported] = useState(false);
  // True when EIN/NPI come from the companies row — lock the inputs and link
  // back to onboarding for edits.
  const [einLocked, setEinLocked] = useState(false);
  const [npiLocked, setNpiLocked] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<{ id: string; label: string } | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    { idx: number; ec: ClaimForEDI; issues: ReadinessIssue[] }[]
  >([]);

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

  // Load company (per-tenant Provider Info) and global vendor (PodDispatch
  // Submitter Info). The Submitter is the SAME for every customer because
  // PodDispatch is the registered Office Ally vendor; only the Billing
  // Provider varies per tenant.
  const fetchProviderDefaults = useCallback(async () => {
    if (!activeCompanyId) return;

    const { data: company } = await supabase
      .from("companies")
      .select("name, npi_number, ein_number, state_of_operation, address_street, address_city, address_state, address_zip")
      .eq("id", activeCompanyId)
      .maybeSingle();

    if (company) {
      setProviderInfo((prev) => ({
        ...prev,
        organization_name: prev.organization_name || company.name || "",
        npi: prev.npi || company.npi_number || "",
        tax_id: prev.tax_id || (company as any).ein_number || "",
        // Loop 2010AA needs the PHYSICAL billing address state, not the
        // company's registered state of operation. Fall back to state_of_operation
        // only when no physical state is on file.
        state: prev.state || (company as any).address_state || company.state_of_operation || "",
        address: prev.address || (company as any).address_street || "",
        city: prev.city || (company as any).address_city || "",
        zip: prev.zip || (company as any).address_zip || "",
      }));
      if ((company as any).ein_number) setEinLocked(true);
      if (company.npi_number) setNpiLocked(true);
    }

    // Pull GLOBAL vendor submitter from vendor_clearinghouse_settings. This is
    // PodDispatch's registered Office Ally identity (singleton row). Same for
    // every customer — never per-tenant.
    const { data: vendor } = await supabase
      .from("vendor_clearinghouse_settings" as any)
      .select("submitter_id, submitter_name, contact_name, contact_phone, receiver_id, receiver_name, test_mode")
      .limit(1)
      .maybeSingle();
    if (vendor) {
      const row = vendor as any;
      setTestMode(row.test_mode === true);
      setSubmitterInfo({
        submitter_id: row.submitter_id || "",
        submitter_name: row.submitter_name || "",
        contact_name: row.contact_name || "",
        contact_phone: row.contact_phone || "",
        receiver_id: row.receiver_id || "330897513",
        receiver_name: row.receiver_name || "OFFICE ALLY",
        usage_indicator: row.test_mode === true ? "T" : "P",
      });
    }
  }, [activeCompanyId]);

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
    const provErrs = validateProviderInfo(providerInfo);
    if (provErrs.length > 0) {
      toast.error("Billing Provider invalid:\n" + provErrs.join("\n"), { duration: 8000 });
      return;
    }
    const subErrs = validateSubmitterInfo(submitterInfo);
    if (subErrs.length > 0) {
      toast.error("Vendor (PodDispatch) submitter not configured:\n" + subErrs.join("\n"), { duration: 8000 });
      return;
    }
    const taxDigits = providerInfo.tax_id.replace(/\D/g, "");

    setGenerating(true);
    try {
      // If EIN was entered manually (not previously saved), persist to companies
      // so future exports pre-fill it.
      if (!einLocked && taxDigits.length === 9) {
        if (activeCompanyId) {
          await supabase
            .from("companies")
            .update({ ein_number: taxDigits } as any)
            .eq("id", activeCompanyId);
          setEinLocked(true);
        }
      }

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

      // Resolve facility addresses: when destination_address is NULL the trip
      // only stores the facility name in destination_location.  Look up the
      // real address from the facilities table so the 837P gets correct N3/N4.
      const facilityNames = [...new Set(
        selectedClaims.map(c => {
          const trip = localTripsMap[(c as any).trip_id] || {};
          if (!(c as any).destination_address && trip.destination_location) return trip.destination_location;
          return null;
        }).filter(Boolean)
      )] as string[];
      const facilityAddrMap: Record<string, string> = {};
      if (facilityNames.length > 0) {
        const { data: facs } = await supabase
          .from("facilities" as any)
          .select("name, address")
          .in("name", facilityNames);
        (facs || []).forEach((f: any) => {
          if (f.address) facilityAddrMap[f.name] = f.address;
        });
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
        // Prefer snapshot fields on the claim itself (populated by
        // auto_create_claim_on_pcr_submit). Fall back to live trip data only if
        // the claim was created before the snapshot columns were backfilled.
        const claimOriginAddr = (c as any).origin_address || trip.pickup_location || c.patient_pickup_address || null;
        // Resolve destination address: prefer claim snapshot, then facility
        // table lookup (by name), then raw trip destination_location as last resort.
        const claimDestAddr = (c as any).destination_address
          || (trip.destination_location && facilityAddrMap[trip.destination_location]
              ? facilityAddrMap[trip.destination_location]
              : null)
          || trip.destination_location
          || null;
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
          origin_address: claimOriginAddr,
          origin_city: (c as any).origin_city || "",
          origin_state: (c as any).origin_state || providerInfo.state || null,
          origin_zip: c.origin_zip,
          destination_address: claimDestAddr,
          destination_city: (c as any).destination_city || "",
          destination_state: (c as any).destination_state || providerInfo.state || null,
          destination_zip: c.destination_zip,
          diagnosis_codes: [],
          auth_number: c.auth_number,
          icd10_codes: c.icd10_codes || [],
          bed_confined: !!trip.bed_confined,
          requires_monitoring: !!trip.requires_monitoring,
          stretcher_placement: trip.stretcher_placement || null,
          oxygen_required: !!trip.oxygen_during_transport,
          weight_lbs: trip.weight_lbs || pat.weight_lbs || null,
          pickup_facility_name: extractFacilityName(claimOriginAddr) || null,
          // When destination was resolved from the facilities table, use the
          // facility name directly instead of trying to extract it from the
          // address string (which won't contain the name).
          dropoff_facility_name:
            (trip.destination_location && facilityAddrMap[trip.destination_location]
              ? trip.destination_location
              : extractFacilityName(claimDestAddr)) || null,
          pcs_physician_name: (c as any).pcs_physician_name ?? null,
          pcs_physician_npi: (c as any).pcs_physician_npi ?? null,
          pcs_certification_date: (c as any).pcs_certification_date ?? null,
          pcs_diagnosis: (c as any).pcs_diagnosis ?? null,
          // Dispatch-to-bill sync: chief_complaint = original call reason,
          // primary_impression = on-scene crew finding. Both flow from
          // scheduling → PCR → claim_records via auto_create_claim_on_pcr_submit
          // and are emitted as NTE*ADD on Loop 2300 in the 837P.
          chief_complaint: (c as any).chief_complaint ?? null,
          primary_impression: (c as any).primary_impression ?? null,
        };
      });

      // Validate (pass billing state for state-specific timely filing rules)
      const blocked: { idx: number; ec: ClaimForEDI; issues: ReadinessIssue[] }[] = [];
      ediClaims.forEach((ec, i) => {
        const issues = evaluateClaimReadiness({
          claim: { ...ec, id: (selectedClaims[i] as any).id, trip_id: (selectedClaims[i] as any).trip_id, patient_id: (selectedClaims[i] as any).patient_id },
          billingState: providerInfo.state,
        }).filter((x) => x.severity === "block");
        if (issues.length) blocked.push({ idx: i, ec, issues });
      });
      if (blocked.length > 0) {
        setValidationIssues(blocked);
        toast.error(`${blocked.length} claim(s) blocked from export — see details below.`);
        setGenerating(false);
        return;
      }
      setValidationIssues([]);

      // Generate 837P
      const ediContent = generateEDI837P(ediClaims, providerInfo, submitterInfo);
      const filename = generateEDIFilename(testMode);

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

      // Persist artifact (full EDI bytes) so we have ground truth for any
      // future rejection analysis. Without this, the only copy of what was
      // sent is the file in the user's browser downloads folder.
      let artifactId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (activeCompanyId) {
          const { data: artRow, error: artErr } = await supabase
            .from("claim_submission_artifacts" as any)
            .insert({
              company_id: activeCompanyId,
              filename,
              edi_content: ediContent,
              claim_ids: ids,
              byte_size: new Blob([ediContent]).size,
              is_test_submission: testMode,
              generated_by: user?.id ?? null,
            } as any)
            .select("id")
            .single();
          if (!artErr && artRow) artifactId = (artRow as any).id;
        }
      } catch (e) {
        // Non-fatal — download already succeeded
        console.warn("Failed to persist EDI artifact:", e);
      }

      await supabase
        .from("claim_records" as any)
        .update({
          exported_at: now,
          is_test_submission: testMode,
          ...(artifactId ? { last_submission_artifact_id: artifactId } : {}),
        } as any)
        .in("id", ids);

      // Audit log
      await logAuditEvent({
        action: "edi_837p_export",
        tableName: "claim_records",
        notes: `Exported ${ids.length} claims to ${filename}${testMode ? " [SANDBOX/OATEST]" : ""}`,
        newData: { claim_ids: ids, filename, test_mode: testMode },
      });

      toast.success(
        testMode
          ? `🧪 SANDBOX file ${filename} generated (${ids.length} test claims). Submit to OATEST only.`
          : `${filename} downloaded with ${ids.length} claims`
      );

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

  const handleSubmitSingleTest = async () => {
    if (!testMode) {
      toast.error("Turn on Test Mode first (Settings → Clearinghouse → Step 4) before submitting a single test claim.");
      return;
    }
    if (selectedClaims.length !== 1) {
      toast.error(
        selectedClaims.length === 0
          ? "Select exactly one claim to submit as a single test."
          : `You have ${selectedClaims.length} claims selected. Single-test mode requires exactly one — deselect the others first.`
      );
      return;
    }
    await handleGenerate();
  };

  // Queue the generated 837P for automatic SFTP submission via Railway worker
  const handleSubmitToQueue = async () => {
    if (selectedClaims.length === 0) {
      toast.error("Select at least one claim to submit");
      return;
    }
    const provErrs = validateProviderInfo(providerInfo);
    if (provErrs.length > 0) {
      toast.error("Billing Provider invalid:\n" + provErrs.join("\n"), { duration: 8000 });
      return;
    }
    const subErrs = validateSubmitterInfo(submitterInfo);
    if (subErrs.length > 0) {
      toast.error("Vendor (PodDispatch) submitter not configured:\n" + subErrs.join("\n"), { duration: 8000 });
      return;
    }

    setSubmitting(true);
    try {
      // Re-use the same claim enrichment logic from handleGenerate
      const selTripIds = [...new Set(selectedClaims.map(c => (c as any).trip_id).filter(Boolean))];
      const selPatIds = [...new Set(selectedClaims.map(c => (c as any).patient_id).filter(Boolean))];
      const localTripsMap: Record<string, any> = {};
      const localPatsMap: Record<string, any> = {};
      if (selTripIds.length > 0) {
        const { data: trs } = await supabase.from("trip_records").select("id, loaded_miles, bed_confined, requires_monitoring, stretcher_placement, oxygen_during_transport, weight_lbs, pickup_location, destination_location, leg_id, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_dob, oneoff_primary_payer, oneoff_member_id, oneoff_sex, oneoff_pickup_address)").in("id", selTripIds);
        (trs || []).forEach((t: any) => { localTripsMap[t.id] = t; });
      }
      if (selPatIds.length > 0) {
        const { data: ps } = await supabase.from("patients").select("id, sex, weight_lbs").in("id", selPatIds);
        (ps || []).forEach(p => { localPatsMap[p.id] = p; });
      }

      // Facility lookup
      const facilityNames = [...new Set(
        selectedClaims.map(c => {
          const trip = localTripsMap[(c as any).trip_id] || {};
          if (!(c as any).destination_address && trip.destination_location) return trip.destination_location;
          return null;
        }).filter(Boolean)
      )] as string[];
      const facilityAddrMap: Record<string, string> = {};
      if (facilityNames.length > 0) {
        const { data: facs } = await supabase.from("facilities" as any).select("name, address").in("name", facilityNames);
        (facs || []).forEach((f: any) => { if (f.address) facilityAddrMap[f.name] = f.address; });
      }

      const ediClaims: ClaimForEDI[] = selectedClaims.map((c) => {
        const trip = localTripsMap[(c as any).trip_id] || {};
        const pat = localPatsMap[(c as any).patient_id] || {};
        const leg = trip.leg as any;
        const isOneoff = !c.patient_id && leg?.is_oneoff;
        const rawPatientAddr = String(c.patient_pickup_address ?? "").trim();
        const parsedPat = parseAddressString(rawPatientAddr);
        const claimOriginAddr = (c as any).origin_address || trip.pickup_location || c.patient_pickup_address || null;
        const claimDestAddr = (c as any).destination_address
          || (trip.destination_location && facilityAddrMap[trip.destination_location] ? facilityAddrMap[trip.destination_location] : null)
          || trip.destination_location || null;
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
          origin_address: claimOriginAddr,
          origin_city: (c as any).origin_city || "",
          origin_state: (c as any).origin_state || providerInfo.state || null,
          origin_zip: c.origin_zip,
          destination_address: claimDestAddr,
          destination_city: (c as any).destination_city || "",
          destination_state: (c as any).destination_state || providerInfo.state || null,
          destination_zip: c.destination_zip,
          diagnosis_codes: [],
          auth_number: c.auth_number,
          icd10_codes: c.icd10_codes || [],
          bed_confined: !!trip.bed_confined,
          requires_monitoring: !!trip.requires_monitoring,
          stretcher_placement: trip.stretcher_placement || null,
          oxygen_required: !!trip.oxygen_during_transport,
          weight_lbs: trip.weight_lbs || pat.weight_lbs || null,
          pickup_facility_name: extractFacilityName(claimOriginAddr) || null,
          dropoff_facility_name: (trip.destination_location && facilityAddrMap[trip.destination_location] ? trip.destination_location : extractFacilityName(claimDestAddr)) || null,
          pcs_physician_name: (c as any).pcs_physician_name ?? null,
          pcs_physician_npi: (c as any).pcs_physician_npi ?? null,
          pcs_certification_date: (c as any).pcs_certification_date ?? null,
          pcs_diagnosis: (c as any).pcs_diagnosis ?? null,
          chief_complaint: (c as any).chief_complaint ?? null,
          primary_impression: (c as any).primary_impression ?? null,
        };
      });

      // Validate
      const blocked: { idx: number; ec: ClaimForEDI; issues: ReadinessIssue[] }[] = [];
      ediClaims.forEach((ec, i) => {
        const issues = evaluateClaimReadiness({
          claim: { ...ec, id: (selectedClaims[i] as any).id, trip_id: (selectedClaims[i] as any).trip_id, patient_id: (selectedClaims[i] as any).patient_id },
          billingState: providerInfo.state,
        }).filter((x) => x.severity === "block");
        if (issues.length) blocked.push({ idx: i, ec, issues });
      });
      if (blocked.length > 0) {
        setValidationIssues(blocked);
        toast.error(`${blocked.length} claim(s) blocked from submission — see details below.`);
        setSubmitting(false);
        return;
      }
      setValidationIssues([]);

      const ediContent = generateEDI837P(ediClaims, providerInfo, submitterInfo);
      const filename = generateEDIFilename(testMode);
      const ids = selectedClaims.map((c) => c.id);

      if (!activeCompanyId) {
        toast.error("Could not determine company");
        setSubmitting(false);
        return;
      }

      // Insert into queue
      const { error: queueErr } = await supabase
        .from("claim_submission_queue" as any)
        .insert({
          company_id: activeCompanyId,
          claim_ids: ids,
          filename,
          edi_content: ediContent,
          is_test: testMode,
          status: "pending",
        } as any);

      if (queueErr) throw queueErr;

      // Mark claims as exported
      const now = new Date().toISOString();
      await supabase
        .from("claim_records" as any)
        .update({ exported_at: now, is_test_submission: testMode } as any)
        .in("id", ids);

      await logAuditEvent({
        action: "edi_837p_queued_for_sftp",
        tableName: "claim_submission_queue",
        notes: `Queued ${ids.length} claims for SFTP submission: ${filename}${testMode ? " [TEST]" : ""}`,
        newData: { claim_ids: ids, filename, test_mode: testMode },
      });

      toast.success(`📤 ${ids.length} claim(s) queued for automatic submission to Office Ally as ${filename}`);
      await fetchClaims();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Failed to queue submission: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

        {testMode && (
          <Alert className="border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
            <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-sm">
              <strong>Sandbox / Test Mode is ON.</strong> Generated 837P files will use the OATEST envelope
              (ISA15=T) and exported claims will be tagged as test submissions — they won't pollute your real
              AR or revenue numbers. Toggle this off in <RouterLink to="/admin-settings" className="underline">
              Settings → Clearinghouse → Step 4</RouterLink> when you're ready to go live.
            </AlertDescription>
          </Alert>
        )}

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
                    readOnly={npiLocked}
                  />
                  {npiLocked && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      From company info. <RouterLink to="/onboarding" className="text-primary hover:underline">Edit</RouterLink>
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Tax ID (EIN) *</Label>
                  <Input
                    value={providerInfo.tax_id}
                    onChange={(e) => setProviderInfo((p) => ({ ...p, tax_id: e.target.value }))}
                    placeholder="12-3456789"
                    className="h-8 text-sm"
                    readOnly={einLocked}
                  />
                  {einLocked ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      From company info. <RouterLink to="/onboarding" className="text-primary hover:underline">Edit</RouterLink>
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-700 mt-0.5">
                      Not saved yet — entering it here will be saved to your company record.
                    </p>
                  )}
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
              <CardDescription className="text-xs">
                PodDispatch is the registered Office Ally vendor — these values are
                managed centrally and apply to every customer submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Submitter ID</Label>
                  <Input
                    value={submitterInfo.submitter_id}
                    className="h-8 text-sm"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs">Submitter Name</Label>
                  <Input
                    value={submitterInfo.submitter_name}
                    className="h-8 text-sm"
                    readOnly
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input
                    value={submitterInfo.contact_name}
                    className="h-8 text-sm"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input
                    value={submitterInfo.contact_phone}
                    className="h-8 text-sm"
                    readOnly
                  />
                </div>
              </div>
              {!submitterInfo.submitter_id && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Vendor settings are not yet configured. The system creator must add
                  PodDispatch's Office Ally identity before any 837P can be exported.
                </p>
              )}
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
                      <th className="p-2 w-8"></th>
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
                        <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {claim.exported_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title="Record clearinghouse rejection for this claim"
                              onClick={() =>
                                setRejectionTarget({
                                  id: claim.id,
                                  label: `${claim.patient_last_name}, ${claim.patient_first_name} (${claim.run_date})`,
                                })
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
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
                <Button
                  onClick={() => setPreviewOpen(true)}
                  disabled={generating}
                  size="lg"
                  variant="outline"
                  className="gap-2 ml-2"
                >
                  <Eye className="h-4 w-4" />
                  Preview Summary
                </Button>
                <Button
                  onClick={handleSubmitSingleTest}
                  disabled={generating || !testMode || selectedClaims.length !== 1}
                  size="lg"
                  variant="secondary"
                  className="gap-2 ml-2"
                  title={
                    !testMode
                      ? "Enable Test Mode in Clearinghouse Settings first"
                      : selectedClaims.length !== 1
                        ? "Select exactly one claim"
                        : "Generate a single OATEST claim file"
                  }
                >
                  <FileCheck2 className="h-4 w-4" />
                  Submit Single Test Claim
                </Button>
                <Button
                  onClick={handleSubmitToQueue}
                  disabled={submitting || generating || selectedClaims.length === 0}
                  size="lg"
                  variant="default"
                  className="gap-2 ml-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Submit to Office Ally
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

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Readable Claim Summary
                <Badge variant={testMode ? "outline" : "default"} className={testMode ? "border-amber-400 text-amber-700" : ""}>
                  {testMode ? "🧪 TEST MODE (OATEST)" : "🟢 LIVE MODE (Production)"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                What's actually inside the 837P file you're about to download. No EDI knowledge needed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-muted rounded">
                  <div className="text-2xl font-bold">{selectedClaims.length}</div>
                  <div className="text-xs text-muted-foreground">Claims</div>
                </div>
                <div className="p-3 bg-muted rounded">
                  <div className="text-2xl font-bold font-mono">${totalCharge.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Total Charges</div>
                </div>
                <div className="p-3 bg-muted rounded">
                  <div className="text-2xl font-bold">{providerInfo.organization_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">Billing Provider</div>
                </div>
              </div>

              <div className="text-xs space-y-1 p-3 bg-muted/40 rounded">
                <div><span className="text-muted-foreground">Sending to:</span> <span className="font-mono">{submitterInfo.receiver_id || "OFFICEALLY"}</span></div>
                <div><span className="text-muted-foreground">Submitter ID:</span> <span className="font-mono">{submitterInfo.submitter_id || "—"}</span></div>
                <div><span className="text-muted-foreground">Provider NPI:</span> <span className="font-mono">{providerInfo.npi || "—"}</span></div>
                <div><span className="text-muted-foreground">Provider Tax ID:</span> <span className="font-mono">{providerInfo.tax_id || "—"}</span></div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2 text-left font-medium text-muted-foreground">Patient</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">DOS</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Payer</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Member ID</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">HCPCS</th>
                      <th className="p-2 text-right font-medium text-muted-foreground">Miles</th>
                      <th className="p-2 text-right font-medium text-muted-foreground">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClaims.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">{c.patient_last_name}, {c.patient_first_name}</td>
                        <td className="p-2">{c.run_date}</td>
                        <td className="p-2 capitalize">{c.payer_type}</td>
                        <td className="p-2 font-mono">{c.patient_member_id || c.member_id || "—"}</td>
                        <td className="p-2 font-mono">{(c.hcpcs_codes || []).join(", ") || "—"}</td>
                        <td className="p-2 text-right font-mono">{c.trip_loaded_miles ?? "—"}</td>
                        <td className="p-2 text-right font-mono">${(c.total_charge || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {testMode && (
                <Alert className="border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
                  <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs">
                    This file will be tagged <strong>TEST</strong> in the X12 envelope (ISA15=T) and routed to
                    OATEST. Office Ally will validate format but won't pay or adjudicate.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {rejectionTarget && (
          <RecordRejectionDialog
            open={!!rejectionTarget}
            onOpenChange={(o) => { if (!o) setRejectionTarget(null); }}
            claimId={rejectionTarget.id}
            claimLabel={rejectionTarget.label}
            onSaved={fetchClaims}
          />
        )}
      </div>
    </AdminLayout>
  );
}
