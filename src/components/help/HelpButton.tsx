import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAGE_HELP } from "./helpContent";

interface HelpButtonProps {
  routeKey: string;
}

export function HelpButton({ routeKey }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const help = PAGE_HELP[routeKey];
  if (!help) return null;

  const { title, content } = help;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        How this works
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1 text-sm">
            {/* What it DOES */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                What this page does
              </h4>
              <ul className="space-y-1.5">
                {content.does.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="border-t" />

            {/* What it DOES NOT DO */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What this page does not do
              </h4>
              <ul className="space-y-1.5">
                {content.doesNot.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {content.tips && content.tips.length > 0 && (
              <>
                <div className="border-t" />
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--status-yellow))]">
                    Tips & common mistakes
                  </h4>
                  <ul className="space-y-1.5">
                    {content.tips.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-yellow))] shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {content.symbols && content.symbols.length > 0 && (
              <>
                <div className="border-t" />
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
                    Symbols & icons guide
                  </h4>
                  <div className="space-y-1.5">
                    {content.symbols.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-foreground">
                        <span className="text-xs font-semibold shrink-0 min-w-[140px] text-primary">
                          {item.symbol}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.meaning}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
