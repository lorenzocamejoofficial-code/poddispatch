/** Dev-only fixture: NEMSIS 2026 EMS 5 (Evacuation), mapped from the official reference. No PHI. */
import { loadEmsReference } from "./from-reference";

export const { input: EMS5_INPUT, ctx: EMS5_CTX } = loadEmsReference("2026-EMS-5-Evacuation_v351.xml");
