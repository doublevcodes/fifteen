import { describe, expect, it } from "vitest";
import { calculateCompensation } from "./dr15";

describe("calculateCompensation", () => {
  it("returns not eligible under 15 minutes", () => {
    const result = calculateCompensation({
      operator: "SWR",
      delayMinutes: 14,
      ticketPricePence: 1000,
      ticketType: "single",
    });
    expect(result).toMatchObject({
      eligible: false,
      tier: "none",
      compensationAmountPence: 0,
    });
  });

  it("applies single ticket bands", () => {
    const base = {
      operator: "SOUTHERN" as const,
      ticketPricePence: 1000,
      ticketType: "single" as const,
    };
    expect(
      calculateCompensation({ ...base, delayMinutes: 15 }).compensationAmountPence,
    ).toBe(250);
    expect(
      calculateCompensation({ ...base, delayMinutes: 30 }).compensationAmountPence,
    ).toBe(500);
    expect(
      calculateCompensation({ ...base, delayMinutes: 60 }).compensationAmountPence,
    ).toBe(1000);
    expect(
      calculateCompensation({ ...base, delayMinutes: 120 }).compensationAmountPence,
    ).toBe(1000);
  });

  it("treats contactless like single using TfL fare", () => {
    expect(
      calculateCompensation({
        operator: "SWR",
        delayMinutes: 22,
        ticketPricePence: 840,
        ticketType: "contactless",
      }).compensationAmountPence,
    ).toBe(210);
  });

  it("applies return ticket bands against full return price", () => {
    const base = {
      operator: "SOUTHEASTERN" as const,
      ticketPricePence: 2000,
      ticketType: "return" as const,
    };
    expect(
      calculateCompensation({ ...base, delayMinutes: 20 }).compensationAmountPence,
    ).toBe(250); // 12.5%
    expect(
      calculateCompensation({ ...base, delayMinutes: 45 }).compensationAmountPence,
    ).toBe(500); // 25%
    expect(
      calculateCompensation({ ...base, delayMinutes: 90 }).compensationAmountPence,
    ).toBe(1000); // 50%
    expect(
      calculateCompensation({ ...base, delayMinutes: 150 }).compensationAmountPence,
    ).toBe(2000); // 100%
  });

  it("computes season journey rate with weekly divisor", () => {
    // £150 weekly → £15 journey rate
    const result = calculateCompensation({
      operator: "SWR",
      delayMinutes: 20,
      ticketPricePence: 15000,
      ticketType: "season_weekly",
    });
    expect(result.journeyRatePence).toBe(1500);
    expect(result.compensationAmountPence).toBe(375); // 25% of £15
    expect(result.tier).toBe("15-29");
  });

  it("pays return journey rate for season at 120+", () => {
    const result = calculateCompensation({
      operator: "SWR",
      delayMinutes: 120,
      ticketPricePence: 15000,
      ticketType: "season_weekly",
    });
    expect(result.compensationAmountPence).toBe(3000); // 2 × £15
  });

  it("uses monthly and annual divisors", () => {
    expect(
      calculateCompensation({
        operator: "SOUTHERN",
        delayMinutes: 45,
        ticketPricePence: 40000,
        ticketType: "season_monthly",
      }).compensationAmountPence,
    ).toBe(500); // 50% of 40000/40

    expect(
      calculateCompensation({
        operator: "SOUTHEASTERN",
        delayMinutes: 70,
        ticketPricePence: 464000,
        ticketType: "season_annual",
      }).compensationAmountPence,
    ).toBe(1000); // 100% of 464000/464
  });

  it("rejects unsupported operators and invalid prices", () => {
    expect(
      calculateCompensation({
        // @ts-expect-error intentional
        operator: "GWR",
        delayMinutes: 30,
        ticketPricePence: 1000,
        ticketType: "single",
      }).eligible,
    ).toBe(false);

    expect(
      calculateCompensation({
        operator: "SWR",
        delayMinutes: 30,
        ticketPricePence: 0,
        ticketType: "single",
      }).eligible,
    ).toBe(false);
  });
});
