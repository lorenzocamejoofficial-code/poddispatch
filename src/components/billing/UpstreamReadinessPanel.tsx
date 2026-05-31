import { CheckCircle2, AlertCircle, Info } from "lucide-react";

/**
 * Upstream Readiness Panel
 * ------------------------
 * Plain-language preview of what could block a clean claim, shown
 * BEFORE the trip exists — on the patient record and on the one-off
 * A/B leg creation form. This is the "would this likely pay?" gut
 * check the customer wants at the top of the funnel.
 *
 * It deliberately does NOT reuse evaluateClaimReadiness (which assumes
 * a full ClaimForEDI shape with PCR-side fields). Instead it checks the
 * subset of fields that can be known before any trip is dispatched.
 */

export interface UpstreamCheckInput {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;       // for one-off form which uses single name field
  dob?: string | null;
  sex?: string | null;
  pickup_address?: string | null;
  primary_payer?: string | null;
  member_id?: string | null;
  pcs_on_file?: boolean | null;
  pcs_expiration_date?: string | null;
  // Optional context — when present, lets us tailor PCS requirement
  transport_type?: string | null;  // e.g. "dialysis", "emergency", "ift"
}

interface Issue {
  label: string;
  detail?: string;
}

function parseAddress(s: string | null | undefined) {
  const v = (s ?? "").trim();
  if (!v) return { hasStreet: false, hasCity: false, hasZip: false };
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(v);
  const parts = v.split(",").map(p => p.trim()).filter(Boolean);
  return {
    hasStreet: parts.length >= 1 && parts[0].length > 3,
    hasCity: parts.length >= 2,
    hasZip,
  };
}

export function evaluateUpstreamReadiness(input: UpstreamCheckInput): {
  blockers: Issue[];
  warnings: Issue[];
} {
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];

  const fullName = (input.full_name ?? `${input.first_name ?? ""} ${input.last_name ?? ""}`).trim();
  if (!fullName || fullName.split(/\s+/).length < 2) {
    blockers.push({
      label: "Full name missing",
      detail: "Insurance needs both first and last name to match the patient.",
    });
  }

  const dob = (input.dob ?? "").trim();
  if (!dob || dob === "1900-01-01") {
    blockers.push({
      label: "Date of birth missing",
      detail: "Required by every payer to verify the patient.",
    });
  }

  const sex = (input.sex ?? "").toUpperCase();
  if (!sex || (sex !== "M" && sex !== "F" && sex !== "MALE" && sex !== "FEMALE")) {
    blockers.push({
      label: "Sex not set",
      detail: "Medicare and Medicaid both require this field.",
    });
  }

  const addr = parseAddress(input.pickup_address);
  if (!addr.hasStreet || !addr.hasCity || !addr.hasZip) {
    blockers.push({
      label: "Pickup address incomplete",
      detail: "Need street, city, and 5-digit ZIP, the ZIP drives Medicare rate lookup.",
    });
  }

  const payer = (input.primary_payer ?? "").trim();
  if (!payer) {
    blockers.push({
      label: "Primary payer missing",
      detail: "Without a payer the claim cannot be routed anywhere.",
    });
  }

  const memberId = (input.member_id ?? "").trim();
  if (!memberId) {
    blockers.push({
      label: "Member / policy ID missing",
      detail: "Required so the payer can identify the patient on their side.",
    });
  }

  // PCS — only matters when the trip is non-emergency and the payer
  // tends to require it. We warn (don't block) at the upstream stage.
  const isEmergency = (input.transport_type ?? "").toLowerCase() === "emergency";
  if (!isEmergency) {
    if (input.pcs_on_file === false || input.pcs_on_file == null) {
      warnings.push({
        label: "No PCS on file",
        detail: "Most non-emergency trips for Medicare/Medicaid need a Physician Certification Statement.",
      });
    } else if (input.pcs_expiration_date) {
      const exp = new Date(input.pcs_expiration_date);
      const daysLeft = Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        blockers.push({
          label: "PCS expired",
          detail: `The Physician Certification Statement expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago.`,
        });
      } else if (daysLeft <= 14) {
        warnings.push({
          label: `PCS expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          detail: "Renew before the next trip to avoid claim denials.",
        });
      }
    }
  }

  return { blockers, warnings };
}

interface PanelProps {
  input: UpstreamCheckInput;
  /** Optional title override (defaults to "Claim Readiness Preview"). */
  title?: string;
  className?: string;
}

export function UpstreamReadinessPanel({ input, title = "Claim Readiness Preview", className }: PanelProps) {
  const { blockers, warnings } = evaluateUpstreamReadiness(input);

  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <div className={`rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green-bg))] px-3 py-2 text-xs ${className ?? ""}`}>
        <div className="flex items-center gap-2 text-[hsl(var(--status-green))] font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Likely to pay — nothing obvious blocking a clean claim.
        </div>
      </div>
    );
  }

  const tone =
    blockers.length > 0
      ? {
          border: "border-destructive/30",
          bg: "bg-destructive/5",
          text: "text-destructive",
          icon: AlertCircle,
          headline:
            blockers.length === 1
              ? "1 issue will likely block this claim"
              : `${blockers.length} issues will likely block this claim`,
        }
      : {
          border: "border-amber-500/30",
          bg: "bg-amber-500/5",
          text: "text-amber-700 dark:text-amber-400",
          icon: Info,
          headline:
            warnings.length === 1
              ? "1 item worth reviewing before the next trip"
              : `${warnings.length} items worth reviewing before the next trip`,
        };

  const Icon = tone.icon;

  return (
    <div className={`rounded-md border ${tone.border} ${tone.bg} px-3 py-2.5 ${className ?? ""}`}>
      <div className="flex items-start gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tone.text}`} />
        <div className="text-xs">
          <p className={`font-semibold ${tone.text}`}>{title}</p>
          <p className={`${tone.text} opacity-90`}>{tone.headline}</p>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {blockers.map((b, i) => (
          <li key={`b-${i}`} className="flex items-start gap-1.5">
            <span className="text-destructive mt-0.5">●</span>
            <span>
              <span className="font-medium text-foreground">{b.label}.</span>{" "}
              {b.detail && <span className="text-muted-foreground">{b.detail}</span>}
            </span>
          </li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w-${i}`} className="flex items-start gap-1.5">
            <span className="text-amber-600 mt-0.5">●</span>
            <span>
              <span className="font-medium text-foreground">{w.label}.</span>{" "}
              {w.detail && <span className="text-muted-foreground">{w.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}