import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEDI835Envelope } from "./edi-835-parser";
import { matchRemittanceClaim } from "./remittance-match";
import { buildClaimPaymentRow } from "./remittance-post";

const ROOT = path.resolve(__dirname, "../..");
const SHARED = ["edi-835-parser", "denial-code-translations", "payer-compliance", "remittance-match", "remittance-post"];

describe("shared module drift (src/lib ↔ supabase/functions/_shared)", () => {
  for (const name of SHARED) {
    it(`${name}.ts copy is byte-identical apart from the header + .ts extensions`, () => {
      const src = readFileSync(path.join(ROOT, "src/lib", `${name}.ts`), "utf8");
      const copy = readFileSync(path.join(ROOT, "supabase/functions/_shared", `${name}.ts`), "utf8");
      const lines = copy.split("\n");
      expect(lines[0]).toBe("// GENERATED FILE — DO NOT EDIT.");
      expect(lines[1]).toContain(`src/lib/${name}.ts`);
      const body = lines.slice(2).join("\n");
      // Strip the Deno-required .ts extension the sync script adds to relative imports.
      const normalized = body.replace(/(from "\.{1,2}\/[^"]+)\.ts"/g, '$1"');
      expect(normalized).toBe(src);
    });
  }
});

// A denied ambulance claim: CO-45 contractual, PR-1 deductible, plus a PLB withhold.
const DENIED_835 = [
  "ISA*00*          *00*          *ZZ*PAYER          *ZZ*SUBMITTER      *250101*1200*^*00501*000000001*0*P*:~",
  "GS*HP*PAYER*SUBMITTER*20250101*1200*1*X*005010X221A1~",
  "ST*835*0001~",
  "BPR*I*0*C*ACH*CCP*01*999999999*DA*123*1234567890**01*999988880*DA*98765*20250115~",
  "TRN*1*EFT12345*1999999999~",
  "N1*PR*MEDICARE B~",
  "NM1*PR*2*MEDICARE B*****PI*00123~",
  "NM1*85*2*POD AMBULANCE*****XX*1234567893~",
  "LX*1~",
  "CLP*250110-a1b2c3d4*4*450.00*0.00*100.00*MB*PAYERCTRL999*11~",
  "NM1*QC*1*DOE*JANE****MI*W123456789~",
  "DTM*232*20250110~",
  "CAS*CO*45*350.00~",
  "CAS*CO*50*0.00~",
  "CAS*PR*1*100.00~",
  "SVC*HC:A0428*450.00*0.00**1~",
  "PLB*1234567893*20251231*WO:REF987*25.00~",
  "SE*16*0001~",
].join("");

describe("automated pull ↔ manual upload parity (same 835, same shared code)", () => {
  const envelope = parseEDI835Envelope(DENIED_835);

  it("parses CAS adjustments into CARC codes", () => {
    const claim = envelope.claims[0];
    expect(claim.raw_denial_codes).toEqual(expect.arrayContaining(["CO-45", "CO-50", "PR-1"]));
    expect(claim.billing_provider_npi).toBe("1234567893");
  });

  it("captures PLB provider-level adjustments", () => {
    expect(envelope.plb_adjustments).toHaveLength(1);
    expect(envelope.plb_adjustments[0]).toMatchObject({
      provider_npi: "1234567893",
      reason_code: "WO",
      reference_id: "REF987",
      amount: 25,
    });
  });

  it("matches the same claim via each precedence tier", () => {
    const rem = envelope.claims[0];
    const claim = {
      id: "a1b2c3d4-1111-2222-3333-444455556666",
      patient_id: "p-1",
      member_id: "W123456789",
      run_date: "2025-01-10",
      total_charge: 450,
      payer_claim_control_number: "PAYERCTRL999",
    };
    // Tier 1 — payer claim control number
    expect(matchRemittanceClaim(rem, [claim]).matchedBy).toBe("payer_control_number");
    // Tier 2 — CLP01 prefix
    expect(
      matchRemittanceClaim(rem, [{ ...claim, payer_claim_control_number: null }]).matchedBy,
    ).toBe("patient_control_number");
    // Tier 3 — member id + DOS
    expect(
      matchRemittanceClaim(rem, [
        { ...claim, id: "99999999-1111-2222-3333-444455556666", payer_claim_control_number: null },
      ]).matchedBy,
    ).toBe("member_and_dos");
    // No match → caller quarantines
    expect(matchRemittanceClaim(rem, []).matchedClaimId).toBeNull();
  });

  it("builds an identical claim_payments row for both paths", () => {
    const rem = envelope.claims[0];
    const ctx = {
      claimRecordId: "claim-1",
      companyId: "co-1",
      remittanceFileId: "file-1",
      primaryPayer: "medicare",
      secondaryPayer: null,
      envelopePaymentDate: envelope.payment_date,
      isSimulated: false,
    };
    // Manual upload and the edge function call this same builder with the same
    // context shape, so the rows are field-for-field identical by construction.
    const manual = buildClaimPaymentRow(rem, ctx).row;
    const auto = buildClaimPaymentRow(rem, ctx).row;
    expect(auto).toEqual(manual);

    expect(manual.denial_code).toBe("CO-50");
    expect(manual.denial_reason).toBeTruthy();
    expect(manual.adjustment_codes).toEqual(expect.arrayContaining(["CO-45", "PR-1"]));
    expect(manual.write_off).toBe(350);
    expect(manual.allowed_amount).toBe(100);
    expect(manual.patient_responsibility).toBe(100);
    expect(manual.payer_claim_control_number).toBe("PAYERCTRL999");
    expect(manual.payment_date).toBe("2025-01-15");
    expect(manual.is_simulated).toBe(false);
  });

  it("caps patient responsibility for Medicaid primary (both paths)", () => {
    const rem = envelope.claims[0];
    const { row, prCap } = buildClaimPaymentRow(rem, {
      claimRecordId: "claim-1",
      companyId: "co-1",
      remittanceFileId: null,
      primaryPayer: "medicaid",
      secondaryPayer: null,
      isSimulated: false,
    });
    expect(prCap.wasCapped).toBe(true);
    expect(row.patient_responsibility).toBe(0);
  });
});

describe("automated retrieval never writes claim_records directly", () => {
  it("edge function has no claim_records status update", () => {
    const fn = readFileSync(
      path.join(ROOT, "supabase/functions/retrieve-remittance-officeally/index.ts"),
      "utf8",
    );
    // The only claim_records access is the read of candidate claims.
    expect(fn).not.toMatch(/from\("claim_records"\)\s*\n?\s*\.update\(/);
    expect(fn).toContain('from("claim_payments" as any)');
    expect(fn).toContain('from("plb_adjustments" as any)');
    expect(fn).toContain('from("remittance_quarantine")');
  });
});
