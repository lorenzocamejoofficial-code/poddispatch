import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PenTool, Check, AlertCircle } from "lucide-react";

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

/**
 * Displays required crew signatures matching the number of assigned crew.
 * Each crew member sees a Sign button next to their name.
 * Highlights missing signatures in red.
 */
export function CrewSignaturesSection({ trip, updateField }: Props) {
  const { user } = useAuth();
  const [assignedCrew, setAssignedCrew] = useState<CrewMember[]>([]);

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

  const handleSign = async (member: CrewMember) => {
    const sig: CrewSignature = {
      crew_member_id: member.id,
      name: member.name,
      cert_level: member.cert,
      timestamp: new Date().toISOString(),
      dataUrl: "", // crew tap-to-sign (no canvas needed for crew attestation)
    };
    const newSig = {
      id: crypto.randomUUID(),
      type: "Crew Signature",
      name: member.name,
      role: `Crew — ${member.cert}`,
      crew_member_id: member.id,
      timestamp: sig.timestamp,
      dataUrl: sig.dataUrl,
    };
    const updatedSigs = [...(trip.signatures_json || []), newSig];
    await updateField("signatures_json", updatedSigs);
  };

  if (assignedCrew.length === 0) return null;

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
        All assigned crew members must sign before the PCR can be submitted.
      </p>

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
    </div>
  );
}

/** Check if all assigned crew have signed */
export function areAllCrewSigned(signaturesJson: any[], assignedCrewCount: number): boolean {
  const crewSigs = (signaturesJson || []).filter((s: any) => s.type === "Crew Signature");
  return assignedCrewCount > 0 && crewSigs.length >= assignedCrewCount;
}
