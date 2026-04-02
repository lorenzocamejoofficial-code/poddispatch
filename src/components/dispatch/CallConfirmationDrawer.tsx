import { useState, useEffect, useMemo } from "react";
import { Phone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyName } from "@/hooks/useCompanyName";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CallConfirmationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callType: "patient" | "facility";
  patientName: string;
  patientPhone: string | null;
  patientId: string | null;
  facilityName: string | null;
  facilityPhone: string | null;
  facilityId: string | null;
  pickupTime: string | null;
  truckId: string;
  tripId: string | null;
  selectedDate: string;
  onCallQueued: () => void;
}

function computeDefaultEta(pickupTime: string | null, holdTimerMinutes: number | null): string {
  const now = new Date();
  if (holdTimerMinutes !== null && holdTimerMinutes > 0) {
    const eta = new Date(now.getTime() + (holdTimerMinutes + 15) * 60000);
    return eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  if (pickupTime) {
    // Parse pickup time (HH:MM format) and add 20 minutes
    const [h, m] = pickupTime.split(":").map(Number);
    const today = new Date();
    today.setHours(h, m + 20, 0, 0);
    return today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  // Fallback: now + 30 min
  const fallback = new Date(now.getTime() + 30 * 60000);
  return fallback.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function CallConfirmationDrawer({
  open,
  onOpenChange,
  callType,
  patientName,
  patientPhone,
  patientId,
  facilityName,
  facilityPhone,
  facilityId,
  pickupTime,
  truckId,
  tripId,
  selectedDate,
  onCallQueued,
}: CallConfirmationDrawerProps) {
  const { companyName } = useCompanyName();
  const { userId } = useAuth();
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [holdMinutes, setHoldMinutes] = useState<number | null>(null);

  // Fetch hold timer duration if active on this trip
  useEffect(() => {
    if (!tripId) {
      setHoldMinutes(null);
      return;
    }
    supabase
      .from("hold_timers")
      .select("started_at")
      .eq("trip_id", tripId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.started_at) {
          const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 60000);
          setHoldMinutes(elapsed);
        } else {
          setHoldMinutes(null);
        }
      });
  }, [tripId, open]);

  // Set default ETA when drawer opens
  useEffect(() => {
    if (open) {
      setEta(computeDefaultEta(pickupTime, holdMinutes));
    }
  }, [open, pickupTime, holdMinutes]);

  const firstName = patientName.split(" ")[0];
  const companyPhone = "our office"; // Placeholder — would come from company_settings in production

  const message = useMemo(() => {
    if (callType === "patient") {
      return `Hello, this is a message for ${firstName}. This is ${companyName} calling. We are running a little behind on your scheduled pickup today at ${pickupTime ?? "your scheduled time"}. We expect to arrive at approximately ${eta}. We apologize for the inconvenience. If you have any questions please call us at ${companyPhone}.`;
    }
    return `Hello, this is a message for ${facilityName ?? "your facility"}. This is ${companyName} calling regarding your patient ${patientName}. We are running a little behind on their scheduled pickup today at ${pickupTime ?? "the scheduled time"}. We expect to arrive at approximately ${eta}. We apologize for any inconvenience. Please call us at ${companyPhone} if you have any questions.`;
  }, [callType, firstName, patientName, facilityName, companyName, pickupTime, eta, companyPhone]);

  const targetName = callType === "patient" ? patientName : (facilityName ?? "Unknown Facility");
  const targetPhone = callType === "patient" ? patientPhone : facilityPhone;
  const hasPhone = !!targetPhone;

  const handleConfirm = async () => {
    if (!hasPhone || !tripId) return;
    setSubmitting(true);

    try {
      // Get company_id
      const { data: companyData } = await supabase.rpc("get_my_company_id");
      const companyId = companyData as string;

      // PHASE 2 — Insert Twilio call here using comms_events record and assembled message

      const { error } = await supabase.from("comms_events" as any).insert({
        company_id: companyId,
        trip_id: tripId,
        truck_id: truckId,
        event_type: `call_${callType}`,
        call_type: callType,
        patient_name: patientName,
        facility_name: facilityName,
        message_text: message,
        eta_used: eta,
        queued_by: userId,
        queued_at: new Date().toISOString(),
        status: "queued",
        payload: {
          target_name: targetName,
          target_phone: targetPhone,
          message,
        },
      } as any);

      if (error) throw error;

      toast.success("Call queued — voicemail will be left if no answer.");
      onOpenChange(false);
      onCallQueued();
    } catch (err: any) {
      toast.error("Failed to queue call: " + (err.message ?? "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            {callType === "patient" ? "Call Patient" : "Call Facility"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto py-4">
          {/* Top: Who is being called */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
            <p className="text-sm font-medium text-foreground">{targetName}</p>
            {hasPhone ? (
              <p className="text-sm text-muted-foreground">{targetPhone}</p>
            ) : (
              <div className="flex items-start gap-2 mt-2 rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--status-yellow))] mt-0.5" />
                <p className="text-xs text-foreground">
                  No phone number on file for this {callType === "patient" ? "patient" : "facility"} — add one in the {callType === "patient" ? "patient record" : "facility record"} before sending a call.
                </p>
              </div>
            )}
          </div>

          {/* Middle: Message preview */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Estimated Arrival (ETA)</Label>
              <Input
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="mt-1"
                placeholder="e.g. 10:45 AM"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Message Preview</Label>
              <Textarea
                value={message}
                readOnly
                className="mt-1 min-h-[120px] text-sm bg-muted/30 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom: Confirm */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-[11px] text-muted-foreground text-center">
            If no answer, a voicemail will be left automatically.
          </p>
          <Button
            onClick={handleConfirm}
            disabled={!hasPhone || !tripId || submitting}
            className="w-full"
          >
            {submitting ? "Queuing…" : "Confirm and Queue Call"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
