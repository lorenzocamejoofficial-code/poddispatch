import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "ok" | "degraded" | "down" | "unknown";
interface Check { name: string; status: Status; latency_ms: number; detail?: string }
interface HealthResponse { status: Status; checked_at: string; checks: Check[] }

const variantFor = (s: Status): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "ok") return "default";
  if (s === "degraded") return "secondary";
  if (s === "down") return "destructive";
  return "outline";
};

export function SystemHealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("health");
    if (error) setError(error.message);
    else setData(data as HealthResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm">Manual Health Check</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pings each service when this panel is open. Not a monitoring/alerting system —
            hook /health to an external uptime service (Better Stack, Pingdom) for paging.
          </p>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Overall: <Badge variant={variantFor(data.status)} className="ml-1 capitalize">{data.status}</Badge>
              <span className="ml-2">checked {new Date(data.checked_at).toLocaleTimeString()}</span>
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!error && data && (
          <ul className="space-y-1.5 text-sm">
            {data.checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant={variantFor(c.status)} className="capitalize">{c.status}</Badge>
                  <span className="font-medium capitalize">{c.name.replace("_", " ")}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{c.latency_ms} ms</div>
                  {c.detail && <div className="max-w-[260px] truncate" title={c.detail}>{c.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!error && !data && loading && <p className="text-xs text-muted-foreground">Checking services…</p>}
      </CardContent>
    </Card>
  );
}