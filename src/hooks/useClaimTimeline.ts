import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { translateIKCodes } from "@/lib/edi-999-translations";

export type TimelineStage =
  | "submission"
  | "acknowledgment"
  | "payment"
  | "ar"
  | "status"
  | "internal";

export type TimelineSeverity = "success" | "warning" | "danger" | "info" | "muted";

export interface TimelineEvent {
  id: string;
  at: string; // ISO timestamp
  stage: TimelineStage;
  severity: TimelineSeverity;
  title: string;
  detail?: string;
  actor?: string | null;
  meta?: Record<string, any>;
  /** Footnote text shown nested under this event (e.g. file-level PLBs). */
  footnotes?: string[];
  internal?: boolean;
}

export interface ClaimTimelineData {
  loading: boolean;
  events: TimelineEvent[];
  error: string | null;
  claim: any | null;
}

export function useClaimTimeline(claimId: string | null): ClaimTimelineData {
  const [data, setData] = useState<ClaimTimelineData>({
    loading: true,
    events: [],
    error: null,
    claim: null,
  });

  useEffect(() => {
    if (!claimId) {
      setData({ loading: false, events: [], error: null, claim: null });
      return;
    }
    let cancelled = false;

    (async () => {
      setData((d) => ({ ...d, loading: true, error: null }));
      try {
        const { data: claim, error: claimErr } = await supabase
          .from("claim_records")
          .select("*")
          .eq("id", claimId)
          .maybeSingle();
        if (claimErr) throw claimErr;
        if (!claim) {
          if (!cancelled)
            setData({ loading: false, events: [], error: "Claim not found", claim: null });
          return;
        }

        const tripId = (claim as any).trip_id as string | null;

        const [
          artifactsRes,
          queueRes,
          acksRes,
          paymentsRes,
          notesRes,
          quarantineRes,
          claimAdjRes,
          billingOverrideRes,
          tripStatusRes,
          auditRes,
        ] = await Promise.all([
          supabase
            .from("claim_submission_artifacts" as any)
            .select("id, filename, generated_at, byte_size, is_test_submission, generated_by")
            .contains("claim_ids", [claimId])
            .order("generated_at", { ascending: false }),
          supabase
            .from("claim_submission_queue" as any)
            .select("id, filename, status, error_message, attempts, submitted_at, created_at")
            .contains("claim_ids", [claimId])
            .order("created_at", { ascending: false }),
          supabase
            .from("claim_acknowledgments" as any)
            .select(
              "id, file_type, outcome, payer_claim_control_number, rejection_codes, rejection_reason, received_at, ack_file_id"
            )
            .eq("claim_record_id", claimId)
            .order("received_at", { ascending: false }),
          supabase
            .from("claim_payments" as any)
            .select(
              "id, event_type, clp_status_code, amount, patient_responsibility, write_off, allowed_amount, denial_code, denial_reason, adjustment_codes, payer_claim_control_number, remittance_file_id, payment_date, applied_at"
            )
            .eq("claim_record_id", claimId)
            .order("applied_at", { ascending: false }),
          supabase
            .from("ar_followup_notes")
            .select("id, note_text, created_by_name, created_at")
            .eq("claim_id", claimId)
            .order("created_at", { ascending: false }),
          supabase
            .from("remittance_quarantine" as any)
            .select("id, quarantine_reason, status, created_at, reviewed_at, file_type")
            .eq("posted_to_claim_id", claimId),
          tripId
            ? supabase
                .from("claim_adjustments" as any)
                .select("id, field_changed, old_value, new_value, reason, created_at, changed_by")
                .eq("trip_id", tripId)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
          tripId
            ? supabase
                .from("billing_overrides" as any)
                .select("id, override_reason, overridden_at, overridden_by")
                .eq("trip_id", tripId)
                .order("overridden_at", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
          tripId
            ? supabase
                .from("trip_status_history" as any)
                .select("id, old_status, new_status, changed_at, changed_by")
                .eq("trip_id", tripId)
                .order("changed_at", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
          supabase
            .from("audit_logs")
            .select("id, action, actor_email, notes, created_at, table_name, record_id")
            .or(
              `record_id.eq.${claimId}${tripId ? `,record_id.eq.${tripId}` : ""}`
            )
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        // Look up file-level PLBs sharing remittance_file_id with our payments.
        const remittanceFileIds = [
          ...new Set(
            ((paymentsRes.data ?? []) as any[])
              .map((p) => p.remittance_file_id)
              .filter(Boolean)
          ),
        ];
        let plbsByFile = new Map<string, any[]>();
        if (remittanceFileIds.length > 0) {
          const { data: plbs } = await supabase
            .from("plb_adjustments" as any)
            .select("id, remittance_file_id, reason_code, reference_id, amount, fiscal_period")
            .in("remittance_file_id", remittanceFileIds);
          for (const p of (plbs ?? []) as any[]) {
            if (!plbsByFile.has(p.remittance_file_id)) plbsByFile.set(p.remittance_file_id, []);
            plbsByFile.get(p.remittance_file_id)!.push(p);
          }
        }

        // Resolve actor names for trip status / claim adjustments / overrides
        const userIds = new Set<string>();
        for (const r of (tripStatusRes.data ?? []) as any[]) r.changed_by && userIds.add(r.changed_by);
        for (const r of (claimAdjRes.data ?? []) as any[]) r.changed_by && userIds.add(r.changed_by);
        for (const r of (billingOverrideRes.data ?? []) as any[])
          r.overridden_by && userIds.add(r.overridden_by);
        let nameMap = new Map<string, string>();
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", [...userIds]);
          if (profiles)
            nameMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name ?? "Unknown"]));
        }

        const events: TimelineEvent[] = [];

        // Claim created
        if ((claim as any).created_at) {
          events.push({
            id: `claim-created-${claim.id}`,
            at: (claim as any).created_at,
            stage: "submission",
            severity: "info",
            title: "Claim record created",
            detail: `Payer: ${(claim as any).payer_name ?? (claim as any).payer_type ?? "—"} · DOS ${(claim as any).run_date}`,
          });
        }
        if ((claim as any).claim_build_date) {
          events.push({
            id: `claim-built-${claim.id}`,
            at: `${(claim as any).claim_build_date}T00:00:00Z`,
            stage: "submission",
            severity: "info",
            title: "837P built",
          });
        }

        // Submission artifacts
        for (const a of (artifactsRes.data ?? []) as any[]) {
          events.push({
            id: `art-${a.id}`,
            at: a.generated_at,
            stage: "submission",
            severity: "info",
            title: a.is_test_submission ? "837P artifact (TEST)" : "837P artifact generated",
            detail: `${a.filename} · ${a.byte_size ?? "?"} bytes`,
          });
        }

        // Submission queue
        for (const q of (queueRes.data ?? []) as any[]) {
          const sev: TimelineSeverity =
            q.status === "sent" ? "success" : q.status === "failed" ? "danger" : "info";
          events.push({
            id: `q-${q.id}`,
            at: q.submitted_at ?? q.created_at,
            stage: "submission",
            severity: sev,
            title:
              q.status === "sent"
                ? "Submitted to clearinghouse"
                : q.status === "failed"
                  ? "SFTP submission failed"
                  : `Queued (${q.status})`,
            detail: `${q.filename}${q.attempts ? ` · ${q.attempts} attempt(s)` : ""}${q.error_message ? ` · ${q.error_message}` : ""}`,
          });
        }

        // sftp_sent_at (claim-level)
        if ((claim as any).sftp_sent_at) {
          events.push({
            id: `sftp-${claim.id}`,
            at: (claim as any).sftp_sent_at,
            stage: "submission",
            severity: "success",
            title: "Dropped to clearinghouse SFTP",
          });
        }

        // Acknowledgments
        for (const ack of (acksRes.data ?? []) as any[]) {
          const accepted = ack.outcome === "accepted" || ack.outcome === "A";
          const rejected = ack.outcome === "rejected" || ack.outcome === "R";
          // Translate IK/AK codes (999) to plain English. CARC codes (CO-/PR-/OA-)
          // are translated separately by AR Command Center / DenialRecoveryEngine
          // against denial-code-translations.ts and don't appear here.
          const rawCodes: string[] = ack.rejection_codes ?? [];
          const is999 =
            typeof ack.file_type === "string" &&
            (ack.file_type.includes("999") || ack.file_type.includes("997"));
          const { translated: ikTranslated, unrecognized: ikUnrecognized } = is999
            ? translateIKCodes(rawCodes)
            : { translated: [], unrecognized: rawCodes };
          const codesLine = rawCodes.length
            ? is999 && ikTranslated.length
              ? `Codes: ${rawCodes.join(", ")}`
              : `Codes: ${rawCodes.join(", ")}`
            : null;
          const ikFootnotes = ikTranslated.map(
            (t) => `${t.code}, ${t.plain_english_explanation} (Fix: ${t.example_fix})`,
          );
          events.push({
            id: `ack-${ack.id}`,
            at: ack.received_at,
            stage: "acknowledgment",
            severity: rejected ? "danger" : accepted ? "success" : "info",
            title: `${ack.file_type ?? "Ack"} ${ack.outcome ?? ""}`.trim(),
            detail: [
              ack.payer_claim_control_number && `ICN ${ack.payer_claim_control_number}`,
              codesLine,
              ack.rejection_reason,
            ]
              .filter(Boolean)
              .join(" · "),
            footnotes: ikFootnotes.length ? ikFootnotes : undefined,
          });
        }

        // Manual rejection recorded
        if ((claim as any).last_rejection_recorded_at) {
          events.push({
            id: `rej-${claim.id}`,
            at: (claim as any).last_rejection_recorded_at,
            stage: "acknowledgment",
            severity: "danger",
            title: "Rejection recorded manually",
            detail: (claim as any).rejection_reason ?? undefined,
          });
        }

        // Resubmitted
        if ((claim as any).resubmitted_at) {
          events.push({
            id: `resub-${claim.id}`,
            at: (claim as any).resubmitted_at,
            stage: "submission",
            severity: "warning",
            title: `Resubmitted (#${(claim as any).resubmission_count ?? 1})`,
          });
        }

        // Payments + PLB footnotes
        for (const p of (paymentsRes.data ?? []) as any[]) {
          const isReversal = p.event_type === "reversal";
          const isDenial = p.clp_status_code && ["4", "11", "23"].includes(p.clp_status_code);
          const sev: TimelineSeverity = isReversal
            ? "warning"
            : isDenial
              ? "danger"
              : Number(p.amount) > 0
                ? "success"
                : "info";
          const detailParts = [
            `Paid $${Number(p.amount ?? 0).toFixed(2)}`,
            p.patient_responsibility ? `PR $${Number(p.patient_responsibility).toFixed(2)}` : null,
            p.write_off ? `WO $${Number(p.write_off).toFixed(2)}` : null,
            p.denial_code ? `Denial ${p.denial_code}` : null,
            p.adjustment_codes?.length ? `Codes ${p.adjustment_codes.join(",")}` : null,
            p.payer_claim_control_number ? `ICN ${p.payer_claim_control_number}` : null,
          ].filter(Boolean);
          const fn = (p.remittance_file_id && plbsByFile.get(p.remittance_file_id)) || [];
          const footnotes = fn.map(
            (x: any) =>
              `PLB ${x.reason_code} · $${Number(x.amount ?? 0).toFixed(2)}${x.reference_id ? ` · ref ${x.reference_id}` : ""} (file-level, not claim-linked)`
          );
          events.push({
            id: `pay-${p.id}`,
            at: p.applied_at ?? `${p.payment_date}T00:00:00Z`,
            stage: "payment",
            severity: sev,
            title: isReversal
              ? "Payment reversal"
              : isDenial
                ? "Denied via 835"
                : Number(p.amount) > 0
                  ? "Payment applied"
                  : "Remittance applied (no payment)",
            detail: detailParts.join(" · "),
            footnotes: footnotes.length ? footnotes : undefined,
          });
        }

        // paid_at flag
        if ((claim as any).paid_at) {
          events.push({
            id: `paid-${claim.id}`,
            at: (claim as any).paid_at,
            stage: "payment",
            severity: "success",
            title: "Claim marked paid",
          });
        }

        // Secondary claim
        if ((claim as any).secondary_claim_id) {
          events.push({
            id: `sec-${claim.id}`,
            at: (claim as any).updated_at ?? (claim as any).paid_at ?? new Date().toISOString(),
            stage: "payment",
            severity: "info",
            title: "Secondary claim generated",
            detail: `Linked claim ${(claim as any).secondary_claim_id}`,
          });
        }

        // Quarantine
        for (const q of (quarantineRes.data ?? []) as any[]) {
          events.push({
            id: `quar-${q.id}`,
            at: q.created_at,
            stage: "payment",
            severity: q.status === "resolved" ? "info" : "warning",
            title: `Remittance quarantined (${q.file_type ?? "835"})`,
            detail: q.quarantine_reason,
          });
          if (q.reviewed_at) {
            events.push({
              id: `quar-res-${q.id}`,
              at: q.reviewed_at,
              stage: "payment",
              severity: "success",
              title: "Quarantine resolved",
            });
          }
        }

        // AR follow-up notes
        for (const n of (notesRes.data ?? []) as any[]) {
          const isResubmit = n.note_text?.startsWith("[RESUBMIT]");
          events.push({
            id: `note-${n.id}`,
            at: n.created_at,
            stage: "ar",
            severity: isResubmit ? "warning" : "info",
            title: isResubmit ? "Marked for resubmission" : "AR follow-up note",
            detail: n.note_text,
            actor: n.created_by_name,
          });
        }

        // Claim adjustments (manual field edits)
        for (const a of (claimAdjRes.data ?? []) as any[]) {
          events.push({
            id: `adj-${a.id}`,
            at: a.created_at,
            stage: "ar",
            severity: "info",
            title: `Field corrected: ${a.field_changed}`,
            detail: `${a.old_value ?? "—"} → ${a.new_value ?? "—"}${a.reason ? ` · ${a.reason}` : ""}`,
            actor: a.changed_by ? nameMap.get(a.changed_by) : undefined,
          });
        }

        // Billing overrides
        for (const o of (billingOverrideRes.data ?? []) as any[]) {
          events.push({
            id: `ovr-${o.id}`,
            at: o.overridden_at,
            stage: "ar",
            severity: "warning",
            title: "Billing override applied",
            detail: o.override_reason,
            actor: o.overridden_by ? nameMap.get(o.overridden_by) : undefined,
          });
        }

        // Trip status history (internal)
        for (const s of (tripStatusRes.data ?? []) as any[]) {
          events.push({
            id: `tsh-${s.id}`,
            at: s.changed_at,
            stage: "status",
            severity: "muted",
            title: `Trip status: ${s.old_status ?? "—"} → ${s.new_status}`,
            actor: s.changed_by ? nameMap.get(s.changed_by) : "System",
            internal: true,
          });
        }

        // Audit logs (internal)
        for (const l of (auditRes.data ?? []) as any[]) {
          events.push({
            id: `audit-${l.id}`,
            at: l.created_at,
            stage: "internal",
            severity: "muted",
            title: `Audit: ${l.action}`,
            detail: l.notes ?? `${l.table_name}`,
            actor: l.actor_email,
            internal: true,
          });
        }

        events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        if (!cancelled) setData({ loading: false, events, error: null, claim });
      } catch (e: any) {
        if (!cancelled)
          setData({ loading: false, events: [], error: e?.message ?? String(e), claim: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [claimId]);

  return data;
}