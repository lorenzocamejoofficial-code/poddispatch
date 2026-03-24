import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePCRData } from "@/hooks/usePCRData";
import { usePCRSectionRules } from "@/hooks/usePCRSectionRules";
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
import { StretcherMobilityCard } from "@/components/pcr/StretcherMobilityCard";
import { IsolationPrecautionsCard } from "@/components/pcr/IsolationPrecautionsCard";
import { LockedSectionOverlay } from "@/components/pcr/LockedSectionOverlay";
import { PCR_CARDS_BY_TRANSPORT, getPCRTransportKey, type PCRCardType, type PCRCardConfig } from "@/lib/pcr-dropdowns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Check, Loader2, Send, AlertCircle, Lock, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CrewMember { id: string; name: string; cert: string; }

export default function PCRPage() {
  const { profileId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tripId = searchParams.get("tripId");
  const { trip, loading, saving, updateField, updateMultipleFields, recordTime, refetch } = usePCRData(tripId);

  // Resolve leg type from joined data or sessionStorage fallback
  const activeLegType = trip?.leg_type ?? sessionStorage.getItem("pcr_leg_type") ?? null;

  const [activeCard, setActiveCard] = useState<PCRCardType | null>(null);
  const [truckName, setTruckName] = useState("");
  const [crewMembers, setCrewMembers] = useState<{ m1: CrewMember | null; m2: CrewMember | null }>({ m1: null, m2: null });
  const [submitting, setSubmitting] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Central section rules driven by pcr_type
  const sectionRules = usePCRSectionRules(trip?.pcr_type || trip?.trip_type);

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
  const isReadOnly = trip.pcr_status === "completed";

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

  // Helper to get card rule — handles combined stretcher_mobility card
  const getEffectiveCardRule = (cardType: string) => {
    if (cardType === "stretcher_mobility") {
      const sp = sectionRules.getRule("stretcher_placement");
      const pm = sectionRules.getRule("patient_mobility");
      // If either is required, the combined card is required
      if (sp.state === "required" || pm.state === "required") return { state: "required" as const, lockedReason: "" };
      if (sp.state === "locked" && pm.state === "locked") return sp;
      return { state: "optional" as const, lockedReason: "" };
    }
    return sectionRules.getCardRule(cardType);
  };
  // Determine card completion status
  const isCardComplete = (card: PCRCardConfig): boolean => {
    switch (card.type) {
      case "times": return !!(trip.dispatch_time && trip.at_scene_time && trip.left_scene_time && trip.arrived_dropoff_at && trip.in_service_time);
      case "patient_info": return !!trip.patient;
      case "vitals": return (trip.vitals_json || []).length > 0 && !!(trip.vitals_json[0]?.bp_systolic);
      case "condition_on_arrival": return !!(trip.level_of_consciousness && trip.skin_condition);
      case "medical_necessity": return !!trip.medical_necessity_reason;
      case "equipment": {
        const eq = trip.equipment_used_json || {};
        return Object.values(eq).some((v: any) => !!v);
      }
      case "signatures": return (trip.signatures_json || []).length > 0;
      case "narrative": return !!trip.narrative;
      case "billing": return true;
      case "sending_facility": return !!(trip.sending_facility_json?.facility_name);
      case "assessment": case "chief_complaint": return !!(trip.chief_complaint || trip.primary_impression);
      case "physical_exam": return Object.keys(trip.physical_exam_json || {}).some((k: string) => (trip.physical_exam_json[k]?.findings || []).length > 0);
      case "hospital_outcome": return !!(trip.hospital_outcome_json?.chief_complaint || trip.disposition);
      case "stretcher_mobility": return !!(trip.stretcher_placement && trip.patient_mobility);
      case "isolation_precautions": {
        const iso = trip.isolation_precautions || {};
        return iso.required === true ? ((iso.types || []).length > 0) : (iso.required === false);
      }
      default: return false;
    }
  };

  const getCardColor = (card: PCRCardConfig): string => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") return "border-muted bg-muted/20 opacity-60";
    const complete = isCardComplete(card);
    if (complete) return "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10";
    if (rule.state === "required") return "border-destructive/50 bg-destructive/5";
    // Optional and incomplete → neutral
    return "border-border";
  };

  const getCardDot = (card: PCRCardConfig): string => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") return "bg-muted-foreground/20";
    const complete = isCardComplete(card);
    if (complete) return "bg-emerald-500";
    if (rule.state === "required") return "bg-destructive";
    return "bg-muted-foreground/30";
  };

  const getCardStateLabel = (card: PCRCardConfig): React.ReactNode => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") {
      return <Lock className="h-4 w-4 text-muted-foreground/40" />;
    }
    if (isCardComplete(card)) {
      return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (rule.state === "required") {
      return <span className="text-[10px] font-bold uppercase text-destructive">Required</span>;
    }
    return <span className="text-[10px] font-medium uppercase text-muted-foreground">Optional</span>;
  };

  // Render card content — locked cards show overlay instead
  const renderCard = (type: PCRCardType) => {
    const rule = getEffectiveCardRule(type);
    if (rule.state === "locked") {
      return <LockedSectionOverlay reason={rule.lockedReason} />;
    }
    switch (type) {
      case "times": return <TimesCard trip={trip} recordTime={recordTime} updateField={updateField} />;
      case "patient_info": return <PatientInfoCard trip={trip} updateField={updateField} />;
      case "vitals": return <VitalsCard trip={trip} updateField={updateField} />;
      case "condition_on_arrival": return <ConditionOnArrivalCard trip={trip} updateField={updateField} />;
      case "medical_necessity": return <MedicalNecessityCard trip={trip} updateField={updateField} />;
      case "equipment": return <EquipmentCard trip={trip} updateField={updateField} />;
      case "signatures": return <SignaturesCard trip={trip} updateField={updateField} legType={activeLegType} />;
      case "narrative": return <NarrativeCard trip={trip} truckName={truckName} updateField={updateField} />;
      case "billing": return <BillingCard trip={trip} />;
      case "sending_facility": return <SendingFacilityCard trip={trip} updateField={updateField} />;
      case "assessment": case "chief_complaint": return <AssessmentCard trip={trip} updateField={updateField} />;
      case "physical_exam": return <PhysicalExamCard trip={trip} updateField={updateField} />;
      case "hospital_outcome": return <HospitalOutcomeCard trip={trip} updateField={updateField} />;
      case "stretcher_mobility": return <StretcherMobilityCard trip={trip} updateField={updateField} />;
      case "isolation_precautions": return <IsolationPrecautionsCard trip={trip} updateField={updateField} />;
      default: return <p className="text-sm text-muted-foreground">Coming soon.</p>;
    }
  };

  const handleEmergencyUpgrade = async () => {
    setUpgrading(true);
    try {
      const note = `EMERGENCY UPGRADE — ${new Date().toISOString()}`;
      const existingNotes = trip.necessity_notes || "";
      await supabase.from("trip_records").update({
        pcr_type: "emergency",
        necessity_notes: existingNotes ? `${existingNotes}\n${note}` : note,
        updated_at: new Date().toISOString(),
      }).eq("id", trip.id);
      toast.success("PCR upgraded to Emergency");
      setShowUpgradeDialog(false);
      refetch();
    } catch {
      toast.error("Failed to upgrade PCR");
    }
    setUpgrading(false);
  };

  // Only require completion of sections marked "required" by rules
  const getMissingItems = (): string[] => {
    const missing: string[] = [];
    for (const card of cards) {
      const rule = getEffectiveCardRule(card.type);
      if (rule.state === "required" && !isCardComplete(card)) {
        missing.push(card.label);
      }
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
          {isReadOnly && (
            <div className="mb-3 rounded-lg border border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 p-2 text-center">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                <Eye className="h-3.5 w-3.5" /> View Only — Submitted PCR
              </p>
            </div>
          )}
          <h2 className="text-lg font-bold text-foreground mb-4">{cardConfig?.label}</h2>
          {saving && !isReadOnly && <p className="text-xs text-muted-foreground mb-2">Saving...</p>}
          <fieldset disabled={isReadOnly} className={isReadOnly ? "pointer-events-none opacity-80" : ""}>
            {renderCard(activeCard)}
          </fieldset>
        </div>
      </CrewLayout>
    );
  }

  // Card overview
  const patient = trip.patient;
  const requiredCards = cards.filter(c => getEffectiveCardRule(c.type).state === "required");
  const completedRequired = requiredCards.filter(c => isCardComplete(c)).length;
  const totalRequired = requiredCards.length;

  return (
    <CrewLayout>
      <div className="p-4 pb-24 min-h-screen">
        {/* Read-only submitted banner */}
        {isReadOnly && (
          <div className="mb-4 rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">PCR Submitted</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  {trip.pcr_completed_at ? new Date(trip.pcr_completed_at).toLocaleString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Attending: {trip.attending_medic_name} ({trip.attending_medic_cert})
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> View Only — Submitted PCR
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{truckName}</p>
          <h2 className="text-lg font-bold text-foreground">
            {patient ? `${patient.first_name} ${patient.last_name}` : "PCR"}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{sectionRules.type.replace(/_/g, " ")} Transport</p>
          {!isReadOnly && (
            <p className="text-xs text-muted-foreground mt-1">
              Attending: {trip.attending_medic_name} ({trip.attending_medic_cert})
            </p>
          )}
          {!isReadOnly && (
            <div className="mt-2 flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground shrink-0">{completedRequired}/{totalRequired}</span>
            </div>
          )}
        </div>

        {/* Emergency Upgrade — compact right-aligned button */}
        {!isReadOnly && sectionRules.type !== "emergency" && (
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => setShowUpgradeDialog(true)}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Emergency Upgrade
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {cards.map((card) => {
            const rule = getEffectiveCardRule(card.type);
            const isLockedCard = rule.state === "locked";

            return (
              <button
                key={card.type}
                onClick={() => !isLockedCard && setActiveCard(card.type)}
                disabled={isLockedCard}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left transition-all",
                  isLockedCard ? "cursor-not-allowed" : "active:scale-[0.98]",
                  getCardColor(card)
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("h-3 w-3 rounded-full shrink-0", getCardDot(card))} />
                  <span className={cn("flex-1 text-sm font-semibold", isLockedCard ? "text-muted-foreground/50" : "text-foreground")}>
                    {card.label}
                  </span>
                  {getCardStateLabel(card)}
                </div>
                {isLockedCard && (
                  <p className="text-[10px] text-muted-foreground/40 mt-1 ml-6">{rule.lockedReason}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Submit — only when not read-only */}
        {!isReadOnly && (
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
        )}

        {/* Emergency Upgrade Dialog */}
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Upgrade to Emergency
              </DialogTitle>
              <DialogDescription>
                This will upgrade the PCR to Emergency type, unlocking all clinical sections. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleEmergencyUpgrade} disabled={upgrading}>
                {upgrading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Upgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CrewLayout>
  );
}
