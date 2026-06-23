import { CrewLayout } from "@/components/crew/CrewLayout";
import { CrewCertificationsPanel } from "@/components/crew/CrewCertificationsDialog";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

export default function CrewCertifications() {
  const { user } = useAuth();
  return (
    <CrewLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">My Certifications</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Keep your Medic/EMT number, CPR card, and Driver's License current. You will be blocked from
          truck assignments if any of the three expire. Submissions go to your manager for approval.
        </p>
        {user?.id ? (
          <CrewCertificationsPanel userId={user.id} />
        ) : (
          <p className="text-sm text-muted-foreground">Sign in required.</p>
        )}
      </div>
    </CrewLayout>
  );
}