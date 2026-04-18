import { useState, useEffect, useCallback, useMemo } from "react";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CallConfirmationDrawer } from "./CallConfirmationDrawer";
import { CommsOutboxPanel } from "./CommsOutboxPanel";
import { PlaceCallDialog, type PlaceCallRun, type PlaceCallTruck } from "./PlaceCallDialog";

interface ActiveRun {
  slotId: string;
  tripId: string | null;
  patientName: string;
  patientId: string | null;
  truckName: string;
  truckId: string;
  pickupTime: string | null;
  status: string;
  destinationName: string | null;
  facilityId: string | null;
}

interface CommunicationsSectionProps {
  selectedDate: string;
  trucks: {
    id: string;
    name: string;
    runs: {
      id: string;
      patient_name: string;
      pickup_time: string | null;
      status: string;
      leg_id?: string | null;
      destination_name?: string | null;
    }[];
  }[];
}

export function CommunicationsSection({ selectedDate, trucks }: CommunicationsSectionProps) {
  const [facilities, setFacilities] = useState<Map<string, { id: string; name: string; phone: string | null }>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<{
    run: ActiveRun;
    callType: "patient" | "facility";
  } | null>(null);
  const [patientPhones, setPatientPhones] = useState<Map<string, string | null>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  const doneStatuses = useMemo(
    () => new Set(["completed", "ready_for_billing", "cancelled", "no_show"]),
    [],
  );

  // Build the truck → active runs structure for the picker
  const trucksForPicker: PlaceCallTruck[] = useMemo(() => {
    return trucks
      .map((t) => ({
        id: t.id,
        name: t.name,
        runs: t.runs
          .filter((r) => !doneStatuses.has(r.status))
          .map<PlaceCallRun>((r) => ({
            slotId: r.id,
            patientName: r.patient_name,
            pickupTime: r.pickup_time,
            status: r.status,
            destinationName: r.destination_name ?? null,
          })),
      }))
      .filter((t) => t.runs.length > 0);
  }, [trucks, doneStatuses]);

  const totalActive = useMemo(
    () => trucksForPicker.reduce((sum, t) => sum + t.runs.length, 0),
    [trucksForPicker],
  );

  // Fetch facilities once we have any active run
  useEffect(() => {
    if (totalActive === 0) return;
    (async () => {
      const { data } = await supabase
        .from("facilities")
        .select("id, name, phone")
        .eq("active", true);
      const map = new Map<string, { id: string; name: string; phone: string | null }>();
      (data ?? []).forEach((f) => {
        map.set(f.name.toLowerCase(), { id: f.id, name: f.name, phone: f.phone });
      });
      setFacilities(map);
    })();
  }, [totalActive]);

  const startCall = useCallback(async (
    truckId: string,
    truckName: string,
    pickRun: PlaceCallRun,
    callType: "patient" | "facility",
    facility: { id: string; name: string; phone: string | null } | null,
  ) => {
    let run: ActiveRun = {
      slotId: pickRun.slotId,
      tripId: null,
      patientName: pickRun.patientName,
      patientId: null,
      truckName,
      truckId,
      pickupTime: pickRun.pickupTime,
      status: pickRun.status,
      destinationName: pickRun.destinationName,
      facilityId: facility?.id ?? null,
    };

    // Patient phone lookup
    if (callType === "patient") {
      const { data: slotData } = await supabase
        .from("truck_run_slots")
        .select("leg_id, leg:scheduling_legs!truck_run_slots_leg_id_fkey(patient_id, patient:patients!scheduling_legs_patient_id_fkey(id, phone, first_name, last_name))")
        .eq("id", run.slotId)
        .eq("run_date", selectedDate)
        .maybeSingle();
      const patient: any = (slotData?.leg as any)?.patient;
      if (patient) {
        setPatientPhones((prev) => new Map(prev).set(patient.id, patient.phone ?? null));
        run = { ...run, patientId: patient.id };
      }
    }

    // Resolve trip_id for this slot
    const { data: slotTrip } = await supabase
      .from("truck_run_slots")
      .select("leg_id")
      .eq("id", run.slotId)
      .maybeSingle();
    let tripId: string | null = null;
    if (slotTrip?.leg_id) {
      const { data: legTrip } = await supabase
        .from("trip_records" as any)
        .select("id")
        .eq("leg_id", slotTrip.leg_id)
        .eq("run_date", selectedDate)
        .maybeSingle();
      tripId = (legTrip as any)?.id ?? null;
    }

    // Duplicate-call warning
    if (tripId) {
      const today = selectedDate;
      const { count } = await supabase
        .from("comms_events" as any)
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("call_type", callType)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      if ((count ?? 0) > 0) {
        const confirmed = window.confirm(
          `A ${callType} call was already queued for this run today. Queue another?`,
        );
        if (!confirmed) return;
      }
    }

    setSelectedCall({ run: { ...run, tripId }, callType });
    setDrawerOpen(true);
  }, [selectedDate]);

  const handleCallQueued = () => setRefreshKey((k) => k + 1);

  // Section is hidden entirely when no active runs
  if (totalActive === 0) return null;

  const facilityForSelected = (() => {
    if (!selectedCall?.run.destinationName) return null;
    return facilities.get(selectedCall.run.destinationName.toLowerCase()) ?? null;
  })();

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Phone className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Communications
        </h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
          {totalActive} active
        </Badge>
      </div>

      <div className="rounded-lg border bg-card p-3 space-y-3">
        <Button
          onClick={() => setPickerOpen(true)}
          className="w-full h-11 gap-2"
        >
          <PhoneCall className="h-4 w-4" />
          Place Call
        </Button>
        <p className="text-[11px] text-muted-foreground text-center -mt-1">
          Pick a truck, then a run, then who to call.
        </p>

        {/* Queued Calls Outbox */}
        <CommsOutboxPanel selectedDate={selectedDate} refreshKey={refreshKey} />
      </div>

      {/* Truck → Run → Type picker */}
      <PlaceCallDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        trucks={trucksForPicker}
        facilities={facilities}
        onPick={startCall}
      />

      {/* Existing call confirmation drawer */}
      {selectedCall && (
        <CallConfirmationDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          callType={selectedCall.callType}
          patientName={selectedCall.run.patientName}
          patientPhone={patientPhones.get(selectedCall.run.patientId ?? "") ?? null}
          patientId={selectedCall.run.patientId}
          facilityName={selectedCall.callType === "facility" ? facilityForSelected?.name ?? null : null}
          facilityPhone={selectedCall.callType === "facility" ? facilityForSelected?.phone ?? null : null}
          facilityId={selectedCall.run.facilityId}
          pickupTime={selectedCall.run.pickupTime}
          truckId={selectedCall.run.truckId}
          tripId={selectedCall.run.tripId}
          selectedDate={selectedDate}
          onCallQueued={handleCallQueued}
        />
      )}
    </section>
  );
}
