import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit-logger";
import { toast } from "sonner";

const CONTACT_END_REASONS = [
  "Patient Refused Transport",
  "Patient Condition Changed No Longer Requires Transport",
  "Patient Transported by Other Means",
  "Patient Not at Location on Arrival",
  "Other",
];

const NO_CONTACT_REASONS = [
  "Dispatch Cancelled Before Arrival",
  "Facility Cancelled Before Arrival",
  "Patient Left Before Arrival",
  "Duplicate Run Cancelled",
  "Other",
];

const ORIENTATION_OPTIONS = [
  { value: "aox4", label: "Alert and Oriented x4" },
  { value: "aox3", label: "Alert and Oriented x3" },
  { value: "aox2", label: "Alert and Oriented x2" },
  { value: "aox1", label: "Alert and Oriented x1" },
  { value: "altered", label: "Altered Mental Status" },
];

const DEFAULT_RISKS_TEXT = "Patient was informed that refusing medical transport may result in deterioration of their medical condition, delayed treatment, permanent disability, or death";

/* ─── Signature Pad ─── */
function SignaturePad({ onComplete }: { onComplete: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const hasMoved = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    setDrawing(true);
    hasMoved.current = false;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    lastPos.current = pos;
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    hasMoved.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    lastPos.current = pos;
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const endDraw = () => {
    if (drawing && !hasMoved.current && lastPos.current) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.arc(lastPos.current.x, lastPos.current.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "hsl(var(--foreground))";
        ctx.fill();
      }
    }
    setDrawing(false);
    if (canvasRef.current) onComplete(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onComplete("");
  };

  return (
    <div className="space-y-1">
      <canvas
        ref={canvasRef}
        width={300} height={100}
        className="w-full border rounded-md bg-background touch-none"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <Button variant="outline" size="sm" onClick={clear} className="text-xs" type="button">Clear</Button>
    </div>
  );
}

interface CancellationDocFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  patientName: string;
  cancelledAt: string | null;
  crewMemberName: string;
  crewMemberCert: string;
  onComplete: () => void;
}

