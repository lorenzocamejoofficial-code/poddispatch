import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface InfoTipProps {
  text: string;
  /** Preferred horizontal alignment relative to the icon. Auto-clamped to the viewport. */
  align?: "center" | "left";
}

const WIDTH = 256; // w-64
const MARGIN = 8;

/** Small circled-i explainer. Tap on mobile, hover on desktop. Never renders off-screen. */
export function InfoTip({ text, align = "center" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const trigger = ref.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const tipH = tipRef.current?.offsetHeight ?? 80;

    // Horizontal: preferred anchor, then clamp inside the viewport.
    let left = align === "left" ? r.left : r.left + r.width / 2 - WIDTH / 2;
    const maxLeft = window.innerWidth - WIDTH - MARGIN;
    left = Math.max(MARGIN, Math.min(left, Math.max(MARGIN, maxLeft)));

    // Vertical: above by default, flip below when there is no room.
    let top = r.top - tipH - 6;
    if (top < MARGIN) {
      const below = r.bottom + 6;
      top = below + tipH > window.innerHeight - MARGIN ? Math.max(MARGIN, window.innerHeight - tipH - MARGIN) : below;
    }

    setPos({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Second pass once real height is known.
    const raf = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(raf);
  }, [open, reposition, text]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onScrollOrResize = () => reposition();
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, reposition]);

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
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: WIDTH,
              maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[100] rounded-md border bg-popover p-2 text-xs leading-relaxed text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
}
