import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const AGREEMENT_TYPE = "hipaa_workforce_acknowledgment";
const AGREEMENT_VERSION = "1.0";

/**
 * Gate component that blocks access until the user has accepted the
 * HIPAA workforce acknowledgment agreement. Renders children once accepted.
 */
export function HipaaAcknowledgmentGate({ children }: { children: React.ReactNode }) {
  const { user, activeCompanyId, isSystemCreator, role } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null); // null = loading
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // System creators and owners already accepted BAA during signup — skip gate
  const skipGate = isSystemCreator || role === "owner";

  useEffect(() => {
    if (!user || skipGate) {
      setAccepted(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("legal_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("agreement_type", AGREEMENT_TYPE)
        .maybeSingle();
      setAccepted(!!data);
    })();
  }, [user, skipGate]);

  const handleAccept = async () => {
    if (!user || !activeCompanyId) return;
    setSubmitting(true);

    const { error } = await supabase.from("legal_acceptances").insert({
      user_id: user.id,
      company_id: activeCompanyId,
      agreement_type: AGREEMENT_TYPE,
      agreement_version: AGREEMENT_VERSION,
    });

    if (error) {
      toast.error("Failed to record acceptance. Please try again.");
      setSubmitting(false);
      return;
    }

    setAccepted(true);
    setSubmitting(false);
  };

  // Loading state
  if (accepted === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Already accepted — render children
  if (accepted) {
    return <>{children}</>;
  }

  // Show acceptance screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle className="text-lg">HIPAA Workforce Acknowledgment</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Before accessing patient health information, you must acknowledge your responsibilities under HIPAA.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3 max-h-64 overflow-y-auto">
            <p className="font-medium">As a workforce member with access to Protected Health Information (PHI), I acknowledge that:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>I will only access, use, or disclose PHI as required to perform my assigned job duties.</li>
              <li>I will not share my login credentials with any other person or allow unauthorized access to the system.</li>
              <li>I will lock or log out of the system when stepping away from my workstation.</li>
              <li>I will immediately report any suspected breach, unauthorized access, or security incident to my supervisor.</li>
              <li>I understand that PHI includes any information that can identify a patient, including names, dates of birth, addresses, medical records, and insurance information.</li>
              <li>I will not copy, photograph, or transmit PHI through unauthorized channels such as personal email, text messages, or social media.</li>
              <li>I understand that violations of HIPAA can result in disciplinary action, termination, civil penalties, and criminal prosecution.</li>
              <li>This acknowledgment remains in effect for the duration of my access to this system.</li>
            </ul>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="hipaa-ack"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <label htmlFor="hipaa-ack" className="text-sm leading-snug cursor-pointer">
              I have read and understand my responsibilities under HIPAA. I agree to comply with all privacy and security requirements while accessing this system.
            </label>
          </div>

          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={!checked || submitting}
          >
            {submitting ? "Recording..." : "Accept & Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
