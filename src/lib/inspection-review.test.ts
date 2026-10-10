import { describe, it, expect } from "vitest";
import { canMarkReviewed, checkoffStatus, checkoffBanner, reviewedNotificationMessage } from "./inspection-review";

describe("truck checkoff review", () => {
  it("blocks Mark Reviewed while any flagged item is unanswered", () => {
    expect(canMarkReviewed([{ dispatcher_response: "cleared" }, { dispatcher_response: null }])).toBe(false);
  });
  it("allows Mark Reviewed once every flag is Cleared or Hold", () => {
    expect(canMarkReviewed([{ dispatcher_response: "cleared" }, { dispatcher_response: "hold" }])).toBe(true);
  });
  it("Hold still allows review but shows the red crew banner", () => {
    const alerts = [{ dispatcher_response: "hold" }];
    expect(canMarkReviewed(alerts)).toBe(true);
    expect(checkoffBanner({ missing_count: 1, reviewed_at: "2026-10-10T08:00:00Z" }, alerts)).toBe("red");
  });
  it("crew banner is yellow when submitted but not reviewed, green when reviewed", () => {
    expect(checkoffBanner({ missing_count: 0, reviewed_at: null }, [])).toBe("yellow");
    expect(checkoffBanner({ missing_count: 0, reviewed_at: "2026-10-10T08:00:00Z" }, [])).toBe("green");
  });
  it("derives the four dispatch statuses", () => {
    expect(checkoffStatus(null, [])).toBe("not_submitted");
    expect(checkoffStatus({ missing_count: 0, reviewed_at: null }, [])).toBe("awaiting_review");
    expect(checkoffStatus({ missing_count: 2, reviewed_at: null }, [{ dispatcher_response: null }])).toBe("has_flags");
    expect(checkoffStatus({ missing_count: 0, reviewed_at: "2026-10-10T08:00:00Z" }, [])).toBe("reviewed");
  });
  it("notification message is stable per truck per day (dedupe key)", () => {
    expect(reviewedNotificationMessage("Unit 3", "2026-10-10")).toBe(reviewedNotificationMessage("Unit 3", "2026-10-10"));
    expect(reviewedNotificationMessage("Unit 3", "2026-10-10")).not.toBe(reviewedNotificationMessage("Unit 3", "2026-10-11"));
  });
});
