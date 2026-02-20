import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImportCenter } from "@/components/migration/ImportCenter";
import { ColumnMapper } from "@/components/migration/ColumnMapper";
import { ImportResult } from "@/components/migration/ImportResult";
import { QuickStartWizard } from "@/components/migration/QuickStartWizard";
import { ParallelRunMode } from "@/components/migration/ParallelRunMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Zap, GitCompareArrows, History, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

type ImportStage = "select" | "map" | "result";

interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  dataType: string;
  isHistorical: boolean;
}

// Simple duplicate detection
function detectDuplicates(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  existingNames: string[]
): { name: string; existing: string }[] {
  const nameField = Object.entries(mapping).find(([, v]) => v === "first_name")?.[0];
  const lastField = Object.entries(mapping).find(([, v]) => v === "last_name")?.[0];
  if (!nameField && !lastField) return [];

  const dupes: { name: string; existing: string }[] = [];
  const normalizedExisting = existingNames.map(n => n.toLowerCase().trim());

  rows.forEach(row => {
    const fullName = [row[nameField || ""] || "", row[lastField || ""] || ""].join(" ").trim();
    if (!fullName) return;
    const match = normalizedExisting.find(
      e => e === fullName.toLowerCase() || e.includes(fullName.toLowerCase().split(" ")[0])
    );
    if (match) {
      dupes.push({ name: fullName, existing: match });
    }
  });

  return dupes.slice(0, 20);
}

// Generate import warnings
function analyzeWarnings(
  rows: Record<string, string>[],
  mapping: Record<string, string>
): { message: string; count: number }[] {
  const warnings: { message: string; count: number }[] = [];
  const reverseMap: Record<string, string> = {};
  Object.entries(mapping).forEach(([src, dst]) => { if (dst !== "_skip") reverseMap[dst] = src; });

  const checks: { field: string; label: string }[] = [
    { field: "dob", label: "missing date of birth" },
    { field: "phone", label: "missing phone number" },
    { field: "pickup_address", label: "missing pickup address" },
    { field: "primary_payer", label: "missing payer/insurance" },
    { field: "member_id", label: "missing member ID" },
  ];

  checks.forEach(({ field, label }) => {
    const srcCol = reverseMap[field];
    if (!srcCol) return;
    const missing = rows.filter(r => !r[srcCol]?.trim()).length;
    if (missing > 0) warnings.push({ message: `${missing} patients ${label}`, count: missing });
  });

  return warnings;
}

