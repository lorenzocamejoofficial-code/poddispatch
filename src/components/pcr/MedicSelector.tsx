import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface Props {
  crewMember1: { id: string; name: string; cert: string } | null;
  crewMember2: { id: string; name: string; cert: string } | null;
  onSelect: (medic: { id: string; name: string; cert: string }) => void;
}

export function MedicSelector({ crewMember1, crewMember2, onSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 space-y-6">
      <div className="text-center space-y-2">
        <User className="h-10 w-10 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Who is the attending medic for this run?</h2>
        <p className="text-sm text-muted-foreground">This designation will be attached to the PCR record.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {crewMember1 && (
          <Button
            variant="outline"
            className="w-full h-16 text-base justify-start gap-4 border-2 hover:border-primary"
            onClick={() => onSelect(crewMember1)}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{crewMember1.name}</p>
              <p className="text-xs text-muted-foreground">{crewMember1.cert}</p>
            </div>
          </Button>
        )}
        {crewMember2 && (
          <Button
            variant="outline"
            className="w-full h-16 text-base justify-start gap-4 border-2 hover:border-primary"
            onClick={() => onSelect(crewMember2)}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{crewMember2.name}</p>
              <p className="text-xs text-muted-foreground">{crewMember2.cert}</p>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
}
