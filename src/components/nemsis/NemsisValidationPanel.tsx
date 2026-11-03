import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ValidationFinding, ValidationResult } from "@/lib/nemsis/validation";

function FindingList({ items, tone }: { items: ValidationFinding[]; tone: "error" | "warning" }) {
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li
          key={i}
          className={tone === "error"
            ? "rounded border border-destructive/40 bg-destructive/5 p-2"
            : "rounded border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-2"}
        >
          <p className="text-sm text-foreground">{f.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {f.source}{f.location ? ` · ${f.location}` : ""}{f.rule_id ? ` · ${f.rule_id}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Plain-language NEMSIS validation results, grouped into errors and warnings. */
export function NemsisValidationPanel({ result, title }: { result: ValidationResult; title?: string }) {
  const errors = result.findings.filter((f) => f.level === "ERROR");
  const warnings = result.findings.filter((f) => f.level === "WARNING");
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3" role="region" aria-label="NEMSIS validation results">
      <div className="flex flex-wrap items-center gap-2">
        {errors.length > 0
          ? <XCircle className="h-5 w-5 text-destructive" />
          : warnings.length > 0
            ? <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-yellow))]" />
            : <CheckCircle2 className="h-5 w-5 text-primary" />}
        <p className="font-semibold">
          {title ?? `NEMSIS ${result.dataset} validation`}:{" "}
          {errors.length > 0
            ? `${errors.length} error${errors.length === 1 ? "" : "s"} — cannot finalize until fixed`
            : warnings.length > 0
              ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} — you can still finalize`
              : "no problems found"}
        </p>
      </div>
      {errors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-destructive">Errors ({errors.length})</p>
          <FindingList items={errors} tone="error" />
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-[hsl(var(--status-yellow))]">Warnings ({warnings.length})</p>
          <FindingList items={warnings} tone="warning" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Checked against the NEMSIS 3.5.1 schema and {result.rule_sets.map((r) => `${r.source}${r.version ? ` (${r.version})` : ""}`).join(", ")} rules · {new Date(result.validated_at).toLocaleString()}
      </p>
    </div>
  );
}
