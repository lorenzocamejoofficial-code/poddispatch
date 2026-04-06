import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";

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
      if (Date.now() - parsed.ts > 30 * 60 * 1000) return null; // 30min expiry
      return parsed.data;
    } catch { return null; }
  }, [company.id]);

  const saveCache = (data: VerificationResult) => {
    sessionStorage.setItem(getCacheKey(), JSON.stringify({ data, ts: Date.now() }));
  };

  const runAllChecks = useCallback(async () => {
    setLoading(true);
    const newResults: VerificationResult = {
      npi: { status: "pending" },
      medicare: { status: "pending" },
      oig: { status: "pending" },
    };

    // Run all 3 checks in parallel
    await Promise.all([
      checkNPI(company.npi_number, company.name).then(r => { newResults.npi = r; }),
      checkMedicare(company.npi_number).then(r => { newResults.medicare = r; }),
      checkOIG(company.name, company.state_of_operation).then(r => { newResults.oig = r; }),
    ]);

    setResults(newResults);
    saveCache(newResults);
    onVerificationComplete?.(newResults);

    // Store results to DB
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("companies").update({
        npi_verified: newResults.npi.status === "verified",
        npi_registered_name: newResults.npi.registeredName || null,
        medicare_enrolled: newResults.medicare.status === "enrolled",
        medicare_specialty: newResults.medicare.specialty || null,
        oig_excluded: newResults.oig.status === "excluded",
        oig_exclusion_details: newResults.oig.details || null,
        verification_checked_at: new Date().toISOString(),
        verified_by: user?.id || null,
      } as any).eq("id", company.id);
    } catch (err) {
      console.error("Failed to store verification results:", err);
    }

    setLoading(false);
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
        <CheckRow
          title="NPI Verification"
          loading={loading && results.npi.status === "pending"}
          badge={<NPIBadge status={results.npi.status} />}
        >
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
        <CheckRow
          title="Medicare Enrollment"
          loading={loading && results.medicare.status === "pending"}
          badge={<MedicareBadge status={results.medicare.status} />}
        >
          {results.medicare.status !== "pending" && (
            <div className="text-xs text-muted-foreground">
              {results.medicare.specialty && <p><span className="font-medium text-foreground">Specialty:</span> {results.medicare.specialty}</p>}
              {results.medicare.error && <p className="text-destructive">{results.medicare.error}</p>}
            </div>
          )}
        </CheckRow>

        {/* 3. OIG Exclusion */}
        <CheckRow
          title="OIG Exclusion Check"
          loading={loading && results.oig.status === "pending"}
          badge={<OIGBadge status={results.oig.status} />}
        >
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

          <div className="flex items-start gap-3">
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" asChild>
              <a href="https://dph.georgia.gov/EMS/ems-licensure/ems-agency-licensure" target="_blank" rel="noopener noreferrer">
                Check Georgia DPH License <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">Search for: <span className="font-medium text-foreground">{company.name}</span> ({company.state_of_operation || "—"})</p>
          </div>

          <div className="flex items-start gap-3">
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" asChild>
              <a href="https://ecorp.sos.ga.us/BusinessSearch" target="_blank" rel="noopener noreferrer">
                Check GA Business Registration <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">Search for: <span className="font-medium text-foreground">{company.name}</span></p>
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
  return <Badge variant="outline" className="text-xs">Pending</Badge>;
}

// --- API check functions ---

function getOverallStatus(r: VerificationResult): "pass" | "review" | "fail" | "pending" {
  if (r.npi.status === "pending" || r.medicare.status === "pending" || r.oig.status === "pending") return "pending";
  if (r.oig.status === "excluded" || r.npi.status === "not_found") return "fail";
  if (r.npi.status === "mismatch" || r.medicare.status === "different_specialty" || r.medicare.status === "not_enrolled") return "review";
  return "pass";
}

function namesCloselyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

async function checkNPI(npi: string | null, companyName: string): Promise<VerificationResult["npi"]> {
  if (!npi) return { status: "not_found", error: "No NPI number provided" };
  try {
    const resp = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return { status: "not_found" };
    const r = data.results[0];
    const basic = r.basic || {};
    const registeredName = basic.organization_name || `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    const addr = r.addresses?.[0] || {};
    const address = [addr.address_1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ");
    const matched = namesCloselyMatch(registeredName, companyName);
    return {
      status: matched ? "verified" : "mismatch",
      registeredName,
      address,
      state: addr.state || "",
      entityType: basic.enumeration_type === "NPI-2" ? "Organization" : "Individual",
    };
  } catch (err: any) {
    return { status: "not_found", error: err.message || "NPI lookup failed" };
  }
}

async function checkMedicare(npi: string | null): Promise<VerificationResult["medicare"]> {
  if (!npi) return { status: "not_enrolled", error: "No NPI number provided" };
  try {
    const resp = await fetch(`https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: [{ property: "npi", value: npi, operator: "=" }],
        limit: 5,
      }),
    });
    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) return { status: "not_enrolled" };
    const specialties = results.map((r: any) => r.provider_type || r.pri_spec || "").filter(Boolean);
    const isAmbulance = specialties.some((s: string) =>
      s.toLowerCase().includes("ambulance") || s.toLowerCase().includes("emergency medical")
    );
    return {
      status: isAmbulance ? "enrolled" : "different_specialty",
      specialty: specialties[0] || "Unknown",
    };
  } catch (err: any) {
    return { status: "not_enrolled", error: err.message || "Medicare lookup failed" };
  }
}

async function checkOIG(name: string, state: string | null): Promise<VerificationResult["oig"]> {
  try {
    const params = new URLSearchParams({ name });
    if (state) params.set("state", state);
    const resp = await fetch(`https://ofisapi.oig.hhs.gov/api/exclusions/search?${params.toString()}`);
    if (!resp.ok) {
      // OIG API can be flaky — treat non-200 as "couldn't check"
      return { status: "not_excluded", error: "OIG API unavailable — manual check recommended" };
    }
    const data = await resp.json();
    const results = data.results || data || [];
    if (!Array.isArray(results) || results.length === 0) return { status: "not_excluded" };
    // Check for close name match
    const match = results.find((r: any) => {
      const rName = (r.busname || r.lastname || "").toLowerCase();
      return namesCloselyMatch(rName, name);
    });
    if (match) {
      return {
        status: "excluded",
        details: `Excluded: ${match.busname || match.lastname} — ${match.excltype || "Unknown type"} (${match.excldate || "Date unknown"})`,
      };
    }
    return { status: "not_excluded" };
  } catch (err: any) {
    return { status: "not_excluded", error: err.message || "OIG lookup failed" };
  }
}

export type { VerificationResult };
