import { useEffect, useRef, useState } from "react";
import { Building2, Home, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { applyEndpointChoice, type FacilityRef } from "@/lib/facility-endpoints";

/**
 * Optional facility link for a run endpoint. Pick a facility (sets id + name)
 * or type any address (id stays null). Typing after a pick clears the link.
 */
export function FacilityEndpointInput({
  value, facilityId, facilities, onChange, placeholder, ariaLabel, invalid, className,
}: {
  value: string;
  facilityId: string | null;
  facilities: FacilityRef[];
  onChange: (next: { text: string; facilityId: string | null }) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const q = value.trim().toLowerCase();
  const matches = facilityId ? [] : facilities.filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 8);
  const linked = facilityId ? facilities.find((f) => f.id === facilityId) : null;

  return (
    <div ref={ref} className="relative space-y-1">
      <Input
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={className}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(applyEndpointChoice({ kind: "text", text: e.target.value })); setOpen(true); }}
      />
      {linked && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          <Building2 className="h-3 w-3" />Facility linked
          <button type="button" aria-label="Unlink facility" onClick={() => onChange({ text: value, facilityId: null })}>
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      {open && !facilityId && (matches.length > 0 || q) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md text-sm">
          {matches.map((f) => (
            <button key={f.id} type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
              onClick={() => { onChange(applyEndpointChoice({ kind: "facility", facility: f })); setOpen(false); }}>
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{f.name}
            </button>
          ))}
          {q && (
            <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground hover:bg-accent"
              onClick={() => setOpen(false)}>
              <Home className="h-3.5 w-3.5" />Use as typed (home / other address)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
