import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, RotateCcw, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FailedCall {
  id: string;
  trip_id: string | null;
  truck_id: string | null;
  call_type: string | null;
  patient_name: string | null;
  facility_name: string | null;
  message_text: string | null;
  to_number: string | null;
  payload: any;
  error_message: string | null;
  created_at: string;
  retry_of_event_id: string | null;
}

interface FailedCallsBannerProps {
  selectedDate: string;
}

export function FailedCallsBanner({ selectedDate }: FailedCallsBannerProps) {
  const [calls, setCalls] = useState<FailedCall[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchFailed = useCallback(async () => {
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    const { data } = await supabase
      .from("comms_events" as any)
      .select("id, trip_id, truck_id, call_type, patient_name, facility_name, message_text, to_number, payload, error_message, created_at, retry_of_event_id")
      .eq("status", "failed")
      .eq("direction", "outbound")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(20);
    setCalls(((data as any[]) ?? []) as FailedCall[]);
  }, [selectedDate]);

  useEffect(() => { fetchFailed(); }, [fetchFailed]);

  useEffect(() => {
    const channel = supabase
      .channel("failed-calls-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "comms_events" }, () => fetchFailed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFailed]);

  const handleRetry = async (call: FailedCall) => {
    const toNumber = call.to_number ?? (call.payload?.target_phone as string | undefined);
    if (!toNumber || !call.message_text) {
      toast.error("Missing phone or message — cannot retry");
      return;
    }
    setRetryingId(call.id);
    try {
      const { data: companyData } = await supabase.rpc("get_my_company_id");
      const { data: settings } = await supabase
        .from("company_settings")
        .select("verified_caller_id")
        .eq("company_id", companyData as string)
        .maybeSingle();
      const verifiedCallerId = (settings as any)?.verified_caller_id ?? null;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: inserted, error: insErr } = await supabase
        .from("comms_events" as any)
        .insert({
          company_id: companyData,
          trip_id: call.trip_id,
          truck_id: call.truck_id,
          event_type: call.call_type ? `call_${call.call_type}` : "call_retry",
          call_type: call.call_type,
          patient_name: call.patient_name,
          facility_name: call.facility_name,
          message_text: call.message_text,
          to_number: toNumber,
          queued_by: user?.id,
          queued_at: new Date().toISOString(),
          status: "queued",
          direction: "outbound",
          retry_of_event_id: call.id,
          payload: { ...(call.payload ?? {}), retry_of: call.id },
        } as any)
        .select("id")
        .single();
      if (insErr || !inserted) throw insErr ?? new Error("Insert failed");
      const newId = (inserted as any).id as string;

      const { data: callData, error: callErr } = await supabase.functions.invoke(
        "make-outbound-call",
        {
          body: {
            comms_event_id: newId,
            to_number: toNumber,
            script: call.message_text,
            from_number_override: verifiedCallerId,
          },
        },
      );
      if (callErr || (callData && callData.ok === false)) {
        const msg = callErr?.message ?? callData?.error ?? "Retry failed";
        await supabase
          .from("comms_events" as any)
          .update({ status: "failed", error_message: msg })
          .eq("id", newId);
        toast.error(`Retry failed: ${msg}`);
      } else {
        toast.success("Retry initiated");
        setDismissed(prev => new Set(prev).add(call.id));
      }
    } catch (err: any) {
      toast.error(`Retry error: ${err.message ?? "Unknown error"}`);
    } finally {
      setRetryingId(null);
      fetchFailed();
    }
  };

  const visible = calls.filter(c => !dismissed.has(c.id));
  if (visible.length === 0) return null;

  return (
    <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-destructive">
          Failed Calls Today · {visible.length}
        </h3>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {visible.map(call => {
          const name = call.patient_name ?? call.facility_name ?? "Unknown";
          const to = call.to_number ?? call.payload?.target_phone ?? "—";
          return (
            <div key={call.id} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
              <Phone className="h-3 w-3 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground"> · {to}</span>
                {call.error_message && (
                  <p className="text-[10px] text-destructive truncate">{call.error_message}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={retryingId === call.id}
                onClick={() => handleRetry(call)}
              >
                <RotateCcw className="h-3 w-3" />
                {retryingId === call.id ? "Retrying…" : "Retry"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setDismissed(prev => new Set(prev).add(call.id))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}