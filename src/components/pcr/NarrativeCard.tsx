import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import { generateNarrative } from "@/lib/pcr-narrative";

interface Props {
  trip: any;
  truckName: string;
  updateField: (f: string, v: any) => Promise<void>;
}

export function NarrativeCard({ trip, truckName, updateField }: Props) {
  const patient = trip.patient;
  const age = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const regenerate = () => {
    const text = generateNarrative({
      truckName,
      transportType: trip.trip_type || trip.pcr_type || "dialysis",
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
      patientAge: age,
      patientSex: patient?.sex || "",
      pickupAddress: trip.pickup_location || "",
      destination: trip.destination_location || "",
      dispatchTime: trip.dispatch_time,
      atSceneTime: trip.at_scene_time,
      patientContactTime: trip.patient_contact_time,
      leftSceneTime: trip.left_scene_time,
      atDestinationTime: trip.arrived_dropoff_at,
      inServiceTime: trip.in_service_time,
      chiefComplaint: trip.chief_complaint,
      primaryImpression: trip.primary_impression,
      medicalNecessityReason: trip.medical_necessity_reason,
      levelOfConsciousness: trip.level_of_consciousness,
      skinCondition: trip.skin_condition,
      vitals: trip.vitals_json || [],
      physicalExam: trip.physical_exam_json || {},
      equipment: trip.equipment_used_json || {},
      conditionOnArrival: trip.condition_on_arrival || {},
      transportCondition: trip.transport_condition,
      disposition: trip.disposition,
      sendingFacility: trip.sending_facility_json || {},
      hospitalOutcome: trip.hospital_outcome_json || {},
      attendingMedicName: trip.attending_medic_name,
    });
    updateField("narrative", text);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Auto-generated from your PCR entries. You can edit below.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={regenerate}>
          <RefreshCw className="h-3.5 w-3.5" /> Generate
        </Button>
      </div>
      <Textarea
        value={trip.narrative || ""}
        onChange={(e) => updateField("narrative", e.target.value)}
        rows={12}
        className="text-sm leading-relaxed"
        placeholder="Click Generate to auto-create narrative from your PCR data, or type your own."
      />
    </div>
  );
}
