/**
 * ReleaseReviewDialog
 * -------------------
 * Human "review and release" step in front of claim submission.
 *
 * Every ready-to-bill claim is shown as its own selectable row (checked by
 * default) so the biller sees exactly what is about to leave and can HOLD an
 * individual claim by unchecking it. Claims that failed validation appear in
 * the same list, greyed out, with their plain-English reason and a Fix link —
 * never a silent "N skipped" count.
 *
 * The LIVE / TEST banner reflects the ACTUAL envelope, which is decided solely
 * by company type (see src/lib/submission-mode.ts).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { AlertTriangle, FlaskConical, Send, ShieldAlert, Wrench } from "lucide-react";

export interface ReviewClaim {
  id: string;
  patient_name?: string | null;
  payer_name?: string | null;
  payer_type?: string | null;
  run_date?: string | null;
  total_charge?: number | null;
  /** Hard reasons this claim cannot be released. Empty => releasable. */
  reasons?: string[];
  /** Non-blocking notes shown as a chip. */
  warnings?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Claims eligible for release (no hard blockers). */
  releasable: ReviewClaim[];
  /** Claims held back by validation, shown inline with reasons. */
  blocked: ReviewClaim[];
  /** true => sandbox/creator-test company, OATEST envelope. */
  isTest: boolean;
  /** Open this claim's editor so the user can fix a blocker. */
  onFix: (claimId: string) => void;
  /** Release the selected claims. Resolves when the queue insert is done. */
  onRelease: (claimIds: string[]) => Promise<void>;
  sending?: boolean;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const payerOf = (c: ReviewClaim) => (c.payer_name || c.payer_type || "Unknown payer").trim();

export function ReleaseReviewDialog({
  open,
  onOpenChange,
  releasable,
  blocked,
  isTest,
  onFix,
  onRelease,
  sending = false,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Every releasable claim starts checked each time the dialog opens.
  useEffect(() => {
    if (open) setSelected(new Set(releasable.map((c) => c.id)));
  }, [open, releasable]);

  const selectedClaims = useMemo(
    () => releasable.filter((c) => selected.has(c.id)),
    [releasable, selected],
  );
  const selectedTotal = selectedClaims.reduce((s, c) => s + (c.total_charge ?? 0), 0);
  const payerCount = new Set(selectedClaims.map(payerOf)).size;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = releasable.length > 0 && selected.size === releasable.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review and release claims
            {isTest ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700 gap-1">
                <FlaskConical className="h-3 w-3" /> TEST (OATEST)
              </Badge>
            ) : (
              <Badge className="bg-[hsl(var(--status-green))] text-white">LIVE</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isTest
              ? "This is a sandbox company. Files go to Office Ally's test endpoint (OATEST) — nothing is billed and no money moves."
              : "These claims go to Office Ally for real payer processing. Uncheck anything you want to hold back."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-4 py-1">
            {releasable.length > 0 && (
              <div className="rounded-md border divide-y">
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/40">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) =>
                      setSelected(v ? new Set(releasable.map((c) => c.id)) : new Set())
                    }
                    aria-label="Select all claims"
                  />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Ready to release
                  </span>
                </div>
                {releasable.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Include ${c.patient_name ?? "claim"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.patient_name || "Unknown patient"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {payerOf(c)}
                        {c.run_date ? ` · ${c.run_date}` : ""}
                      </p>
                    </div>
                    {(c.warnings ?? []).length > 0 && (
                      <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        {c.warnings!.length === 1 ? c.warnings![0] : `${c.warnings!.length} warnings`}
                      </Badge>
                    )}
                    <span className="font-mono text-sm shrink-0">
                      {fmtMoney(c.total_charge ?? 0)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {blocked.length > 0 && (
              <div className="rounded-md border border-destructive/40 divide-y">
                <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs uppercase tracking-wider text-destructive font-medium">
                    Held back — {blocked.length} claim{blocked.length === 1 ? "" : "s"} can't go yet
                  </span>
                </div>
                {blocked.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 px-3 py-2.5 bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">
                        {c.patient_name || "Unknown patient"} · {payerOf(c)}
                        {c.run_date ? ` · ${c.run_date}` : ""}
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {(c.reasons ?? ["Blocked by billing checks"]).map((r, i) => (
                          <li key={i} className="text-xs text-destructive">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() => onFix(c.id)}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Fix
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {releasable.length === 0 && blocked.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nothing is waiting to be released.
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Sticky summary + single release action */}
        <div className="border-t pt-3 flex items-center gap-3">
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium">
              {selectedClaims.length} of {releasable.length} selected
            </span>
            <span className="text-muted-foreground">
              {" "}· {fmtMoney(selectedTotal)} · {payerCount} payer{payerCount === 1 ? "" : "s"}
            </span>
          </div>
          <ConfirmActionDialog
            trigger={
              <Button size="sm" className="gap-1.5" disabled={sending || selectedClaims.length === 0}>
                <Send className="h-3.5 w-3.5" />
                Release Selected
              </Button>
            }
            title={isTest ? "Release to Office Ally TEST (OATEST)?" : "Release claims to payers?"}
            description={
              isTest
                ? "This sandbox company always submits with the OATEST envelope. Office Ally validates the file format only — no payer sees it, nothing is billed."
                : "These claims go out live to Office Ally and on to the payers. Once released they cannot be unsent; you'll wait for the payer's remittance response (days to weeks)."
            }
            summary={
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claims releasing</span>
                  <span className="font-medium">{selectedClaims.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Held back by you</span>
                  <span className="font-medium">{releasable.length - selectedClaims.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total billed</span>
                  <span className="font-mono font-medium">{fmtMoney(selectedTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-medium">
                    {isTest ? "Office Ally TEST (OATEST)" : "Office Ally — LIVE"}
                  </span>
                </div>
              </div>
            }
            confirmWord="SUBMIT"
            destructive={false}
            onConfirm={async () => {
              await onRelease(selectedClaims.map((c) => c.id));
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