export function CancellationDocForm({
  open, onOpenChange, tripId, patientName, cancelledAt,
  crewMemberName, crewMemberCert, onComplete,
}: CancellationDocFormProps) {
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Patient contact
  const [patientContact, setPatientContact] = useState<boolean | null>(null);

  // Contact made fields
  const [contactEndReason, setContactEndReason] = useState("");
  const [contactNotes, setContactNotes] = useState("");

  // No contact fields
  const [noContactReason, setNoContactReason] = useState("");
  const [noContactNotes, setNoContactNotes] = useState("");

  // Patient refusal fields
  const [informedOfRisks, setInformedOfRisks] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [risksText, setRisksText] = useState(DEFAULT_RISKS_TEXT);
  const [refusalReason, setRefusalReason] = useState("");
  const [orientation, setOrientation] = useState("");
  const [patientSigDataUrl, setPatientSigDataUrl] = useState("");
  const [sigUnobtainable, setSigUnobtainable] = useState(false);
  const [sigUnobtainableReason, setSigUnobtainableReason] = useState("");
  const [witnessName, setWitnessName] = useState(crewMemberName);
  const [witnessSigDataUrl, setWitnessSigDataUrl] = useState("");

  const showRefusal = patientContact === true && contactEndReason === "Patient Refused Transport";

  const orientationWarning = orientation === "aox2" || orientation === "aox1" || orientation === "altered";

  const canSubmit = () => {
    if (patientContact === null) return false;

    if (patientContact) {
      if (!contactEndReason) return false;
      if (showRefusal) {
        if (!informedOfRisks || !acknowledgedRisks) return false;
        if (!risksText.trim()) return false;
        if (!refusalReason.trim()) return false;
        if (!orientation) return false;
        if (!sigUnobtainable && !patientSigDataUrl) return false;
        if (sigUnobtainable && !sigUnobtainableReason.trim()) return false;
        if (!witnessName.trim()) return false;
        if (!witnessSigDataUrl) return false;
      }
    } else {
      if (!noContactReason) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);

    try {
      const doc: any = {
        patient_contact_made: patientContact,
        crew_member_name: crewMemberName,
        crew_member_cert: crewMemberCert,
        cancellation_timestamp: cancelledAt || new Date().toISOString(),
        documented_at: new Date().toISOString(),
      };

      if (patientContact) {
        doc.contact_end_reason = contactEndReason;
        doc.contact_notes = contactNotes || null;

        if (showRefusal) {
          doc.refusal = {
            informed_of_risks: informedOfRisks,
            acknowledged_risks: acknowledgedRisks,
            risks_communicated: risksText,
            refusal_reason: refusalReason,
            patient_orientation: orientation,
            patient_signature: sigUnobtainable ? null : patientSigDataUrl,
            signature_unobtainable: sigUnobtainable,
            signature_unobtainable_reason: sigUnobtainable ? sigUnobtainableReason : null,
            witness_name: witnessName,
            witness_signature: witnessSigDataUrl,
          };
        }
      } else {
        doc.no_contact_reason = noContactReason;
        doc.no_contact_notes = noContactNotes || null;
      }

      const updatePayload: any = {
        pcr_status: "cancelled_documented",
        cancellation_documentation: doc,
      };

      if (showRefusal) {
        updatePayload.disposition = "Patient Refusal";
      }

      await supabase.from("trip_records" as any)
        .update(updatePayload)
        .eq("id", tripId);

      logAuditEvent({
        action: "cancellation_documented",
        tableName: "trip_records",
        recordId: tripId,
        notes: `Cancellation documentation completed for ${patientName} — ${patientContact ? contactEndReason : noContactReason}`,
      });

      toast.success("Cancellation documentation saved");
      onOpenChange(false);
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to save documentation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancellation Documentation — {patientName}</DialogTitle>
          <DialogDescription>Complete required documentation for this cancelled run.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Crew info (read-only) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Crew Member</Label>
              <p className="text-sm font-medium">{crewMemberName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cert Level</Label>
              <p className="text-sm font-medium">{crewMemberCert || "—"}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cancellation Time</Label>
            <p className="text-sm font-medium">
              {cancelledAt ? new Date(cancelledAt).toLocaleString() : "—"}
            </p>
          </div>

          {/* Step 1: Patient contact toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Was patient contact made? <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={patientContact === true ? "default" : "outline"}
                size="sm"
                onClick={() => setPatientContact(true)}
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={patientContact === false ? "default" : "outline"}
                size="sm"
                onClick={() => setPatientContact(false)}
              >
                No
              </Button>
            </div>
          </div>

          {/* Contact Made */}
          {patientContact === true && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Reason patient contact ended <span className="text-destructive">*</span></Label>
                <Select value={contactEndReason} onValueChange={setContactEndReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_END_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {!showRefusal && contactEndReason && (
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={contactNotes} onChange={e => setContactNotes(e.target.value)} placeholder="Brief documentation…" rows={2} />
                </div>
              )}

              {/* Patient Refusal Form */}
              {showRefusal && (
                <div className="space-y-4 border-t pt-3">
                  <p className="text-xs font-bold uppercase text-destructive tracking-wider">Patient Refusal Documentation</p>

                  <div className="flex items-start gap-2">
                    <Checkbox id="informed-risks" checked={informedOfRisks} onCheckedChange={v => setInformedOfRisks(v === true)} />
                    <Label htmlFor="informed-risks" className="text-sm cursor-pointer">
                      Patient was verbally informed of the medical risks of refusing transport <span className="text-destructive">*</span>
                    </Label>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox id="ack-risks" checked={acknowledgedRisks} onCheckedChange={v => setAcknowledgedRisks(v === true)} />
                    <Label htmlFor="ack-risks" className="text-sm cursor-pointer">
                      Patient verbally acknowledged understanding of risks <span className="text-destructive">*</span>
                    </Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Specific risks communicated to patient <span className="text-destructive">*</span></Label>
                    <Textarea value={risksText} onChange={e => setRisksText(e.target.value)} rows={3} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Reason patient gave for refusing transport <span className="text-destructive">*</span></Label>
                    <Textarea value={refusalReason} onChange={e => setRefusalReason(e.target.value)} placeholder="Document patient's stated reason…" rows={2} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Was patient alert and oriented at time of refusal? <span className="text-destructive">*</span></Label>
                    <Select value={orientation} onValueChange={setOrientation}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {ORIENTATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {orientationWarning && (
                      <Alert className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                          Patient may not have capacity to refuse — document carefully and consider contacting medical direction.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Patient signature */}
                  <div className="space-y-1.5">
                    <Label>Patient Signature <span className="text-destructive">*</span></Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox id="sig-unable" checked={sigUnobtainable} onCheckedChange={v => setSigUnobtainable(v === true)} />
                      <Label htmlFor="sig-unable" className="text-xs text-muted-foreground cursor-pointer">Signature Unobtainable</Label>
                    </div>
                    {sigUnobtainable ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Reason signature could not be obtained <span className="text-destructive">*</span></Label>
                        <Textarea value={sigUnobtainableReason} onChange={e => setSigUnobtainableReason(e.target.value)} placeholder="Explain why…" rows={2} />
                      </div>
                    ) : (
                      <SignaturePad onComplete={setPatientSigDataUrl} />
                    )}
                  </div>

                  {/* Crew witness */}
                  <div className="space-y-1.5">
                    <Label>Crew Witness Name <span className="text-destructive">*</span></Label>
                    <Input value={witnessName} onChange={e => setWitnessName(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Crew Witness Signature <span className="text-destructive">*</span></Label>
                    <SignaturePad onComplete={setWitnessSigDataUrl} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Contact */}
          {patientContact === false && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Reason no contact <span className="text-destructive">*</span></Label>
                <Select value={noContactReason} onValueChange={setNoContactReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {NO_CONTACT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={noContactNotes} onChange={e => setNoContactNotes(e.target.value)} placeholder="Brief documentation…" rows={2} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit() || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Submit Documentation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
