import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Heart, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CrewDocPanelProps {
  legId: string;
  tripId: string;
  patientName: string;
  pickupLocation: string;
  destinationLocation: string;
  crewNames: string;
  existingMiles: number | null;
  existingSignature: boolean;
  existingPcs: boolean;
  token: string;
  edgeFunctionUrl: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const MOBILITY_OPTIONS = [
  { value: "draw_sheet", label: "Draw Sheet" },
  { value: "manual_lift", label: "Manual Lift" },
  { value: "wheelchair_assist", label: "Wheelchair Assist" },
  { value: "self_ambulate", label: "Self Ambulate" },
];

export function CrewDocumentationPanel({
  legId, tripId, patientName, pickupLocation, destinationLocation,
  crewNames, existingMiles, existingSignature, existingPcs,
  token, edgeFunctionUrl, onClose, onSubmitted,
}: CrewDocPanelProps) {
  const now = new Date();
  const timeDefault = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const [loadedMiles, setLoadedMiles] = useState(existingMiles?.toString() ?? "");
  const [pickupTime, setPickupTime] = useState(timeDefault);
  const [dropoffTime, setDropoffTime] = useState(timeDefault);

  // Vitals
  const [bloodPressure, setBloodPressure] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [oxygenSat, setOxygenSat] = useState("");
  const [respRate, setRespRate] = useState("");

  // Transport condition
  const [stretcherRequired, setStretcherRequired] = useState(false);
  const [bedConfined, setBedConfined] = useState(false);
  const [generalWeakness, setGeneralWeakness] = useState(false);
  const [esrdDialysis, setEsrdDialysis] = useState(false);
  const [oxygenUsed, setOxygenUsed] = useState(false);
  const [fallRisk, setFallRisk] = useState(false);

  // Mobility
  const [mobilityMethod, setMobilityMethod] = useState("");

  // Necessity
  const [necessityNote, setNecessityNote] = useState("");

  // PCS + Signature
  const [pcsOnFile, setPcsOnFile] = useState(existingPcs);
  const [signatureObtained, setSignatureObtained] = useState(existingSignature);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const miles = parseFloat(loadedMiles);
    if (!loadedMiles || isNaN(miles)) {
      toast.error("Please enter loaded miles");
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const loadedAt = `${today}T${pickupTime}:00`;
      const droppedAt = `${today}T${dropoffTime}:00`;

      const res = await fetch(
        `${edgeFunctionUrl}?token=${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit_documentation",
            trip_id: tripId,
            loaded_miles: miles,
            loaded_at: loadedAt,
            dropped_at: droppedAt,
            blood_pressure: bloodPressure || null,
            heart_rate: heartRate ? parseInt(heartRate) : null,
            oxygen_saturation: oxygenSat ? parseInt(oxygenSat) : null,
            respiration_rate: respRate ? parseInt(respRate) : null,
            stretcher_required: stretcherRequired,
            bed_confined: bedConfined,
            general_weakness: generalWeakness,
            esrd_dialysis: esrdDialysis,
            oxygen_during_transport: oxygenUsed,
            fall_risk: fallRisk,
            mobility_method: mobilityMethod || null,
            necessity_notes: necessityNote || null,
            pcs_attached: pcsOnFile,
            signature_obtained: signatureObtained,
            crew_names: crewNames,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to submit documentation");
      } else {
        toast.success("Documentation submitted — trip ready for billing!");
        onSubmitted();
      }
    } catch {
      toast.error("Network error. Your data is saved locally — try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <button onClick={onClose} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to runs
      </button>

      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">Complete Run Documentation</h2>
        <p className="text-sm text-muted-foreground">{patientName}</p>
      </div>

      <div className="space-y-5">
        {/* Transport Basics */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Transport</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Miles</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={loadedMiles}
                onChange={(e) => setLoadedMiles(e.target.value)}
                className="h-10 text-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Pickup</label>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="h-10 text-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Dropoff</label>
              <Input
                type="time"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
                className="h-10 text-base"
              />
            </div>
          </div>
        </section>

        {/* Vitals */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" /> Vitals
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Blood Pressure</label>
              <Input
                placeholder="120/80"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                className="h-10 text-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Heart Rate</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="72"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="h-10 text-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">O₂ Sat %</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="98"
                value={oxygenSat}
                onChange={(e) => setOxygenSat(e.target.value)}
                className="h-10 text-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Resp Rate</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="16"
                value={respRate}
                onChange={(e) => setRespRate(e.target.value)}
                className="h-10 text-base"
              />
            </div>
          </div>
        </section>

        {/* Transport Condition */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Transport Condition</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Stretcher Required", checked: stretcherRequired, set: setStretcherRequired },
              { label: "Bed Confined", checked: bedConfined, set: setBedConfined },
              { label: "General Weakness", checked: generalWeakness, set: setGeneralWeakness },
              { label: "ESRD / Dialysis", checked: esrdDialysis, set: setEsrdDialysis },
              { label: "Oxygen Used", checked: oxygenUsed, set: setOxygenUsed },
              { label: "Fall Risk", checked: fallRisk, set: setFallRisk },
            ].map((item) => (
              <label key={item.label} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(c) => item.set(!!c)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </section>

        {/* Mobility */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Mobility Method</h3>
          <Select value={mobilityMethod} onValueChange={setMobilityMethod}>
            <SelectTrigger className="h-10 text-base">
              <SelectValue placeholder="Select method..." />
            </SelectTrigger>
            <SelectContent>
              {MOBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Medical Necessity */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Medical Necessity</h3>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={2}
            placeholder="Patient requires stretcher transport due to..."
            value={necessityNote}
            onChange={(e) => setNecessityNote(e.target.value)}
          />
        </section>

        {/* PCS + Signature */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Documentation</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <Checkbox checked={pcsOnFile} onCheckedChange={(c) => setPcsOnFile(!!c)} />
              PCS on file
            </label>
            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <Checkbox checked={signatureObtained} onCheckedChange={(c) => setSignatureObtained(!!c)} />
              Patient / facility signature obtained
            </label>
          </div>
        </section>

        {/* Crew */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Crew</h3>
          <p className="text-sm text-foreground">{crewNames || "Not assigned"}</p>
        </section>

        {/* Submit */}
        <Button
          className="w-full h-14 text-base font-bold"
          disabled={submitting || !loadedMiles}
          onClick={handleSubmit}
        >
          {submitting ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Submitting...</>
          ) : (
            <><Send className="h-5 w-5 mr-2" /> Submit Run Documentation</>
          )}
        </Button>
      </div>
    </div>
  );
}
