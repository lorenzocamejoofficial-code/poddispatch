import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PenTool, Check, AlertCircle, X, Maximize2 } from "lucide-react";

interface CrewMember {
  id: string;
  name: string;
  cert: string;
  userId: string;
}

interface CrewSignature {
  crew_member_id: string;
  name: string;
  cert_level: string;
  timestamp: string;
  dataUrl: string;
}

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

/* ─── Full-screen signature canvas (reused pattern) ─── */
function FullScreenSignatureCanvas({
  onDone,
  onClose,
}: {
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const hasMoved = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
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
    e.preventDefault();
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
  };

  const handleDone = () => {
    if (canvasRef.current) onDone(canvasRef.current.toDataURL());
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4 mr-1" /> Cancel</Button>
        <p className="text-sm font-semibold">Partner Signature</p>
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

/* ─── Inline signature pad ─── */
function InlineSignaturePad({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
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
    if (canvasRef.current) onCapture(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onCapture("");
  };

  const handleFullScreenDone = useCallback((dataUrl: string) => {
    onCapture(dataUrl);
    setFullScreen(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = dataUrl;
  }, [onCapture]);

  return (
    <>
      {fullScreen && (
        <FullScreenSignatureCanvas onDone={handleFullScreenDone} onClose={() => setFullScreen(false)} />
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
            variant="ghost" size="icon"
            className="absolute top-1 right-1 h-7 w-7 bg-background/80"
            onClick={() => setFullScreen(true)} type="button"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={clear} className="text-xs">Clear</Button>
      </div>
    </>
  );
}

/* ─── Partner Signature Modal ─── */
function PartnerSignatureModal({
  open,
  onOpenChange,
  member,
  onSign,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member: CrewMember;
  onSign: (member: CrewMember, dataUrl: string, typedName: string) => void;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [typedName, setTypedName] = useState("");

  const canSave = dataUrl && typedName.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSign(member, dataUrl, typedName.trim());
    setDataUrl("");
    setTypedName("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setDataUrl("");
    setTypedName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" />
            Partner Signature — {member.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{member.cert}</p>

          <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              By signing below I attest that I was present on this transport and have reviewed the patient care documentation.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Signature</p>
            <InlineSignaturePad onCapture={setDataUrl} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Type full name to confirm</p>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={member.name}
              className="h-9"
            />
          </div>

          <Button className="w-full" disabled={!canSave} onClick={handleSave}>
            <PenTool className="h-3.5 w-3.5 mr-1.5" />
            Sign as Partner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Displays required crew signatures matching the number of assigned crew.
 * Any assigned crew member can sign at any point during PCR documentation
 * (concurrent signing supported — no ordering requirement).
 * The attending medic can also collect a partner's signature on the same device.
 */
export function CrewSignaturesSection({ trip, updateField }: Props) {
  const { user } = useAuth();
  const [assignedCrew, setAssignedCrew] = useState<CrewMember[]>([]);
  const [partnerModalMember, setPartnerModalMember] = useState<CrewMember | null>(null);

  useEffect(() => {
    if (!trip?.crew_id) return;
    (async () => {
      const { data: crew } = await supabase
        .from("crews")
        .select("member1:profiles!crews_member1_id_fkey(id, full_name, cert_level, user_id), member2:profiles!crews_member2_id_fkey(id, full_name, cert_level, user_id), member3:profiles!crews_member3_id_fkey(id, full_name, cert_level, user_id)")
        .eq("id", trip.crew_id)
        .maybeSingle();
      if (!crew) return;
      const members: CrewMember[] = [];
      for (const key of ["member1", "member2", "member3"] as const) {
        const m = (crew as any)[key];
        if (m) members.push({ id: m.id, name: m.full_name, cert: m.cert_level, userId: m.user_id });
      }
      setAssignedCrew(members);
    })();
  }, [trip?.crew_id]);

  const existingCrewSigs: CrewSignature[] = (trip.signatures_json || []).filter(
    (s: any) => s.type === "Crew Signature"
  );

  const hasSigned = (memberId: string) =>
    existingCrewSigs.some(s => s.crew_member_id === memberId);

  const allSigned = assignedCrew.length > 0 && assignedCrew.every(m => hasSigned(m.id));
  const missingCount = assignedCrew.filter(m => !hasSigned(m.id)).length;

  // Find the current user's crew member record
  const currentUserMember = assignedCrew.find(m => m.userId === user?.id);
  const currentUserHasSigned = currentUserMember ? hasSigned(currentUserMember.id) : true;

  const handleSign = async (member: CrewMember) => {
    const newSig = {
      id: crypto.randomUUID(),
      type: "Crew Signature",
      name: member.name,
      role: `Crew — ${member.cert}`,
      crew_member_id: member.id,
      timestamp: new Date().toISOString(),
      dataUrl: "",
    };
    const updatedSigs = [...(trip.signatures_json || []), newSig];
    await updateField("signatures_json", updatedSigs);
  };

  const handlePartnerSign = async (member: CrewMember, dataUrl: string, _typedName: string) => {
    const newSig = {
      id: crypto.randomUUID(),
      type: "Crew Signature",
      name: member.name,
      role: `Crew — ${member.cert}`,
      crew_member_id: member.id,
      timestamp: new Date().toISOString(),
      dataUrl,
    };
    const updatedSigs = [...(trip.signatures_json || []), newSig];
    await updateField("signatures_json", updatedSigs);
  };

  if (assignedCrew.length === 0) return null;

  // Determine if current user has signed (to show partner collection buttons)
  const canCollectPartnerSigs = currentUserMember ? hasSigned(currentUserMember.id) : false;
  // Unsigned members that are NOT the current user
  const unsignedPartners = assignedCrew.filter(m => !hasSigned(m.id) && m.userId !== user?.id);

  return (
    <div className={`rounded-lg border-2 p-4 space-y-3 ${allSigned ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10" : "border-destructive bg-destructive/5"}`}>
      <div className="flex items-center gap-2">
        {allSigned ? (
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
        <p className="text-sm font-bold text-foreground">
          Crew Signatures {allSigned ? "— Complete" : `— ${missingCount} Required`}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        All assigned crew members can sign at any time during documentation.
      </p>

      {/* Sign as Partner — prominent button for current user who hasn't signed */}
      {currentUserMember && !currentUserHasSigned && (
        <div className="rounded-md border-2 border-primary/50 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{currentUserMember.name}</p>
              <p className="text-[10px] text-muted-foreground">{currentUserMember.cert}</p>
            </div>
            <Button size="sm" onClick={() => handleSign(currentUserMember)}>
              <PenTool className="h-3.5 w-3.5 mr-1" />
              Sign as Partner
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {assignedCrew.map(member => {
          const signed = hasSigned(member.id);
          const sigData = existingCrewSigs.find(s => s.crew_member_id === member.id);
          const isCurrentUser = user?.id === member.userId;

          return (
            <div key={member.id} className={`flex items-center gap-3 rounded-md border p-3 ${signed ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-[10px] text-muted-foreground">{member.cert}</p>
                {signed && sigData && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Signed {new Date(sigData.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
              {signed ? (
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isCurrentUser ? (
                <Button size="sm" className="text-xs shrink-0" onClick={() => handleSign(member)}>
                  <PenTool className="h-3.5 w-3.5 mr-1" />
                  Sign
                </Button>
              ) : (
                <span className="text-[10px] font-bold text-destructive shrink-0">Pending</span>
              )}
            </div>
          );
        })}
      </div>

      {/* In-person partner signature collection — shown after attending has signed */}
      {canCollectPartnerSigs && unsignedPartners.length > 0 && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Collect partner signature on this device</p>
          <p className="text-[10px] text-muted-foreground">Hand the device to your partner to sign below.</p>
          {unsignedPartners.map(member => (
            <Button
              key={member.id}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs border-primary/30"
              onClick={() => setPartnerModalMember(member)}
            >
              <PenTool className="h-3.5 w-3.5 text-primary" />
              Partner Signs Here — {member.name}
            </Button>
          ))}
        </div>
      )}

      {/* Partner Signature Modal */}
      {partnerModalMember && (
        <PartnerSignatureModal
          open={!!partnerModalMember}
          onOpenChange={(o) => { if (!o) setPartnerModalMember(null); }}
          member={partnerModalMember}
          onSign={handlePartnerSign}
        />
      )}
    </div>
  );
}

/** Check if all assigned crew have signed */
export function areAllCrewSigned(signaturesJson: any[], assignedCrewCount: number): boolean {
  const crewSigs = (signaturesJson || []).filter((s: any) => s.type === "Crew Signature");
  return assignedCrewCount > 0 && crewSigs.length >= assignedCrewCount;
}
