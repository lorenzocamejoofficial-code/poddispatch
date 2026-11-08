import { describe, expect, it } from "vitest";
import { haversineMiles, travelFloorMinutes, type Coord } from "./geo-distance";

// Synthetic coordinates only — no real patient, facility, or trip data.
const ORIGIN: Coord = { lat: 33.749, lng: -84.388 };
// 10 miles of latitude: 1 deg lat = 3958.8 * pi / 180 = 69.088 miles.
const TEN_MILES_NORTH: Coord = { lat: 33.749 + 10 / 69.088, lng: -84.388 };

describe("haversineMiles (synthetic coords)", () => {
  it("is zero for the same point", () => {
    expect(haversineMiles(ORIGIN, ORIGIN)).toBe(0);
  });

  it("measures ~10 miles for a 10-mile latitude offset", () => {
    expect(haversineMiles(ORIGIN, TEN_MILES_NORTH)).toBeCloseTo(10, 1);
  });

  it("is symmetric", () => {
    expect(haversineMiles(ORIGIN, TEN_MILES_NORTH)).toBeCloseTo(
      haversineMiles(TEN_MILES_NORTH, ORIGIN),
      10,
    );
  });

  it("shrinks a longitude gap with latitude (converging meridians)", () => {
    const atEquator = haversineMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const atHighLat = haversineMiles({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(atEquator).toBeGreaterThan(atHighLat);
    expect(atHighLat).toBeCloseTo(atEquator / 2, 0);
  });

  it("returns NaN instead of throwing for invalid coords", () => {
    expect(haversineMiles({ lat: NaN, lng: 0 }, ORIGIN)).toBeNaN();
    expect(haversineMiles(ORIGIN, { lat: 91, lng: 0 })).toBeNaN();
  });

  it("does not mutate its inputs", () => {
    const a = Object.freeze({ lat: 33.749, lng: -84.388 });
    const b = Object.freeze({ lat: 34.0, lng: -84.4 });
    haversineMiles(a, b);
    expect(a).toEqual({ lat: 33.749, lng: -84.388 });
    expect(b).toEqual({ lat: 34.0, lng: -84.4 });
  });
});

describe("travelFloorMinutes (synthetic coords)", () => {
  it("is 0 minutes for the same point", () => {
    expect(travelFloorMinutes(ORIGIN, ORIGIN)).toBe(0);
  });

  it("gives ~26 minutes for ~10 miles at defaults (10 * 1.3 / 30 * 60)", () => {
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH)).toBe(26);
  });

  it("returns null when either coord is missing", () => {
    expect(travelFloorMinutes(null, ORIGIN)).toBeNull();
    expect(travelFloorMinutes(ORIGIN, undefined)).toBeNull();
    expect(travelFloorMinutes(null, undefined)).toBeNull();
  });

  it.each([
    ["NaN lat", { lat: NaN, lng: -84.388 }],
    ["NaN lng", { lat: 33.749, lng: NaN }],
    ["lat above 90", { lat: 90.5, lng: -84.388 }],
    ["lat below -90", { lat: -91, lng: -84.388 }],
    ["lng above 180", { lat: 33.749, lng: 180.5 }],
    ["lng below -180", { lat: 33.749, lng: -181 }],
    ["Infinity lat", { lat: Infinity, lng: -84.388 }],
  ])("treats %s as missing", (_label, bad: Coord) => {
    expect(travelFloorMinutes(bad, ORIGIN)).toBeNull();
    expect(travelFloorMinutes(ORIGIN, bad)).toBeNull();
  });

  it("accepts the range edges as valid", () => {
    expect(travelFloorMinutes({ lat: -90, lng: -180 }, { lat: 90, lng: 180 })).toBeGreaterThan(0);
  });

  it("halves the floor when the speed doubles", () => {
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { speedMph: 60 })).toBe(13);
  });

  it("drops the circuity markup when the factor is 1", () => {
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { circuityFactor: 1 })).toBe(20);
  });

  it("applies both overrides together", () => {
    // 10 * 2.0 / 20 * 60 = 60
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { speedMph: 20, circuityFactor: 2 })).toBe(60);
  });

  it("falls back to defaults for a non-positive or non-finite override", () => {
    const expected = travelFloorMinutes(ORIGIN, TEN_MILES_NORTH);
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { speedMph: 0 })).toBe(expected);
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { speedMph: -30 })).toBe(expected);
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { circuityFactor: NaN })).toBe(expected);
    expect(travelFloorMinutes(ORIGIN, TEN_MILES_NORTH, { circuityFactor: Infinity })).toBe(expected);
  });

  it("is a floor, never a negative estimate", () => {
    const floor = travelFloorMinutes(ORIGIN, { lat: 34.1, lng: -84.2 });
    expect(floor).toBeGreaterThanOrEqual(0);
  });
});
