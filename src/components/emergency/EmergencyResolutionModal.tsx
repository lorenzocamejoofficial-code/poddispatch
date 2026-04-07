import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Ambulance, HeartPulse, ShieldX, AlertTriangle } from "lucide-react";

interface EmergencyResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUndo: boolean;
  loading: boolean;
  onResolve: (type: string, details: Record<string, any>) => Promise<string | null>;
}

type ResolutionType = "transfer_of_care" | "patient_stabilized" | "no_emergency" | "accidental_after_window";

export function EmergencyResolutionModal({
  open, onOpenChange, canUndo, loading, onResolve,
}: EmergencyResolutionModalProps) {
  const [selected, setSelected] = useState<ResolutionType | null>(null);
  const [form, setForm] = useState({
    receiving_unit: "",
    transfer_time: new Date().toISOString().slice(0, 16),
    condition_at_transfer: "",
    stabilized_time: new Date().toISOString().slice(0, 16),
    intervention_description: "",
    assessment_time: new Date().toISOString().slice(0, 16),
    clinical_finding: "",
    no_emergency_explanation: "",
  });

  const isValid = () => {
    if (!selected) return false;
    switch (selected) {
      case "transfer_of_care":
        return form.receiving_unit.trim().length > 0 && form.condition_at_transfer.length > 0;
      case "patient_stabilized":
        return form.intervention_description.trim().length > 0;
      case "no_emergency":
      case "accidental_after_window":
        return form.clinical_finding.trim().length > 0 && form.no_emergency_explanation.trim().length > 0;
    }
  };

  const handleSubmit = async () => {
    if (!selected || !isValid()) return;
    const details: Record<string, any> = {};
    switch (selected) {
      case "transfer_of_care":
        details.receiving_unit = form.receiving_unit;
        details.transfer_time = form.transfer_time;
        details.condition_at_transfer = form.condition_at_transfer;
        break;
      case "patient_stabilized":
        details.stabilized_time = form.stabilized_time;
        details.intervention_description = form.intervention_description;
        break;
      case "no_emergency":
      case "accidental_after_window":
        details.assessment_time = form.assessment_time;
        details.clinical_finding = form.clinical_finding;
        details.no_emergency_explanation = form.no_emergency_explanation;
        break;
    }
    await onResolve(selected, details);
    onOpenChange(false);
  };

  const cards: { type: ResolutionType; icon: React.ReactNode; title: string; desc: string; visible: boolean }[] = [
    {
      type: "transfer_of_care",
      icon: <Ambulance className="h-6 w-6" />,
      title: "Transfer of Care to ALS or Higher Provider",
      desc: "Patient was handed off to a higher-level provider",
      visible: true,
    },
    {
      type: "patient_stabilized",
      icon: <HeartPulse className="h-6 w-6" />,
      title: "Patient Stabilized — Continued Non-Emergency Transport",
      desc: "Emergency resolved, patient stabilized and transport continued",
      visible: true,
    },
    {
      type: "no_emergency",
      icon: <ShieldX className="h-6 w-6" />,
      title: "No Emergency Confirmed — Downgrade to Non-Emergency",
      desc: "Assessment determined no emergency existed",
      visible: true,
    },
    {
      type: "accidental_after_window",
      icon: <AlertTriangle className="h-6 w-6" />,
      title: "Accidental Trigger (after undo window)",
      desc: "The undo window has passed. Please document that no emergency occurred for compliance.",
      visible: !canUndo,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How was this emergency resolved?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {cards.filter(c => c.visible).map(card => (
            <button
              key={card.type}
              onClick={() => setSelected(card.type)}
              className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                selected === card.type
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`shrink-0 ${selected === card.type ? "text-primary" : "text-muted-foreground"}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail fields */}
        {selected === "transfer_of_care" && (
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Receiving unit or service name *</Label>
              <Input value={form.receiving_unit} onChange={e => setForm(f => ({ ...f, receiving_unit: e.target.value }))} placeholder="e.g. AMR Unit 14" />
            </div>
            <div>
              <Label className="text-xs">Time of transfer</Label>
              <Input type="datetime-local" value={form.transfer_time} onChange={e => setForm(f => ({ ...f, transfer_time: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Patient condition at transfer *</Label>
              <Select value={form.condition_at_transfer} onValueChange={v => setForm(f => ({ ...f, condition_at_transfer: v }))}>
                <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stable">Stable</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="Deceased">Deceased</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {selected === "patient_stabilized" && (
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Time patient stabilized</Label>
              <Input type="datetime-local" value={form.stabilized_time} onChange={e => setForm(f => ({ ...f, stabilized_time: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Description of intervention and response *</Label>
              <Textarea value={form.intervention_description} onChange={e => setForm(f => ({ ...f, intervention_description: e.target.value }))} placeholder="Describe what was done and how the patient responded" rows={3} />
            </div>
          </div>
        )}

        {(selected === "no_emergency" || selected === "accidental_after_window") && (
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Time of assessment</Label>
              <Input type="datetime-local" value={form.assessment_time} onChange={e => setForm(f => ({ ...f, assessment_time: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Clinical finding *</Label>
              <Textarea value={form.clinical_finding} onChange={e => setForm(f => ({ ...f, clinical_finding: e.target.value }))} placeholder="Document clinical assessment findings" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Explanation of why no emergency existed *</Label>
              <Textarea value={form.no_emergency_explanation} onChange={e => setForm(f => ({ ...f, no_emergency_explanation: e.target.value }))} placeholder="Explain circumstances" rows={2} />
            </div>
          </div>
        )}

        {selected && (
          <div className="pt-2">
            <Button
              className="w-full"
              disabled={!isValid() || loading}
              onClick={handleSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Resolution
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
