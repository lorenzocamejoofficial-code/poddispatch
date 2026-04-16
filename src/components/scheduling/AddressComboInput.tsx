import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Home } from "lucide-react";

interface AddressOption {
  label: string;
  value: string;
}

interface AddressComboInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AddressOption[];
  placeholder?: string;
}

export function AddressComboInput({ value, onChange, suggestions, placeholder }: AddressComboInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = suggestions.filter(s => s.value && s.value.trim() !== "");

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-40 overflow-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.value);
                setOpen(false);
              }}
            >
              {s.label.toLowerCase().includes("home") || s.label.toLowerCase().includes("pickup") ? (
                <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">
                <span className="font-medium text-muted-foreground mr-1">{s.label}:</span>
                {s.value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
