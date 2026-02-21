/**
 * Global feature flags for PodDispatch.
 * Flip PAYMENTS_ENABLED to true when Stripe is connected and ready.
 */
export const FEATURE_FLAGS = {
  /** When false, payment verification is bypassed and subscription_status defaults to TEST_ACTIVE */
  PAYMENTS_ENABLED: false,
} as const;
