/** Dev-only fixture: NEMSIS 2026 EMS 4 (CanceledStandby), mapped from the official reference. No PHI. */
import { loadEmsReference } from "./from-reference";

export const { input: EMS4_INPUT, ctx: EMS4_CTX } = loadEmsReference("2026-EMS-4-CanceledStandby_v351.xml");
