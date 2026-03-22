import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePCRData } from "@/hooks/usePCRData";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { MedicSelector } from "@/components/pcr/MedicSelector";
import { TimesCard } from "@/components/pcr/TimesCard";
import { PatientInfoCard } from "@/components/pcr/PatientInfoCard";
import { VitalsCard } from "@/components/pcr/VitalsCard";
import { ConditionOnArrivalCard } from "@/components/pcr/ConditionCard";
import { MedicalNecessityCard } from "@/components/pcr/MedicalNecessityCard";
import { EquipmentCard } from "@/components/pcr/EquipmentCard";
import { AssessmentCard, PhysicalExamCard } from "@/components/pcr/AssessmentCards";
import { SendingFacilityCard, HospitalOutcomeCard } from "@/components/pcr/FacilityCards";
import { SignaturesCard } from "@/components/pcr/SignaturesCard";
import { NarrativeCard } from "@/components/pcr/NarrativeCard";
import { BillingCard } from "@/components/pcr/BillingCard";
import { PCR_CARDS_BY_TRANSPORT, getPCRTransportKey, type PCRCardType, type PCRCardConfig } from "@/lib/pcr-dropdowns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, Loader2, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CrewMember { id: string; name: string; cert: string; }

export default function PCRPage() {
  const { profileId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tripId = searchParams.get("tripId");
  const { trip, loading, saving, updateField, updateMultipleFields, recordTime, refetch } = usePCRData(tripId);

  const [activeCard, setActiveCard] = useState<PCRCardType | null>(null);
  const [truckName, setTruckName] = useState("");
  const [crewMembers, setCrewMembers] = useState<{ m1: CrewMember | null; m2: CrewMember | null }>({ m1: null, m2: null });
  const [submitting, setSubmitting] = useState(false);

  // Fetch crew info for medic selection
  useEffect(() => {
    if (!trip?.crew_id) return;
    (async () => {
      const { data: crew } = await supabase
        .from("crews")
        .select("truck_id, member1_id, member2_id, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name, cert_level), member2:profiles!crews_member2_id_fkey(id, full_name, cert_level)")
        .eq("id", trip.crew_id)
        .maybeSingle();
      if (crew) {
        setTruckName((crew.truck as any)?.name || "");
        const m1 = crew.member1 as any;
        const m2 = crew.member2 as any;
        setCrewMembers({
          m1: m1 ? { id: m1.id, name: m1.full_name, cert: m1.cert_level } : null,
          m2: m2 ? { id: m2.id, name: m2.full_name, cert: m2.cert_level } : null,
        });
      }
    })();
  }, [trip?.crew_id]);

  if (loading) {
    return <CrewLayout><div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></CrewLayout>;
  }

  if (!trip) {
    return (
      <CrewLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
          <p className="text-muted-foreground">No trip selected. Go to your dashboard and tap Open PCR.</p>
          <Button className="mt-4" onClick={() => navigate("/crew-dashboard")}>Back to Dashboard</Button>
        </div>
      </CrewLayout>
    );
  }

  // Medic selection prompt
  if (!trip.attending_medic_id) {
    const handleMedicSelect = async (medic: CrewMember) => {
      await updateMultipleFields({
        attending_medic_id: medic.id,
        attending_medic_name: medic.name,
        attending_medic_cert: medic.cert,
        pcr_status: "in_progress",
      });
    };
    return (
      <CrewLayout>
        <MedicSelector crewMember1={crewMembers.m1} crewMember2={crewMembers.m2} onSelect={handleMedicSelect} />
      </CrewLayout>
    );
  }

  const transportKey = getPCRTransportKey(trip.trip_type || trip.pcr_type);
  const cards = PCR_CARDS_BY_TRANSPORT[transportKey] || PCR_CARDS_BY_TRANSPORT.dialysis;

  // Determine card completion status
  const isCardComplete = (card: PCRCardConfig): boolean => {
    switch (card.type) {
      case "times": return !!(trip.dispatch_time && trip.at_scene_time && trip.left_scene_time && trip.arrived_dropoff_at && trip.in_service_time);
      case "patient_info": return !!trip.patient;
      case "vitals": return (trip.vitals_json || []).length > 0 && !!(trip.vitals_json[0]?.bp_systolic);
      case "condition_on_arrival": return !!(trip.level_of_consciousness && trip.skin_condition);
      case "medical_necessity": return !!trip.medical_necessity_reason;
      case "equipment": return Object.keys(trip.equipment_used_json || {}).length > 0;
      case "signatures": return (trip.signatures_json || []).length > 0;
      case "narrative": return !!trip.narrative;
      case "billing": return true; // always auto-calculated
      case "sending_facility": return !!(trip.sending_facility_json?.facility_name);
      case "assessment": return !!(trip.chief_complaint || trip.primary_impression);
      case "physical_exam": return Object.keys(trip.physical_exam_json || {}).some((k: string) => (trip.physical_exam_json[k]?.findings || []).length > 0);
      case "hospital_outcome": return !!(trip.hospital_outcome_json?.chief_complaint || trip.disposition);
      default: return false;
    }
  };

  const getCardColor = (card: PCRCardConfig): string => {
    const complete = isCardComplete(card);
    if (complete) return "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10";
    if (card.required) return "border-destructive/50 bg-destructive/5";
    return "border-muted";
  };

  const getCardDot = (card: PCRCardConfig): string => {
    const complete = isCardComplete(card);
    if (complete) return "bg-emerald-500";
    if (card.required) return "bg-destructive";
    return "bg-muted-foreground/30";
  };

  // Render card content
  const renderCard = (type: PCRCardType) => {
    switch (type) {
      case "times": return <TimesCard trip={trip} recordTime={recordTime} updateField={updateField} />;
      case "patient_info": return <PatientInfoCard trip={trip} updateField={updateField} />;
      case "vitals": return <VitalsCard trip={trip} updateField={updateField} />;
      case "condition_on_arrival": return <ConditionOnArrivalCard trip={trip} updateField={updateField} />;
      case "medical_necessity": return <MedicalNecessityCard trip={trip} updateField={updateField} />;
      case "equipment": return <EquipmentCard trip={trip} updateField={updateField} />;
      case "signatures": return <SignaturesCard trip={trip} updateField={updateField} />;
      case "narrative": return <NarrativeCard trip={trip} truckName={truckName} updateField={updateField} />;
      case "billing": return <BillingCard trip={trip} />;
      case "sending_facility": return <SendingFacilityCard trip={trip} updateField={updateField} />;
      case "assessment": case "chief_complaint": return <AssessmentCard trip={trip} updateField={updateField} />;
      case "physical_exam": return <PhysicalExamCard trip={trip} updateField={updateField} />;
      case "hospital_outcome": return <HospitalOutcomeCard trip={trip} updateField={updateField} />;
      default: return <p className="text-sm text-muted-foreground">Coming soon.</p>;
    }
  };

  // Check what's missing for submission
  const getMissingItems = (): string[] => {
    const missing: string[] = [];
    for (const card of cards) {
      if (card.required && !isCardComplete(card)) missing.push(card.label);
    }
    return missing;
  };

  const handleSubmit = async () => {
    const missing = getMissingItems();
    if (missing.length > 0) {
      toast.error(`Complete these sections first: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("trip_records").update({
        pcr_status: "completed",
        pcr_completed_at: new Date().toISOString(),
        pcr_submitted_by: profileId,
        status: "ready_for_billing",
        claim_ready: true,
        documentation_complete: true,
        updated_at: new Date().toISOString(),
      }).eq("id", trip.id);

      // Auto-create QA review
      if (trip.company_id) {
        await supabase.from("qa_reviews").insert({
          company_id: trip.company_id,
          trip_id: trip.id,
          flag_reason: "PCR auto-submitted — pending QA review",
          status: "pending",
        });
      }

      toast.success("PCR submitted — trip is ready for billing!");
      navigate("/crew-dashboard");
    } catch (err: any) {
      toast.error("Failed to submit PCR");
    }
    setSubmitting(false);
  };

  // If a card is open, show its content
  if (activeCard) {
    const cardConfig = cards.find(c => c.type === activeCard);
    return (
      <CrewLayout>
        <div className="p-4 pb-24 min-h-screen">
          <button onClick={() => setActiveCard(null)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back to PCR
          </button>
          <h2 className="text-lg font-bold text-foreground mb-4">{cardConfig?.label}</h2>
          {saving && <p className="text-xs text-muted-foreground mb-2">Saving...</p>}
          {renderCard(activeCard)}
        </div>
      </CrewLayout>
    );
  }

  // Card overview
  const patient = trip.patient;
  const completedRequired = cards.filter(c => c.required && isCardComplete(c)).length;
  const totalRequired = cards.filter(c => c.required).length;

  return (
    <CrewLayout>
      <div className="p-4 pb-24 min-h-screen">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{truckName}</p>
          <h2 className="text-lg font-bold text-foreground">
            {patient ? `${patient.first_name} ${patient.last_name}` : "PCR"}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{transportKey.replace("_", " ")} Transport</p>
          <p className="text-xs text-muted-foreground mt-1">
            Attending: {trip.attending_medic_name} ({trip.attending_medic_cert})
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{completedRequired}/{totalRequired}</span>
          </div>
        </div>

        <div className="space-y-2">
          {cards.map((card) => (
            <button
              key={card.type}
              onClick={() => setActiveCard(card.type)}
              className={cn(
                "w-full rounded-lg border-2 p-4 text-left transition-all active:scale-[0.98]",
                getCardColor(card)
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("h-3 w-3 rounded-full shrink-0", getCardDot(card))} />
                <span className="flex-1 text-sm font-semibold text-foreground">{card.label}</span>
                {isCardComplete(card) && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                {card.required && !isCardComplete(card) && (
                  <span className="text-[10px] font-bold uppercase text-destructive">Required</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-6">
          {getMissingItems().length > 0 && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-destructive">Missing sections:</p>
                  <p className="text-xs text-destructive/80">{getMissingItems().join(", ")}</p>
                </div>
              </div>
            </div>
          )}
          <Button
            className="w-full h-14 text-base font-bold"
            disabled={submitting || getMissingItems().length > 0}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
            Submit PCR
          </Button>
        </div>
      </div>
    </CrewLayout>
  );
}
