import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Truck, User, PhoneCall, Building2, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PlaceCallRun {
  slotId: string;
  patientName: string;
  pickupTime: string | null;
  status: string;
  destinationName: string | null;
}

export interface PlaceCallTruck {
  id: string;
  name: string;
  runs: PlaceCallRun[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trucks: PlaceCallTruck[];
  facilities: Map<string, { id: string; name: string; phone: string | null }>;
  onPick: (
    truckId: string,
    truckName: string,
    run: PlaceCallRun,
    callType: "patient" | "facility",
    facility: { id: string; name: string; phone: string | null } | null,
  ) => void;
}

type Step = "truck" | "run" | "type";

export function PlaceCallDialog({ open, onOpenChange, trucks, facilities, onPick }: Props) {
  const [step, setStep] = useState<Step>("truck");
  const [truckId, setTruckId] = useState<string | null>(null);
  const [run, setRun] = useState<PlaceCallRun | null>(null);
  const [patientPhoneByName, setPatientPhoneByName] = useState<Map<string, string | null>>(new Map());

  // Reset to first step whenever the dialog re-opens
  useEffect(() => {
    if (open) {
      setStep(trucks.length === 1 ? "run" : "truck");
      setTruckId(trucks.length === 1 ? trucks[0].id : null);
      setRun(null);
    }
  }, [open, trucks]);

  const selectedTruck = useMemo(
    () => trucks.find((t) => t.id === truckId) ?? null,
    [trucks, truckId],
  );

  // Look up patient phone for the chosen run so we can show the no-phone hint
  useEffect(() => {
    if (step !== "type" || !run) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("truck_run_slots")
        .select("leg:scheduling_legs!truck_run_slots_leg_id_fkey(patient:patients!scheduling_legs_patient_id_fkey(phone, first_name, last_name))")
        .eq("id", run.slotId)
        .maybeSingle();
      if (cancelled) return;
      const p: any = (data as any)?.leg?.patient;
      if (p) {
        setPatientPhoneByName((prev) => new Map(prev).set(`${p.first_name} ${p.last_name}`, p.phone ?? null));
      }
    })();
    return () => { cancelled = true; };
  }, [step, run]);

  const facilityForRun = (r: PlaceCallRun | null) => {
    if (!r?.destinationName) return null;
    return facilities.get(r.destinationName.toLowerCase()) ?? null;
  };

  const back = () => {
    if (step === "type") setStep("run");
    else if (step === "run" && trucks.length > 1) setStep("truck");
  };

  const handlePickType = (callType: "patient" | "facility") => {
    if (!run || !selectedTruck) return;
    onPick(selectedTruck.id, selectedTruck.name, run, callType, facilityForRun(run));
    onOpenChange(false);
  };

  const phoneKnown = run ? patientPhoneByName.get(run.patientName) : undefined;
  const noPhone = phoneKnown === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== "truck" && trucks.length > 1 && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={back}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "type" && trucks.length === 1 && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={back}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === "truck" && "Select truck"}
              {step === "run" && `Select run${selectedTruck ? ` — ${selectedTruck.name}` : ""}`}
              {step === "type" && `Call for ${run?.patientName ?? ""}`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === "truck" && "Choose which truck the call is about."}
            {step === "run" && "Pick the run on this truck."}
            {step === "type" && "Who would you like to call?"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Trucks */}
        {step === "truck" && (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {trucks.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active runs to call about.
              </p>
            )}
            {trucks.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTruckId(t.id); setStep("run"); }}
                className="w-full flex items-center gap-3 rounded-md border px-3 py-2.5 text-left hover:border-primary hover:bg-accent transition-colors"
              >
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.runs.length} active run{t.runs.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Runs */}
        {step === "run" && selectedTruck && (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {selectedTruck.runs.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active runs on this truck.
              </p>
            )}
            {selectedTruck.runs.map((r) => (
              <button
                key={r.slotId}
                onClick={() => { setRun(r); setStep("type"); }}
                className="w-full flex items-center gap-3 rounded-md border px-3 py-2.5 text-left hover:border-primary hover:bg-accent transition-colors"
              >
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{r.patientName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {r.pickupTime && <span>{r.pickupTime}</span>}
                    {r.pickupTime && <span>·</span>}
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Call type */}
        {step === "type" && run && (
          <div className="space-y-2">
            <button
              onClick={() => handlePickType("patient")}
              className="w-full flex items-center gap-3 rounded-md border px-3 py-3 text-left hover:border-primary hover:bg-accent transition-colors"
            >
              {noPhone ? (
                <PhoneOff className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <PhoneCall className="h-4 w-4 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Call Patient</div>
                <div className="text-xs text-muted-foreground">
                  {noPhone ? "No phone on file — call cannot be placed" : run.patientName}
                </div>
              </div>
            </button>

            {(() => {
              const f = facilityForRun(run);
              if (!f) {
                return (
                  <div className="flex items-center gap-3 rounded-md border border-dashed px-3 py-3 opacity-60">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-muted-foreground">Call Facility</div>
                      <div className="text-xs text-muted-foreground">
                        Destination not linked to a facility on file
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  onClick={() => handlePickType("facility")}
                  className="w-full flex items-center gap-3 rounded-md border px-3 py-3 text-left hover:border-primary hover:bg-accent transition-colors"
                >
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">Call Facility</div>
                    <div className="text-xs text-muted-foreground">{f.name}</div>
                  </div>
                </button>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
