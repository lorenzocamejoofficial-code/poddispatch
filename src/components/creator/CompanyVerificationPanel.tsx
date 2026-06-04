import { MouseEvent, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw, Shield } from "lucide-react";

interface VerificationResult {
  npi: {
    status: "verified" | "mismatch" | "not_found" | "pending";
    registeredName?: string;
    address?: string;
    state?: string;
    entityType?: string;
    error?: string;
  };
  medicare: {
    status: "enrolled" | "different_specialty" | "not_enrolled" | "pending";
    specialty?: string;
    error?: string;
  };
  oig: {
    status: "not_excluded" | "excluded" | "pending";
    details?: string;
    error?: string;
  };
}

interface CompanyForVerification {
  id: string;
  name: string;
  npi_number: string | null;
  state_of_operation: string | null;
  owner_email: string | null;
  current_software?: string | null;
  years_in_operation?: number | null;
  has_inhouse_biller?: boolean | null;
  hipaa_privacy_officer?: string | null;
}

interface Props {
  company: CompanyForVerification;
  onVerificationComplete?: (results: VerificationResult) => void;
}

const CACHE_KEY_PREFIX = "verification_cache_";
const CHECK_TIMEOUT_MS = 15000;

const manualVerificationUrls = {
  oig: "https://exclusions.oig.hhs.gov/",
  npi: (npi: string | null) => `https://npiregistry.cms.hhs.gov/search?number=${encodeURIComponent(npi || "")}`,
  medicare: (npi: string | null) => `https://www.medicare.gov/care-compare/results?searchType=Provider&npi=${encodeURIComponent(npi || "")}`,
  georgiaDph: "https://dph.georgia.gov/EMS/ems-licensure/ems-agency-licensure",
  georgiaBusiness: (name: string) => `https://ecorp.sos.ga.gov/BusinessSearch/BusinessSearchResults?businessName=${encodeURIComponent(name)}&searchType=Contains`,
};

