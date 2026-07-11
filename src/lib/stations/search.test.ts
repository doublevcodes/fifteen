import { describe, expect, it } from "vitest";
import { searchStations } from "./search";

describe("searchStations", () => {
  it("finds stations by partial name", () => {
    const results = searchStations("waterloo");
    expect(results.some((s) => s.crsCode === "WAT")).toBe(true);
  });

  it("finds stations by CRS", () => {
    const results = searchStations("SUR");
    expect(results[0]?.crsCode).toBe("SUR");
  });

  it("returns empty for short queries", () => {
    expect(searchStations("a")).toEqual([]);
  });
});
