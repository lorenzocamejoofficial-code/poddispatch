import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, PenTool, Maximize2, X } from "lucide-react";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { useCompanyName } from "@/hooks/useCompanyName";

interface Props { trip: any; updateField: (f: string, v: any) => Promise<void>; legType?: string | null; }

interface Signature {
  id: string;
  type: string;
  name: string;
  role: string;
  relationship?: string;
  unableToSignReason?: string;
  timestamp: string;
  dataUrl: string;
}

const SIG_TYPES = [
  "Payment Authorization",
  "Receiving Facility / Transfer of Care",
  "Patient Refusal",
  "ABN / Non-covered Destination",
];

const SIG_EXPLANATIONS: Record<string, string> = {
  "Payment Authorization": "COMPANY_NAME_PLACEHOLDER",
  "Patient Refusal": "Documents that the patient was informed of the medical risks of refusing transport or treatment and chose to refuse. Crew witness signature is required.",
  "ABN / Non-covered Destination": "Advance Beneficiary Notice — informs the patient that Medicare may not cover this transport. Patient acknowledges they may be responsible for payment.",
};

const RECEIVING_FACILITY_EXPLANATIONS: Record<string, string> = {
  a_leg: "Confirms that the receiving facility accepted the patient and that transfer of care was formally completed. Signed by a facility representative at the destination.",
  b_leg: "Confirms the patient was returned home or to their residence facility. Signed by the patient or their authorized representative upon arrival.",
  default: "Confirms that the receiving facility accepted the patient and that transfer of care was formally completed. Signed by a facility representative at the destination.",
};

const SIG_TOOLTIPS: Record<string, string> = {
  "Payment Authorization": PCR_TOOLTIPS.payment_authorization,
  "Receiving Facility / Transfer of Care": PCR_TOOLTIPS.receiving_facility_signature,
  "Patient Refusal": PCR_TOOLTIPS.patient_refusal,
};

const PAYMENT_AUTH_ROLES = ["Patient", "Authorized Representative", "Crew Attestation"] as const;
const RECEIVING_A_LEG_ROLES = ["Facility Representative", "Nurse", "Physician", "Other"] as const;
const RECEIVING_B_LEG_ROLES = ["Patient", "Authorized Representative", "Crew Attestation"] as const;
const REP_RELATIONSHIPS = [
  "Legal Guardian",
  "Healthcare Power of Attorney",
  "Government Benefits Representative",
  "Family Member",
  "Facility Representative",
];

function getReceivingExplanation(legType: string | null | undefined): string {
  if (legType === "a_leg") return RECEIVING_FACILITY_EXPLANATIONS.a_leg;
  if (legType === "b_leg") return RECEIVING_FACILITY_EXPLANATIONS.b_leg;
  return RECEIVING_FACILITY_EXPLANATIONS.default;
}

function getExplanation(sigType: string, legType: string | null | undefined): string {
  if (sigType === "Receiving Facility / Transfer of Care") return getReceivingExplanation(legType);
  return SIG_EXPLANATIONS[sigType] ?? "";
}

