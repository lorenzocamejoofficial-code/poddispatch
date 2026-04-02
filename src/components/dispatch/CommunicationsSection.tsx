import { useState, useEffect, useCallback } from "react";
import { Phone, PhoneCall, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CallConfirmationDrawer } from "./CallConfirmationDrawer";
import { CommsOutboxPanel } from "./CommsOutboxPanel";

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
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [facilities, setFacilities] = useState<Map<string, { id: string; name: string; phone: string | null }>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<{
    run: ActiveRun;
    callType: "patient" | "facility";
  } | null>(null);
  const [patientPhones, setPatientPhones] = useState<Map<string, string | null>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  // Build active runs from truck data
  useEffect(() => {
    const runs: ActiveRun[] = [];
    const doneStatuses = ["completed", "ready_for_billing", "cancelled", "no_show"];

    trucks.forEach((truck) => {
      truck.runs.forEach((run) => {
        if (!doneStatuses.includes(run.status)) {
          runs.push({
            slotId: run.id,
            tripId: null, // We'll look up trip IDs when needed
            patientName: run.patient_name,
            patientId: null,
            truckName: truck.name,
            truckId: truck.id,
            pickupTime: run.pickup_time,
            status: run.status,
            destinationName: run.destination_name ?? null,
            facilityId: null,
          });
        }
      });
    });

    setActiveRuns(runs);
  }, [trucks]);

  // Fetch facilities and patient data for active runs
  useEffect(() => {
    if (activeRuns.length === 0) return;

    const fetchFacilities = async () => {
      const { data } = await supabase
        .from("facilities")
        .select("id, name, phone")
        .eq("active", true);

      const facilityMap = new Map<string, { id: string; name: string; phone: string | null }>();
      (data ?? []).forEach((f) => {
        facilityMap.set(f.name.toLowerCase(), { id: f.id, name: f.name, phone: f.phone });
      });
      setFacilities(facilityMap);
    };

    fetchFacilities();
  }, [activeRuns.length]);

  // Look up facility match for a run's destination
  const getFacilityForRun = useCallback((run: ActiveRun) => {
    if (!run.destinationName) return null;
    return facilities.get(run.destinationName.toLowerCase()) ?? null;
  }, [facilities]);

  const handleCallClick = async (run: ActiveRun, callType: "patient" | "facility") => {
    // Fetch patient phone if calling patient and we don't have it cached
    if (callType === "patient") {
      // Look up patient_id and phone from scheduling_legs → patients via slot
      const { data: slotData } = await supabase
        .from("truck_run_slots")
        .select("leg_id, leg:scheduling_legs!truck_run_slots_leg_id_fkey(patient_id, patient:patients!scheduling_legs_patient_id_fkey(id, phone, first_name, last_name))")
        .eq("id", run.slotId)
        .eq("run_date", selectedDate)
        .maybeSingle();

      const patient = (slotData?.leg as any)?.patient;
      if (patient) {
        setPatientPhones((prev) => new Map(prev).set(patient.id, patient.phone ?? null));
        run = { ...run, patientId: patient.id };
      }
    }

    // Also look up trip_id for the slot
    const { data: tripData } = await supabase
      .from("trip_records" as any)
      .select("id")
      .eq("run_date", selectedDate)
      .eq("truck_id", run.truckId)
      .limit(10);

    const matchingTrip = ((tripData ?? []) as any[]).find((t: any) => true); // first trip for this truck
    // Try to get a more specific match via slot lookup
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

    setSelectedCall({
      run: { ...run, tripId, patientId: run.patientId ?? (selectedCall?.run?.patientId ?? null) },
      callType,
    });
    setDrawerOpen(true);
  };

  const handleCallQueued = () => {
    setRefreshKey((k) => k + 1);
  };

  // Auto-collapse when no active runs
  if (activeRuns.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Phone className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Communications
        </h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
          {activeRuns.length} active
        </Badge>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-card p-3">
        {activeRuns.map((run) => {
          const facility = getFacilityForRun(run);
          return (
            <div
              key={run.slotId}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm bg-background"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-card-foreground">{run.patientName}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{run.truckName}</span>
                {run.pickupTime && (
                  <>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{run.pickupTime}</span>
                  </>
                )}
                <span className="mx-1.5 text-muted-foreground">·</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {run.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={() => handleCallClick(run, "patient")}
                >
                  <PhoneCall className="h-3 w-3" />
                  Call Patient
                </Button>
                {facility && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={() =>
                      handleCallClick(
                        { ...run, facilityId: facility.id },
                        "facility"
                      )
                    }
                  >
                    <Building2 className="h-3 w-3" />
                    Call Facility
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Queued Calls Outbox */}
        <CommsOutboxPanel selectedDate={selectedDate} refreshKey={refreshKey} />
      </div>

      {/* Call Confirmation Drawer */}
      {selectedCall && (
        <CallConfirmationDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          callType={selectedCall.callType}
          patientName={selectedCall.run.patientName}
          patientPhone={patientPhones.get(selectedCall.run.patientId ?? "") ?? null}
          patientId={selectedCall.run.patientId}
          facilityName={
            selectedCall.callType === "facility"
              ? getFacilityForRun(selectedCall.run)?.name ?? null
              : null
          }
          facilityPhone={
            selectedCall.callType === "facility"
              ? getFacilityForRun(selectedCall.run)?.phone ?? null
              : null
          }
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
