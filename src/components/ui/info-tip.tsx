import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

interface InfoTipProps {
  text: string;
  /** Tooltip alignment relative to the icon. */
  align?: "center" | "left";
}

/** Small circled-i explainer. Tap on mobile, hover on desktop. */
export function InfoTip({ text, align = "center" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <span className="relative inline-flex items-center ml-1 align-middle" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center h-4 w-4 text-muted-foreground/70 hover:text-foreground transition-colors"
        aria-label="More info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className={`absolute bottom-full mb-1.5 z-50 w-64 rounded-md border bg-popover p-2 text-xs leading-relaxed text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 ${
            align === "left" ? "left-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
