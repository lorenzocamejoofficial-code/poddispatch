/**
 * submission-mode
 * ---------------
 * ONE definition of "does this company submit live or test EDI".
 *
 * A company is a TEST company when it is a creator-side sandbox or a
 * creator test tenant (`companies.is_sandbox` / `companies.creator_test_tenant`,
 * both boolean NOT NULL DEFAULT false). Everything else — every company that
 * came through signup/approval — is LIVE and can never emit a test envelope.
 *
 * Nothing else participates in the decision: not a per-claim `is_simulated`
 * flag, not the batch contents, not the global vendor `test_mode` setting,
 * not any user-facing toggle.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SubmissionMode {
  /** true => OATEST envelope (ISA15=T). false => live production (ISA15=P). */
  isTest: boolean;
  /** "TEST (OATEST)" / "LIVE" — for UI labeling. */
  label: string;
}

export function isTestCompanyRow(
  company: { is_sandbox?: boolean | null; creator_test_tenant?: boolean | null } | null | undefined,
): boolean {
  return !!(company?.is_sandbox || company?.creator_test_tenant);
}

export async function fetchSubmissionMode(companyId: string | null | undefined): Promise<SubmissionMode> {
  if (!companyId) return { isTest: false, label: "LIVE" };
  const { data } = await supabase
    .from("companies")
    .select("is_sandbox, creator_test_tenant")
    .eq("id", companyId)
    .maybeSingle();
  const isTest = isTestCompanyRow(data as any);
  return { isTest, label: isTest ? "TEST (OATEST)" : "LIVE" };
}
