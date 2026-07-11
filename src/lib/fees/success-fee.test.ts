import { describe, expect, it } from "vitest";
import {
  CHARITY_RATE,
  COMMISSION_RATE,
  PLATFORM_FEE_RATE,
  USER_PAYOUT_RATE,
  calculatePayoutSplit,
  calculateSuccessFee,
  penceToMollieAmount,
} from "./success-fee";

describe("calculatePayoutSplit", () => {
  it("on £10 DR: user £7.50, Fifteen £2, charity £0.50", () => {
    expect(calculatePayoutSplit(1000)).toEqual({
      compensationAmountPence: 1000,
      userPayoutPence: 750,
      platformFeePence: 250,
      commissionPence: 200,
      charityPence: 50,
    });
  });

  it("uses 75% user / 20% Fifteen / 5% charity", () => {
    expect(USER_PAYOUT_RATE).toBe(0.75);
    expect(COMMISSION_RATE).toBe(0.2);
    expect(CHARITY_RATE).toBe(0.05);
    expect(PLATFORM_FEE_RATE).toBe(0.25);
  });

  it("parts always sum to compensation", () => {
    for (const pence of [0, 1, 7, 99, 333, 1000, 12345]) {
      const s = calculatePayoutSplit(pence);
      expect(s.userPayoutPence + s.platformFeePence).toBe(
        s.compensationAmountPence,
      );
      expect(s.commissionPence + s.charityPence).toBe(s.platformFeePence);
    }
  });
});

describe("calculateSuccessFee (compat)", () => {
  it("maps to fee / commission / charity", () => {
    expect(calculateSuccessFee(1000)).toEqual({
      compensationAmountPence: 1000,
      commissionPence: 200,
      charityPence: 50,
      totalFeePence: 250,
    });
  });
});

describe("penceToMollieAmount", () => {
  it("formats pence as GBP decimal string", () => {
    expect(penceToMollieAmount(200)).toBe("2.00");
    expect(penceToMollieAmount(50)).toBe("0.50");
  });
});
