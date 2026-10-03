import { describe, it, expect } from "vitest";
import { DEM1_SUBMISSION_XML, DEM1_SUBMISSION_SECTIONS } from "./dem1-submission";

describe("DEM 1 submission XML", () => {
  it("starts with the XML declaration and DEMDataSet root", () => {
    expect(DEM1_SUBMISSION_XML.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(DEM1_SUBMISSION_XML).toContain('<DEMDataSet xmlns="http://www.nemsis.org"');
    expect(DEM1_SUBMISSION_XML.trimEnd().endsWith("</DEMDataSet>")).toBe(true);
  });

  it("has all 9 top-level sections in order inside DemographicReport", () => {
    let last = -1;
    for (const sec of DEM1_SUBMISSION_SECTIONS) {
      const idx = DEM1_SUBMISSION_XML.indexOf(`<${sec}>`);
      expect(idx, `missing <${sec}>`).toBeGreaterThan(-1);
      expect(idx, `<${sec}> out of order`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("keeps the placeholder timestamp for Pass 4 to replace", () => {
    expect(DEM1_SUBMISSION_XML).toContain('<DemographicReport timeStamp="2026-01-15T08:00:00-05:00">');
  });

  it("has balanced open/close tags (well-formedness smoke check)", () => {
    const tags = DEM1_SUBMISSION_XML.match(/<\/?[A-Za-z][^>]*>/g) ?? [];
    const stack: string[] = [];
    for (const tag of tags) {
      if (tag.endsWith("/>")) continue; // self-closed
      const name = tag.replace(/^<\/?/, "").split(/[\s>]/)[0];
      if (tag.startsWith("</")) {
        expect(stack.pop(), `unmatched closing ${tag}`).toBe(name);
      } else {
        stack.push(name);
      }
    }
    expect(stack, "unclosed tags remain").toEqual([]);
  });
});
