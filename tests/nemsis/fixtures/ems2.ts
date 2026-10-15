/** Dev-only fixture: NEMSIS 2026 EMS 2 (Drowning), mapped from the official reference. No PHI. */
import { loadEmsReference } from "./from-reference";

export const { input: EMS2_INPUT, ctx: EMS2_CTX } = loadEmsReference("2026-EMS-2-Drowning_v351.xml");
