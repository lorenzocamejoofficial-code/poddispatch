import { useState, useEffect, useCallback } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Truck, Users, Calendar, Building2, FlaskConical, Play, RefreshCw } from "lucide-react";
import DailyRunSheet from "./DailyRunSheet";

interface CompanyOption {
  id: string;
  name: string;
  is_sandbox: boolean;
}

interface TruckOption {
  id: string;
  name: string;
}

interface CrewOption {
  id: string;
  truck_id: string;
  active_date: string;
  member1_name: string | null;
  member2_name: string | null;
}

interface TokenOption {
  id: string;
  token: string;
  truck_id: string;
  valid_from: string;
  valid_until: string;
  active: boolean;
}

export default function CrewUIPreview() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [crews, setCrews] = useState<CrewOption[]>([]);
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load companies
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("companies").select("id, name, is_sandbox").order("name");
      setCompanies((data ?? []) as CompanyOption[]);
      setLoading(false);
    };
    load();
  }, []);

  // Load trucks when company selected
  useEffect(() => {
    if (!selectedCompanyId) { setTrucks([]); return; }
    const load = async () => {
      const { data } = await supabase.from("trucks").select("id, name").eq("company_id", selectedCompanyId).eq("active", true).order("name");
      setTrucks((data ?? []) as TruckOption[]);
      // Check if sandbox company
      const company = companies.find(c => c.id === selectedCompanyId);
      setIsSimulated(company?.is_sandbox ?? false);
    };
    load();
  }, [selectedCompanyId, companies]);

  // Load crews and tokens when truck + date selected
  useEffect(() => {
    if (!selectedTruckId || !selectedDate) return;
    const load = async () => {
      const [{ data: crewData }, { data: tokenData }] = await Promise.all([
        supabase.from("crews")
          .select("id, truck_id, active_date, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
          .eq("truck_id", selectedTruckId)
          .eq("active_date", selectedDate),
        supabase.from("crew_share_tokens")
          .select("id, token, truck_id, valid_from, valid_until, active")
          .eq("truck_id", selectedTruckId)
          .eq("active", true)
          .lte("valid_from", selectedDate)
          .gte("valid_until", selectedDate),
      ]);
      setCrews((crewData ?? []).map((c: any) => ({
        id: c.id,
        truck_id: c.truck_id,
        active_date: c.active_date,
        member1_name: c.member1?.full_name ?? null,
        member2_name: c.member2?.full_name ?? null,
      })));
      setTokens((tokenData ?? []) as TokenOption[]);
      if (tokenData && tokenData.length > 0) {
        setSelectedToken(tokenData[0].token);
      } else {
        setSelectedToken("");
      }
    };
    load();
  }, [selectedTruckId, selectedDate]);

  // Check simulation status
  useEffect(() => {
    if (!selectedCompanyId) return;
    const load = async () => {
      const { data } = await supabase.from("simulation_runs").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSimulationRunId(data?.id ?? null);
    };
    load();
  }, [selectedCompanyId]);

  const generatePreviewToken = useCallback(async () => {
    if (!selectedTruckId) return;
    // Create a short-lived token for preview
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("crew_share_tokens").insert({
      truck_id: selectedTruckId,
      created_by: user.id,
      valid_from: selectedDate,
      valid_until: selectedDate,
      active: true,
    } as any).select("token").single();
    if (error) return;
    setSelectedToken(data.token);
    // Reload tokens
    const { data: tokenData } = await supabase.from("crew_share_tokens")
      .select("id, token, truck_id, valid_from, valid_until, active")
      .eq("truck_id", selectedTruckId)
      .eq("active", true);
    setTokens((tokenData ?? []) as TokenOption[]);
  }, [selectedTruckId, selectedDate]);

  const crew = crews[0];
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const selectedTruck = trucks.find(t => t.id === selectedTruckId);
  const canPreview = !!selectedToken;

  return (
    <CreatorLayout title="Crew UI Preview">
      <div className="space-y-4">
        {/* Context bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-xs border-primary text-primary">
            <Eye className="mr-1 h-3 w-3" /> CREATOR PREVIEW
          </Badge>
          <span className="text-xs text-muted-foreground">
            Inspect and test the exact crew-facing experience using real or simulated data.
          </span>
        </div>

        {/* Selector controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Preview Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Company */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5" /> Company
                </Label>
                <Select value={selectedCompanyId} onValueChange={v => { setSelectedCompanyId(v); setSelectedTruckId(""); setPreviewActive(false); }}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.is_sandbox ? "🧪" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Truck */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Truck className="h-3.5 w-3.5" /> Truck
                </Label>
                <Select value={selectedTruckId} onValueChange={v => { setSelectedTruckId(v); setPreviewActive(false); }} disabled={!selectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                  <SelectContent>
                    {trucks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Date
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setPreviewActive(false); }}
                />
              </div>

              {/* Token */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <FlaskConical className="h-3.5 w-3.5" /> Token
                </Label>
                {tokens.length > 0 ? (
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
                    <SelectContent>
                      {tokens.map(t => (
                        <SelectItem key={t.id} value={t.token}>
                          {t.token.slice(0, 12)}… ({t.valid_from})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={generatePreviewToken} disabled={!selectedTruckId}>
                    Generate Preview Token
                  </Button>
                )}
              </div>
            </div>

            {/* Mode toggle and launch */}
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={interactive}
                    onCheckedChange={setInteractive}
                    id="interactive-mode"
                  />
                  <Label htmlFor="interactive-mode" className="text-sm">
                    {interactive ? "Interactive" : "Read-Only"} Preview
                  </Label>
                </div>
                {interactive && !isSimulated && (
                  <Badge variant="destructive" className="text-[10px]">
                    ⚠ Interactive mode restricted to sandbox companies
                  </Badge>
                )}
              </div>
              <Button
                onClick={() => setPreviewActive(true)}
                disabled={!canPreview}
              >
                <Play className="mr-1.5 h-4 w-4" /> Open Crew View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview context banner */}
        {previewActive && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-xs">
                <span><strong>Company:</strong> {selectedCompany?.name ?? "—"}</span>
                <span><strong>Truck:</strong> {selectedTruck?.name ?? "—"}</span>
                <span><strong>Crew:</strong> {crew ? [crew.member1_name, crew.member2_name].filter(Boolean).join(" & ") : "No crew"}</span>
                <span><strong>Date:</strong> {selectedDate}</span>
                <Badge variant={isSimulated ? "secondary" : "outline"} className="text-[10px]">
                  {isSimulated ? "🧪 Simulated" : "🔴 Live Data"}
                </Badge>
                <span className="text-muted-foreground">Token: {selectedToken.slice(0, 8)}…</span>
                <Badge variant="outline" className="text-[10px]">
                  {interactive ? "Interactive" : "Read-Only"}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewActive(false)}>
                <EyeOff className="mr-1 h-3.5 w-3.5" /> Close Preview
              </Button>
            </div>
          </div>
        )}

        {/* Actual crew UI rendered */}
        {previewActive && selectedToken && (
          <div className={`rounded-lg border-2 ${interactive && isSimulated ? "border-primary/40" : "border-muted"} overflow-hidden ${!interactive || !isSimulated ? "pointer-events-none opacity-90" : ""}`}>
            <div className="max-w-md mx-auto bg-background">
              <CrewRunSheetPreview token={selectedToken} />
            </div>
          </div>
        )}
      </div>
    </CreatorLayout>
  );
}

// Wrapper that renders the real DailyRunSheet using route params simulation
function CrewRunSheetPreview({ token }: { token: string }) {
  // We render the DailyRunSheet in an iframe-like container pointing to the real crew route
  // This ensures we use the exact same component with the exact same behavior
  return (
    <iframe
      src={`/crew/${token}`}
      className="w-full border-0"
      style={{ height: "80vh", minHeight: 600 }}
      title="Crew Run Sheet Preview"
    />
  );
}
