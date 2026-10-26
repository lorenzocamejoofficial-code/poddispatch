/**
 * Who on a trial-expired company may see the payment call-to-action.
 * Only the account owner (or a system creator) can actually pay; everyone
 * else gets a "contact your account owner" message instead of a dead-end checkout.
 */
export type TrialExpiredView = "pay" | "contact_owner";

export function trialExpiredView(opts: { isOwnerOrCreator: boolean; isSystemCreator?: boolean }): TrialExpiredView {
  return opts.isOwnerOrCreator || opts.isSystemCreator ? "pay" : "contact_owner";
}