export default function MigrationOnboarding() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("import");
  const [importStage, setImportStage] = useState<ImportStage>("select");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [importWarnings, setImportWarnings] = useState<{ message: string; count: number }[]>([]);
  const [importDuplicates, setImportDuplicates] = useState<{ name: string; existing: string }[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [parallelMode, setParallelMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc("get_my_company_id").then(({ data: companyId }) => {
      if (!companyId) return;
      supabase
        .from("migration_settings")
        .select("parallel_mode")
        .eq("company_id", companyId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setParallelMode(data.parallel_mode);
        });
    });
  }, []);

  const handleToggleParallel = async (val: boolean) => {
    setParallelMode(val);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    if (!companyId) return;
    await supabase.from("migration_settings").upsert({
      company_id: companyId,
      parallel_mode: val,
    }, { onConflict: "company_id" });
  };

  const handleFilesParsed = useCallback((data: ParsedFile) => {
    setParsedFile(data);
    setImportStage("map");
  }, []);

  const handleMappingComplete = useCallback(async (mapping: Record<string, string>) => {
    if (!parsedFile) return;
    setSaving(true);

    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) throw new Error("No company");

      // Build reverse mapping
      const reverseMap: Record<string, string> = {};
      Object.entries(mapping).forEach(([src, dst]) => {
        if (dst && dst !== "_skip") reverseMap[dst] = src;
      });

      let imported = 0;
      const dataType = parsedFile.dataType;

      if (dataType === "patients" || dataType === "mixed" || dataType === "schedules") {
        // Fetch existing patients for dedup
        const { data: existingPatients } = await supabase
          .from("patients")
          .select("first_name, last_name")
          .eq("company_id", companyId);
        const existingNames = (existingPatients || []).map(p => `${p.first_name} ${p.last_name}`);
        const dupes = detectDuplicates(parsedFile.rows, mapping, existingNames);
        setImportDuplicates(dupes);

        const patientRows = parsedFile.rows
          .filter(row => {
            const fn = row[reverseMap["first_name"] || ""]?.trim();
            const ln = row[reverseMap["last_name"] || ""]?.trim();
            return fn || ln;
          })
          .map(row => {
            const get = (field: string) => row[reverseMap[field] || ""]?.trim() || null;
            return {
              first_name: get("first_name") || "Unknown",
              last_name: get("last_name") || "Unknown",
              phone: get("phone"),
              dob: get("dob") || null,
              pickup_address: get("pickup_address"),
              dropoff_facility: get("dropoff_facility"),
              primary_payer: get("primary_payer"),
              secondary_payer: get("secondary_payer"),
              member_id: get("member_id"),
              mobility: get("mobility") || "ambulatory",
              notes: get("notes"),
              special_handling: get("special_handling"),
              company_id: companyId,
            };
          });

        if (patientRows.length > 0) {
          // Insert in batches of 50
          for (let i = 0; i < patientRows.length; i += 50) {
            const batch = patientRows.slice(i, i + 50);
            const { error } = await supabase.from("patients").insert(batch);
            if (!error) imported += batch.length;
          }
        }

        setImportWarnings(analyzeWarnings(parsedFile.rows, mapping));
      } else if (dataType === "facilities") {
        const facilityRows = parsedFile.rows
          .filter(row => row[reverseMap["name"] || ""]?.trim())
          .map(row => {
            const get = (field: string) => row[reverseMap[field] || ""]?.trim() || null;
            return {
              name: get("name") || "Unknown",
              facility_type: get("facility_type") || "dialysis",
              address: get("address"),
              phone: get("phone"),
              contact_name: get("contact_name"),
              notes: get("notes"),
              company_id: companyId,
            };
          });

        if (facilityRows.length > 0) {
          const { error } = await supabase.from("facilities").insert(facilityRows);
          if (!error) imported = facilityRows.length;
        }
      }

      // Log import session
      await supabase.from("import_sessions").insert({
        company_id: companyId,
        file_name: parsedFile.fileName,
        data_type: parsedFile.dataType,
        status: "completed",
        total_rows: parsedFile.rows.length,
        imported_rows: imported,
        warning_count: importWarnings.length,
        column_mapping: mapping,
        raw_headers: parsedFile.headers,
        is_historical: parsedFile.isHistorical,
        is_test_mode: parallelMode,
      });

      setImportedCount(imported);
      setImportStage("result");
      toast({ title: "Import complete", description: `${imported} records imported.` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [parsedFile, parallelMode, importWarnings.length]);

  const resetImport = () => {
    setImportStage("select");
    setParsedFile(null);
    setImportWarnings([]);
    setImportDuplicates([]);
    setImportedCount(0);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Migration & Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Switch to PodDispatch safely. Import data, run parallel, or start fresh — your choice.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" /> Import Data
            </TabsTrigger>
            <TabsTrigger value="quickstart" className="gap-2">
              <Zap className="h-4 w-4" /> Quick Start
            </TabsTrigger>
            <TabsTrigger value="parallel" className="gap-2">
              <GitCompareArrows className="h-4 w-4" /> Parallel Run
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> Import History
            </TabsTrigger>
          </TabsList>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="mt-6">
            {/* Start Forward banner */}
            <Card className="mb-6 border-green-200 bg-green-50/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">Start-Forward Mode Active</p>
                    <p className="text-xs text-green-700">
                      You can start dispatching immediately — even with incomplete data. Add patients, facilities, and history at your own pace.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                    Go to Dispatch
                  </Button>
                </div>
              </CardContent>
            </Card>

            {saving && (
              <Card className="mb-6">
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Importing your data…</span>
                </CardContent>
              </Card>
            )}

            {importStage === "select" && (
              <ImportCenter onFilesParsed={handleFilesParsed} />
            )}

            {importStage === "map" && parsedFile && (
              <ColumnMapper
                headers={parsedFile.headers}
                dataType={parsedFile.dataType}
                rows={parsedFile.rows}
                onComplete={handleMappingComplete}
                onBack={resetImport}
              />
            )}

            {importStage === "result" && parsedFile && (
              <ImportResult
                fileName={parsedFile.fileName}
                totalRows={parsedFile.rows.length}
                importedRows={importedCount}
                warnings={importWarnings}
                duplicates={importDuplicates}
                onFixLater={resetImport}
                onViewDuplicates={() => {}}
              />
            )}
          </TabsContent>

          {/* QUICK START TAB */}
          <TabsContent value="quickstart" className="mt-6">
            <div className="mb-6">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm text-blue-800">
                    <strong>No existing software?</strong> This wizard will get you operational in under 30 minutes.
                    Just add your trucks, top patients, and primary facilities.
                  </p>
                </CardContent>
              </Card>
            </div>
            <QuickStartWizard onComplete={() => navigate("/")} />
          </TabsContent>

          {/* PARALLEL RUN TAB */}
          <TabsContent value="parallel" className="mt-6">
            <ParallelRunMode enabled={parallelMode} onToggle={handleToggleParallel} />
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="mt-6">
            <ImportHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function ImportHistory() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("import_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setSessions(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading history…</p>;
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">No imports yet. Upload your first file to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map(s => (
        <Card key={s.id}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{s.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.data_type} — {s.imported_rows}/{s.total_rows} rows imported
                </p>
              </div>
              <div className="flex items-center gap-2">
                {s.is_historical && <Badge variant="outline" className="text-xs">Historical</Badge>}
                {s.is_test_mode && <Badge variant="outline" className="text-xs">Test</Badge>}
                <Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-xs">
                  {s.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
