/** Dev-only fixture: NEMSIS 2026 EMS 3 (Fire), mapped from the official reference. No PHI. */
import { loadEmsReference } from "./from-reference";

export const { input: EMS3_INPUT, ctx: EMS3_CTX } = loadEmsReference("2026-EMS-3-Fire_v351.xml");
