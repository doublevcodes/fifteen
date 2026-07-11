import { describe, expect, it } from "vitest";
import {
  mockTflJourneyFarePence,
  parseTflFareFromProofBytes,
  parseTflFareFromText,
} from "./tfl-fare";

describe("parseTflFareFromText", () => {
  it("prefers journey charge lines", () => {
    expect(
      parseTflFareFromText(
        "Surbiton to Waterloo\nJourney charge: £4.80\nDaily cap £8.90",
      ),
    ).toBe(480);
  });

  it("falls back to the last pound amount", () => {
    expect(parseTflFareFromText("Cap £14.10\nThis journey £3.50")).toBe(350);
  });

  it("returns null when no fare present", () => {
    expect(parseTflFareFromText("No amounts here")).toBeNull();
  });
});

describe("parseTflFareFromProofBytes", () => {
  it("reads fare embedded in proof bytes", () => {
    const bytes = Buffer.from(
      "TfL journey\nJourney charge: £6.20\n",
      "utf8",
    );
    expect(parseTflFareFromProofBytes(bytes, "text/plain")).toBe(620);
  });
});

describe("mockTflJourneyFarePence", () => {
  it("is stable for the same journey", () => {
    const a = mockTflJourneyFarePence({
      originCrs: "SUR",
      destinationCrs: "WAT",
      runDate: "2026-07-11",
    });
    const b = mockTflJourneyFarePence({
      originCrs: "SUR",
      destinationCrs: "WAT",
      runDate: "2026-07-11",
    });
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(240);
    expect(a).toBeLessThanOrEqual(1280);
  });
});