/* ─── Full-screen signature canvas ─── */
function FullScreenCanvas({
  initialDataUrl,
  onDone,
  onClose,
}: {
  initialDataUrl: string;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const endDraw = () => {
    setDrawing(false);
  };

  const handleDone = () => {
    if (canvasRef.current) {
      onDone(canvasRef.current.toDataURL());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4 mr-1" /> Cancel</Button>
        <p className="text-sm font-semibold">Sign Here</p>
        <Button size="sm" onClick={handleDone}>Done</Button>
      </div>
      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none bg-background"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
    </div>
  );
}

/* ─── Inline signature pad with expand button ─── */
function SignaturePad({ onComplete }: { onComplete: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [currentDataUrl, setCurrentDataUrl] = useState("");

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
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
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
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL();
      setCurrentDataUrl(url);
      onComplete(url);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setCurrentDataUrl("");
  };

  const handleFullScreenDone = useCallback((dataUrl: string) => {
    setCurrentDataUrl(dataUrl);
    onComplete(dataUrl);
    setFullScreen(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = dataUrl;
  }, [onComplete]);

  return (
    <>
      {fullScreen && (
        <FullScreenCanvas
          initialDataUrl={currentDataUrl}
          onDone={handleFullScreenDone}
          onClose={() => setFullScreen(false)}
        />
      )}
      <div className="space-y-2">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={300} height={120}
            className="w-full border rounded-md bg-background touch-none"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7 bg-background/80"
            onClick={() => setFullScreen(true)}
            type="button"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={clear} className="text-xs">Clear</Button>
      </div>
    </>
  );
}

/* ─── Role selector reused for Payment Auth and Receiving Facility ─── */
function RoleSelector({
  roles,
  role, setRole,
  relationship, setRelationship,
  unableReason, setUnableReason,
  showRelationship,
  showUnableReason,
}: {
  roles: readonly string[];
  role: string; setRole: (r: string) => void;
  relationship: string; setRelationship: (r: string) => void;
  unableReason: string; setUnableReason: (r: string) => void;
  showRelationship: boolean;
  showUnableReason: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Signer Role</Label>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Button
              key={r}
              type="button"
              variant={role === r ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs min-w-[100px]"
              onClick={() => { setRole(r); setRelationship(""); setUnableReason(""); }}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      {showRelationship && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Relationship to Patient</Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select relationship" /></SelectTrigger>
            <SelectContent>
              {REP_RELATIONSHIPS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showUnableReason && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Reason patient is unable to sign *</Label>
          <Textarea
            value={unableReason}
            onChange={(e) => setUnableReason(e.target.value)}
            placeholder="Document why the patient cannot sign"
            rows={2}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─── */
export function SignaturesCard({ trip, updateField, legType }: Props) {
  const { companyName } = useCompanyName();
  const sigs: Signature[] = trip.signatures_json || [];
  const [addingType, setAddingType] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [pendingDataUrl, setPendingDataUrl] = useState("");
  // Shared role selector state
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [unableReason, setUnableReason] = useState("");

  const isPaymentAuth = addingType === "Payment Authorization";
  const isReceivingFacility = addingType === "Receiving Facility / Transfer of Care";
  const needsRoleSelector = isPaymentAuth || isReceivingFacility;

  // Determine which roles to show for receiving facility
  const receivingRoles = legType === "b_leg" ? RECEIVING_B_LEG_ROLES : RECEIVING_A_LEG_ROLES;
  const activeRoles = isPaymentAuth ? PAYMENT_AUTH_ROLES : receivingRoles;

  const canSave = () => {
    if (!addingType || !newName || !pendingDataUrl) return false;
    if (needsRoleSelector) {
      if (!selectedRole) return false;
      if (selectedRole === "Authorized Representative" && !selectedRelationship) return false;
      if (selectedRole === "Crew Attestation" && !unableReason.trim()) return false;
    }
    return true;
  };

  const addSig = () => {
    if (!canSave()) return;
    const role = needsRoleSelector ? selectedRole : newRole;
    const sig: Signature = {
      id: crypto.randomUUID(),
      type: addingType!,
      name: newName,
      role,
      relationship: needsRoleSelector && selectedRole === "Authorized Representative" ? selectedRelationship : undefined,
      unableToSignReason: needsRoleSelector && selectedRole === "Crew Attestation" ? unableReason : undefined,
      timestamp: new Date().toISOString(),
      dataUrl: pendingDataUrl,
    };
    updateField("signatures_json", [...sigs, sig]);
    resetForm();
  };

  const resetForm = () => {
    setAddingType(null);
    setNewName("");
    setNewRole("");
    setPendingDataUrl("");
    setSelectedRole("");
    setSelectedRelationship("");
    setUnableReason("");
  };

  const removeSig = (id: string) => updateField("signatures_json", sigs.filter(s => s.id !== id));

  const showCanvas = needsRoleSelector
    ? selectedRole === "Crew Attestation" ? !!unableReason.trim() : !!selectedRole
    : true;

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
          <p className="text-[11px] text-muted-foreground mb-2">{getExplanation(sig.type, legType)}</p>
          <p className="text-sm">{sig.name} — {sig.role}{sig.relationship ? ` (${sig.relationship})` : ""}</p>
          {sig.unableToSignReason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {sig.unableToSignReason}</p>}
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
          <p className="text-[11px] text-muted-foreground">{getExplanation(addingType, legType)}</p>

          {needsRoleSelector && (
            <RoleSelector
              roles={activeRoles}
              role={selectedRole} setRole={setSelectedRole}
              relationship={selectedRelationship} setRelationship={setSelectedRelationship}
              unableReason={unableReason} setUnableReason={setUnableReason}
              showRelationship={selectedRole === "Authorized Representative"}
              showUnableReason={selectedRole === "Crew Attestation"}
            />
          )}

          <Input placeholder="Signer name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-10" />

          {!needsRoleSelector && (
            <Input placeholder="Role (e.g., Patient, Nurse, Medic)" value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-10" />
          )}

          {showCanvas && <SignaturePad onComplete={setPendingDataUrl} />}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={addSig} disabled={!canSave()}>Save Signature</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {SIG_TYPES.filter(t => !sigs.some(s => s.type === t)).map(type => (
            <div key={type} className="space-y-1">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setAddingType(type)}>
                <PenTool className="h-4 w-4" />
                <span className="flex items-center">
                  {type}
                  {SIG_TOOLTIPS[type] && <PCRTooltip text={SIG_TOOLTIPS[type]} />}
                </span>
              </Button>
              <p className="text-[10px] text-muted-foreground px-2">{getExplanation(type, legType)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
