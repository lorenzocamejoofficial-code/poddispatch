import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYER_CLASSES, PAYER_CLASS_LABELS, type PayerClass } from "@/lib/payer-class";
import { INTAKE_TRANSPORT_OPTIONS, intakeAxes, legacyIntakeTransport, type IntakeIssue } from "@/lib/intake-axis-policy";
import type { TransportKind } from "@/lib/transport-vocabulary";

export function IntakeFieldError({ field, issues }: { field: string; issues: IntakeIssue[] }) {
  const issue = issues.find(i => i.field === field);
  return issue ? <p className="text-xs text-destructive mt-1" role="alert">{issue.label} is required.</p> : null;
}
export function IntakeAxes({ transport, payer, onTransportChange, onPayerChange, issues = [], transportField = "transport_type" }: {
  transport: string; payer: string; onTransportChange: (legacy: string) => void;
  onPayerChange: (legacy: string) => void; issues?: IntakeIssue[]; transportField?: string;
}) {
  const axes = intakeAxes(transport, payer);
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div><Label>Transport kind *</Label>
      <Select value={axes.kind ?? ""} onValueChange={v => onTransportChange(legacyIntakeTransport(v as TransportKind))}>
        <SelectTrigger aria-label="Transport kind" aria-invalid={issues.some(i => i.field === transportField)} className={issues.some(i => i.field === transportField) ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="Select transport kind" /></SelectTrigger>
        <SelectContent>{INTAKE_TRANSPORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select><IntakeFieldError field={transportField} issues={issues} />
    </div>
    <div data-focus="primary_payer"><Label>Payer class *</Label>
      <Select value={axes.payerClass ?? ""} onValueChange={v => onPayerChange(v as PayerClass)}>
        <SelectTrigger aria-label="Payer class" aria-invalid={issues.some(i => i.field === "primary_payer")} className={issues.some(i => i.field === "primary_payer") ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="Select payer class" /></SelectTrigger>
        <SelectContent>{PAYER_CLASSES.map(p => <SelectItem key={p} value={p}>{PAYER_CLASS_LABELS[p]}</SelectItem>)}</SelectContent>
      </Select><IntakeFieldError field="primary_payer" issues={issues} />
    </div>
  </div>;
}