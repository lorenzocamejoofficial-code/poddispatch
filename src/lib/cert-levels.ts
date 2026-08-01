export const CERT_LEVELS = ["EMR", "EMT-B", "EMT-A", "EMT-P"] as const;

export type CertLevel = (typeof CERT_LEVELS)[number];