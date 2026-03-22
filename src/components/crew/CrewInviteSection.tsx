import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Copy, Check, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface ActiveEmployee {
  id: string;
  full_name: string;
  phone_number: string | null;
  truck_id: string | null;
  truck_name: string | null;
  role: "admin" | "crew" | null;
}

interface CrewInviteSectionProps {
  scheduleDate: string;
  employees: ActiveEmployee[];
}

export function CrewInviteSection({ scheduleDate, employees }: CrewInviteSectionProps) {
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [sendVia, setSendVia] = useState<"email" | "phone">("phone");
  const [copied, setCopied] = useState(false);

  // Filter to only crew members assigned to trucks for this date
  const crewWithTrucks = employees.filter(e => e.truck_id);

  const selectedCrew = employees.find(e => e.id === selectedCrewId);

  const crewLoginUrl = `${window.location.origin}/login?mode=crew`;

  const buildInviteMessage = (emp: ActiveEmployee) => {
    return `You've been assigned to ${emp.truck_name ?? "a truck"} today. Log in to view your runs and update statuses:\n\n${crewLoginUrl}\n\nUse your company email and password to sign in.`;
  };

  const handleCopyInvite = () => {
    if (!selectedCrew) return;
    const msg = buildInviteMessage(selectedCrew);
    navigator.clipboard.writeText(msg);
    setCopied(true);
    toast.success("Crew login invite copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Crew Login Invite
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Send a crew member their login link. They'll sign in with their company credentials to view their assigned runs.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div>
          <Label className="text-xs">Crew Member</Label>
          <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
            <SelectTrigger><SelectValue placeholder="Select crew member" /></SelectTrigger>
            <SelectContent>
              {crewWithTrucks.length === 0 && (
                <SelectItem value="__none" disabled>No crew assigned to trucks</SelectItem>
              )}
              {crewWithTrucks.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name} — {e.truck_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Send Via</Label>
          <Select value={sendVia} onValueChange={v => setSendVia(v as "email" | "phone")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> SMS / Text</span>
              </SelectItem>
              <SelectItem value="email">
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleCopyInvite}
          disabled={!selectedCrewId}
          variant="outline"
          className="gap-1.5"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--status-green))]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy Invite"}
        </Button>
      </div>

      {selectedCrew && (
        <div className="rounded-md bg-muted p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sendVia === "phone" && selectedCrew.phone_number ? (
              <Badge variant="secondary" className="text-[10px]">
                <Phone className="h-2.5 w-2.5 mr-1" /> {selectedCrew.phone_number}
              </Badge>
            ) : sendVia === "phone" && !selectedCrew.phone_number ? (
              <Badge variant="destructive" className="text-[10px]">No phone on file</Badge>
            ) : null}
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {buildInviteMessage(selectedCrew)}
          </pre>
        </div>
      )}
    </section>
  );
}
