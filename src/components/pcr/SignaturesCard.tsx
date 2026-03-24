import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, PenTool } from "lucide-react";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

interface Props { trip: any; updateField: (f: string, v: any) => Promise<void>; }

interface Signature {
  id: string;
  type: string;
  name: string;
  role: string;
  timestamp: string;
  dataUrl: string;
}

const SIG_TYPES = [
  "Payment Authorization",
  "Receiving Facility / Transfer of Care",
  "Patient Refusal",
  "ABN / Non-covered Destination",
  "Crew Attestation",
];

const SIG_TOOLTIPS: Record<string, string> = {
  "Payment Authorization": PCR_TOOLTIPS.payment_authorization,
  "Receiving Facility / Transfer of Care": PCR_TOOLTIPS.receiving_facility_signature,
  "Patient Refusal": PCR_TOOLTIPS.patient_refusal,
  "Crew Attestation": PCR_TOOLTIPS.crew_attestation,
};

function SignaturePad({ onComplete }: { onComplete: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

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
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    setDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const endDraw = () => {
    setDrawing(false);
    if (canvasRef.current) onComplete(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={300} height={120}
        className="w-full border rounded-md bg-background touch-none"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <Button variant="outline" size="sm" onClick={clear} className="text-xs">Clear</Button>
    </div>
  );
}

export function SignaturesCard({ trip, updateField }: Props) {
  const sigs: Signature[] = trip.signatures_json || [];
  const [addingType, setAddingType] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [pendingDataUrl, setPendingDataUrl] = useState("");

  const addSig = () => {
    if (!addingType || !newName || !pendingDataUrl) return;
    const sig: Signature = {
      id: crypto.randomUUID(),
      type: addingType,
      name: newName,
      role: newRole,
      timestamp: new Date().toISOString(),
      dataUrl: pendingDataUrl,
    };
    updateField("signatures_json", [...sigs, sig]);
    setAddingType(null);
    setNewName("");
    setNewRole("");
    setPendingDataUrl("");
  };

  const removeSig = (id: string) => updateField("signatures_json", sigs.filter(s => s.id !== id));

  return (
    <div className="space-y-4">
      {sigs.map((sig) => (
        <div key={sig.id} className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center">
              {sig.type}
              {SIG_TOOLTIPS[sig.type] && <PCRTooltip text={SIG_TOOLTIPS[sig.type]} />}
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSig(sig.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
          <p className="text-sm">{sig.name} — {sig.role}</p>
          <p className="text-[10px] text-muted-foreground">{new Date(sig.timestamp).toLocaleString()}</p>
          {sig.dataUrl && <img src={sig.dataUrl} alt="signature" className="mt-1 h-12 border rounded" />}
        </div>
      ))}

      {addingType ? (
        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-bold text-primary uppercase flex items-center">
            {addingType}
            {SIG_TOOLTIPS[addingType] && <PCRTooltip text={SIG_TOOLTIPS[addingType]} />}
          </p>
          <Input placeholder="Signer name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-10" />
          <Input placeholder="Role (e.g., Patient, Nurse, Medic)" value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-10" />
          <SignaturePad onComplete={setPendingDataUrl} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={addSig} disabled={!newName || !pendingDataUrl}>Save Signature</Button>
            <Button variant="outline" onClick={() => setAddingType(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {SIG_TYPES.filter(t => !sigs.some(s => s.type === t)).map(type => (
            <Button key={type} variant="outline" className="w-full justify-start gap-2" onClick={() => setAddingType(type)}>
              <PenTool className="h-4 w-4" />
              <span className="flex items-center">
                {type}
                {SIG_TOOLTIPS[type] && <PCRTooltip text={SIG_TOOLTIPS[type]} />}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
