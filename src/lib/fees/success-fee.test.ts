import { describe, expect, it } from "vitest";
import {
  CHARITY_SHARE_OF_FEE,
  PLATFORM_FEE_RATE,
  calculatePayoutSplit,
  calculateSuccessFee,
  penceToMollieAmount,
} from "./success-fee";

describe("calculatePayoutSplit", () => {
  it("on £10 DR: user £8, fee £2, charity £0.50 (25% of fee), Fifteen £1.50", () => {
    expect(calculatePayoutSplit(1000)).toEqual({
      compensationAmountPence: 1000,
      userPayoutPence: 800,
      platformFeePence: 200,
      commissionPence: 150,
      charityPence: 50,
    });
  });

  it("uses 20% platform fee and 25% of fee to charity", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.2);
    expect(CHARITY_SHARE_OF_FEE).toBe(0.25);
  });

  it("parts always sum to compensation", () => {
    for (const pence of [0, 1, 7, 99, 333, 1000, 12345]) {
      const s = calculatePayoutSplit(pence);
      expect(s.userPayoutPence + s.platformFeePence).toBe(s.compensationAmountPence);
      expect(s.commissionPence + s.charityPence).toBe(s.platformFeePence);
    }
  });
});

describe("calculateSuccessFee (compat)", () => {
  it("maps to fee / commission / charity", () => {
    expect(calculateSuccessFee(1000)).toEqual({
      compensationAmountPence: 1000,
      commissionPence: 150,
      charityPence: 50,
      totalFeePence: 200,
    });
  });
});

describe("penceToMollieAmount", () => {
  it("formats pence as GBP decimal string", () => {
    expect(penceToMollieAmount(200)).toBe("2.00");
    expect(penceToMollieAmount(50)).toBe("0.50");
  });
});