async function invokeFunctionWithTimeout(functionName: string, body: Record<string, unknown>, label: string) {
  return Promise.race([
    supabase.functions.invoke(functionName, { body }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out. Try Refresh again or use the manual link.`)), CHECK_TIMEOUT_MS);
    }),
  ]);
}

export function CompanyVerificationPanel({ company, onVerificationComplete }: Props) {
  const [results, setResults] = useState<VerificationResult>({
    npi: { status: "pending" },
    medicare: { status: "pending" },
    oig: { status: "pending" },
  });
  const [loading, setLoading] = useState(false);

  const getCacheKey = () => `${CACHE_KEY_PREFIX}${company.id}`;

  const loadCached = useCallback((): VerificationResult | null => {
    try {
      const raw = sessionStorage.getItem(getCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > 30 * 60 * 1000) return null;
      return parsed.data;
    } catch { return null; }
  }, [company.id]);

  const saveCache = (data: VerificationResult) => {
    sessionStorage.setItem(getCacheKey(), JSON.stringify({ data, ts: Date.now() }));
  };

  const openManualLink = async (url: string, label: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;

    try {
      await navigator.clipboard.writeText(url);
      toast.warning(`${label} was blocked by the browser. I copied the link so you can paste it in a new tab.`);
    } catch {
      toast.error(`${label} was blocked. Copy this URL manually: ${url}`);
    }
  };

  const runAllChecks = useCallback(async () => {
    setLoading(true);
    const newResults: VerificationResult = {
      npi: { status: "pending" },
      medicare: { status: "pending" },
      oig: { status: "pending" },
    };
    setResults(newResults);

    try {
      await Promise.all([
        checkNPI(company.npi_number, company.name, company.id).then(r => { newResults.npi = r; }),
        checkMedicare(company.npi_number, company.id).then(r => { newResults.medicare = r; }),
        checkOIG(company.name, company.state_of_operation, company.id).then(r => { newResults.oig = r; }),
      ]);

      setResults({ ...newResults });
      saveCache(newResults);
      onVerificationComplete?.(newResults);

      // Store verified_by via service-role edge function (RLS prevents direct client update).
      // Silent on failure — the verification results themselves are already displayed and persisted.
      try {
        const { error } = await invokeFunctionWithTimeout("mark-company-verified", { company_id: company.id }, "Mark verified");
        if (error) console.error("Failed to store verified_by:", error);
      } catch (err: any) {
        console.error("Failed to store verified_by:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    const cached = loadCached();
    if (cached) {
      setResults(cached);
      onVerificationComplete?.(cached);
    } else {
      runAllChecks();
    }
  }, [company.id]);

  const overallStatus = getOverallStatus(results);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Company Verification
          </CardTitle>
          <div className="flex items-center gap-2">
            <OverallBadge status={overallStatus} />
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={runAllChecks} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signup context */}
        {(company.current_software || company.years_in_operation || company.hipaa_privacy_officer) && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground text-xs mb-1">Signup Context</p>
            {company.current_software && <p><span className="text-muted-foreground">Current Software:</span> <span className="text-foreground">{company.current_software}</span></p>}
            {company.years_in_operation != null && <p><span className="text-muted-foreground">Years in Operation:</span> <span className="text-foreground">{company.years_in_operation}</span></p>}
            {company.has_inhouse_biller != null && <p><span className="text-muted-foreground">In-house Biller:</span> <span className="text-foreground">{company.has_inhouse_biller ? "Yes" : "No"}</span></p>}
            {company.hipaa_privacy_officer && <p><span className="text-muted-foreground">HIPAA Privacy Officer:</span> <span className="text-foreground">{company.hipaa_privacy_officer}</span></p>}
          </div>
        )}

        {/* 1. NPI Verification */}
        <CheckRow title="NPI Verification" loading={loading && results.npi.status === "pending"} badge={<NPIBadge status={results.npi.status} />}>
          {results.npi.status !== "pending" && (
            <div className="text-xs space-y-0.5 text-muted-foreground">
              {results.npi.registeredName && <p><span className="font-medium text-foreground">Registered Name:</span> {results.npi.registeredName}</p>}
              {results.npi.address && <p><span className="font-medium text-foreground">Address:</span> {results.npi.address}</p>}
              {results.npi.state && <p><span className="font-medium text-foreground">State:</span> {results.npi.state}</p>}
              {results.npi.entityType && <p><span className="font-medium text-foreground">Entity Type:</span> {results.npi.entityType}</p>}
              {results.npi.error && <p className="text-destructive">{results.npi.error}</p>}
              <p className="text-muted-foreground/70 mt-1">Signup name: <span className="font-medium">{company.name}</span></p>
            </div>
          )}
        </CheckRow>

        {/* 2. Medicare Enrollment */}
        <CheckRow title="Medicare Enrollment" loading={loading && results.medicare.status === "pending"} badge={<MedicareBadge status={results.medicare.status} />}>
          {results.medicare.status !== "pending" && (
            <div className="text-xs text-muted-foreground">
              {results.medicare.specialty && <p><span className="font-medium text-foreground">Specialty:</span> {results.medicare.specialty}</p>}
              {results.medicare.error && <p className="text-destructive">{results.medicare.error}</p>}
            </div>
          )}
        </CheckRow>

        {/* 3. OIG Exclusion */}
        <CheckRow title="OIG Exclusion Check" loading={loading && results.oig.status === "pending"} badge={<OIGBadge status={results.oig.status} />}>
          {results.oig.status !== "pending" && (
            <div className="text-xs text-muted-foreground">
              {results.oig.details && <p className="text-destructive font-medium">{results.oig.details}</p>}
              {results.oig.error && <p className="text-destructive">{results.oig.error}</p>}
            </div>
          )}
        </CheckRow>

        {/* 4. Manual checks */}
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-medium text-foreground">Manual Verification Links</p>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Use these for any check that comes back Unknown, Pending, or Not Found. Automated lookups require a valid NPI and a name that matches federal registries.
          </p>

          <div className="flex items-start gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={(e) => openManualLink(manualVerificationUrls.oig, "OIG LEIE Search", e)}>
              OIG LEIE Search <ExternalLink className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground">Search by entity name: <span className="font-medium text-foreground">{company.name}</span></p>
          </div>

          <div className="flex items-start gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={(e) => openManualLink(manualVerificationUrls.npi(company.npi_number), "NPI Registry Lookup", e)}>
              NPI Registry Lookup <ExternalLink className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground">NPI: <span className="font-medium text-foreground">{company.npi_number || "—"}</span></p>
          </div>

          <div className="flex items-start gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={(e) => openManualLink(manualVerificationUrls.medicare(company.npi_number), "Medicare Enrollment Lookup", e)}>
              Medicare Enrollment Lookup <ExternalLink className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground">Confirm ambulance enrollment for NPI <span className="font-medium text-foreground">{company.npi_number || "—"}</span></p>
          </div>

          <div className="flex items-start gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={(e) => openManualLink(manualVerificationUrls.georgiaDph, "Georgia DPH License", e)}>
              Check Georgia DPH License <ExternalLink className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground">Search for: <span className="font-medium text-foreground">{company.name}</span> ({company.state_of_operation || "—"})</p>
          </div>

          <div className="flex items-start gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={(e) => openManualLink(manualVerificationUrls.georgiaBusiness(company.name), "GA Business Registration", e)}>
              Check GA Business Registration <ExternalLink className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground">Pre-filled search for: <span className="font-medium text-foreground">{company.name}</span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Sub-components ---

function CheckRow({ title, loading, badge, children }: { title: string; loading: boolean; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : badge}
      </div>
      {children}
    </div>
  );
}

function OverallBadge({ status }: { status: "pass" | "review" | "fail" | "pending" }) {
  if (status === "pending") return <Badge variant="outline" className="text-xs">Checking...</Badge>;
  if (status === "pass") return <Badge className="bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> All Checks Passed</Badge>;
  if (status === "review") return <Badge className="bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))] text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Review Required</Badge>;
  return <Badge className="bg-destructive/15 text-destructive text-xs gap-1"><XCircle className="h-3 w-3" /> Red Flags Detected</Badge>;
}

function NPIBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge className="bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] text-xs">Verified</Badge>;
  if (status === "mismatch") return <Badge className="bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))] text-xs">Mismatch</Badge>;
  if (status === "not_found") return <Badge className="bg-destructive/15 text-destructive text-xs">Not Found</Badge>;
  return <Badge variant="outline" className="text-xs">Pending</Badge>;
}

function MedicareBadge({ status }: { status: string }) {
  if (status === "enrolled") return <Badge className="bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] text-xs">Enrolled</Badge>;
  if (status === "different_specialty") return <Badge className="bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))] text-xs">Enrolled — Different Specialty</Badge>;
  if (status === "not_enrolled") return <Badge className="bg-destructive/15 text-destructive text-xs">Not Enrolled</Badge>;
  return <Badge variant="outline" className="text-xs">Pending</Badge>;
}

function OIGBadge({ status }: { status: string }) {
  if (status === "not_excluded") return <Badge className="bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] text-xs">Not Excluded</Badge>;
  if (status === "excluded") return <Badge className="bg-destructive/15 text-destructive text-xs">OIG Excluded</Badge>;
  // pending = unknown — never show "Not Excluded" on failure
  return <Badge variant="outline" className="text-xs">Unknown</Badge>;
}

// --- API check functions via edge functions ---

function getOverallStatus(r: VerificationResult): "pass" | "review" | "fail" | "pending" {
  if (r.npi.status === "pending" || r.medicare.status === "pending" || r.oig.status === "pending") return "pending";
  if (r.oig.status === "excluded" || r.npi.status === "not_found") return "fail";
  if (r.npi.status === "mismatch" || r.medicare.status === "different_specialty" || r.medicare.status === "not_enrolled") return "review";
  return "pass";
}

async function checkNPI(npi: string | null, companyName: string, companyId: string): Promise<VerificationResult["npi"]> {
  if (!npi) return { status: "not_found", error: "No NPI number provided" };
  try {
    const { data, error } = await supabase.functions.invoke("verify-npi", {
      body: { npi, company_name: companyName, company_id: companyId },
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    return { status: "not_found", error: err.message || "NPI lookup failed" };
  }
}

async function checkMedicare(npi: string | null, companyId: string): Promise<VerificationResult["medicare"]> {
  if (!npi) return { status: "not_enrolled", error: "No NPI number provided" };
  try {
    const { data, error } = await supabase.functions.invoke("verify-medicare", {
      body: { npi, company_id: companyId },
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    return { status: "not_enrolled", error: err.message || "Medicare lookup failed" };
  }
}

async function checkOIG(name: string, state: string | null, companyId: string): Promise<VerificationResult["oig"]> {
  try {
    const { data, error } = await supabase.functions.invoke("verify-oig", {
      body: { name, state, company_id: companyId },
    });
    if (error) throw new Error(error.message);
    // Never show "not_excluded" on error — keep as pending/unknown
    return data;
  } catch (err: any) {
    return { status: "pending", error: err.message || "OIG lookup failed" };
  }
}

export type { VerificationResult };
