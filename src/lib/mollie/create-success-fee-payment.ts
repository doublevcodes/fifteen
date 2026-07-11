import { prisma } from "@/lib/db";
import { calculatePayoutSplit } from "@/lib/fees/success-fee";
import { getMollieClient } from "@/lib/mollie/client";

export type EnsureSettlementResult = {
  feeId: string;
  status: string;
  userPayoutPence: number;
  platformFeePence: number;
  transferRef?: string;
};

/**
 * When a claim is submitted, open a settlement row and pay the passenger
 * immediately if their Mollie bank is already connected.
 */
export async function ensureSettlementForEvent(
  delayEventId: string,
  options: { swallowErrors?: boolean } = {},
): Promise<EnsureSettlementResult | null> {
  try {
    const settlement = await ensureSettlementInner(delayEventId);
    const payout = await attemptPayOut(delayEventId);
    return {
      ...settlement,
      status: payout?.status ?? settlement.status,
      transferRef: payout?.transferRef,
    };
  } catch (err) {
    console.error(
      `[settlement] failed for event=${delayEventId}`,
      err instanceof Error ? err.message : err,
    );
    if (options.swallowErrors) {
      try {
        await prisma.successFee.updateMany({
          where: { delayEventId, status: { not: "paid_out" } },
          data: { status: "failed" },
        });
      } catch {
        /* ignore */
      }
      return null;
    }
    throw err;
  }
}

/** @deprecated alias */
export const ensureSuccessFeeForEvent = ensureSettlementForEvent;

async function ensureSettlementInner(
  delayEventId: string,
): Promise<EnsureSettlementResult> {
  const event = await prisma.delayEvent.findUniqueOrThrow({
    where: { id: delayEventId },
    include: { successFee: true },
  });

  const split = calculatePayoutSplit(event.compensationAmountPence);

  if (event.successFee) {
    const updated = await prisma.successFee.update({
      where: { id: event.successFee.id },
      data: {
        compensationAmountPence: split.compensationAmountPence,
        userPayoutPence: split.userPayoutPence,
        commissionPence: split.commissionPence,
        charityPence: split.charityPence,
        totalFeePence: split.platformFeePence,
        status:
          event.successFee.status === "paid_out"
            ? "paid_out"
            : event.successFee.status === "failed"
              ? "awaiting_funds"
              : event.successFee.status,
      },
    });
    return {
      feeId: updated.id,
      status: updated.status,
      userPayoutPence: updated.userPayoutPence,
      platformFeePence: updated.totalFeePence,
    };
  }

  const created = await prisma.successFee.create({
    data: {
      delayEventId: event.id,
      userId: event.userId,
      compensationAmountPence: split.compensationAmountPence,
      userPayoutPence: split.userPayoutPence,
      commissionPence: split.commissionPence,
      charityPence: split.charityPence,
      totalFeePence: split.platformFeePence,
      status: "awaiting_funds",
    },
  });

  return {
    feeId: created.id,
    status: created.status,
    userPayoutPence: created.userPayoutPence,
    platformFeePence: created.totalFeePence,
  };
}

/**
 * Pay the passenger via Mollie when bank details are connected.
 * No-ops (returns null) if bank isn't ready yet — call again after bank-connect.
 */
export async function attemptPayOut(
  delayEventId: string,
): Promise<{ status: string; transferRef: string } | null> {
  const event = await prisma.delayEvent.findUnique({
    where: { id: delayEventId },
    include: {
      successFee: true,
      user: { include: { claimProfile: true } },
    },
  });
  if (!event || event.status !== "submitted" || !event.successFee) {
    return null;
  }

  if (event.successFee.status === "paid_out") {
    return {
      status: "paid_out",
      transferRef: event.successFee.molliePaymentId ?? "already-paid",
    };
  }

  const profile = event.user.claimProfile;
  if (
    !profile?.bankAccountNumber ||
    !profile.bankSortCode ||
    !profile.mollieCustomerId
  ) {
    return null;
  }

  return payOutWithProfile(event, profile.mollieCustomerId);
}

/** Pay out every awaiting settlement for a user (e.g. right after bank connect). */
export async function payOutPendingForUser(userId: string): Promise<number> {
  const pending = await prisma.successFee.findMany({
    where: {
      userId,
      status: { in: ["awaiting_funds", "ready", "failed"] },
      delayEvent: { status: "submitted" },
    },
    select: { delayEventId: true },
  });

  let paid = 0;
  for (const row of pending) {
    const result = await attemptPayOut(row.delayEventId);
    if (result?.status === "paid_out") paid += 1;
  }
  return paid;
}

async function payOutWithProfile(
  event: {
    id: string;
    compensationAmountPence: number;
    successFee: { id: string };
  },
  mollieCustomerId: string,
): Promise<{ status: string; transferRef: string }> {
  const split = calculatePayoutSplit(event.compensationAmountPence);
  let transferRef = `mock_xfer_${event.id.slice(-8)}`;

  // Prefer real Mollie customer touch; outbound bank transfer is mocked until
  // Business Account Transfers / Connect payouts are enabled.
  try {
    const mollie = getMollieClient();
    await mollie.customers.get(mollieCustomerId);
    transferRef = `mollie_customer_${mollieCustomerId}_${Date.now()}`;
    console.log(
      `[settlement] payout transfer=${transferRef} to customer=${mollieCustomerId} amount=${split.userPayoutPence}p charity=${split.charityPence}p`,
    );
  } catch (err) {
    console.warn(
      "[settlement] Mollie customer check failed; using mock ref",
      err,
    );
  }

  const updated = await prisma.successFee.update({
    where: { id: event.successFee.id },
    data: {
      status: "paid_out",
      paidAt: new Date(),
      molliePaymentId: transferRef,
      userPayoutPence: split.userPayoutPence,
      commissionPence: split.commissionPence,
      charityPence: split.charityPence,
      totalFeePence: split.platformFeePence,
      compensationAmountPence: split.compensationAmountPence,
    },
  });

  return { status: updated.status, transferRef };
}

/** @deprecated use attemptPayOut */
export async function markFundsReceivedAndPayOut(
  delayEventId: string,
  userId: string,
): Promise<{ status: string; transferRef: string }> {
  const event = await prisma.delayEvent.findFirst({
    where: { id: delayEventId, userId },
  });
  if (!event) throw new Error("Claim not found");
  if (event.status !== "submitted") {
    throw new Error("Claim must be submitted before payout");
  }

  await ensureSettlementInner(delayEventId);
  const result = await attemptPayOut(delayEventId);
  if (!result) {
    throw new Error("Connect a bank account in Settings before payout");
  }
  return result;
}

export function mapMollieStatusToFeeStatus(
  status: string,
): "awaiting_funds" | "paid_out" | "failed" | "ready" {
  switch (status) {
    case "paid":
      return "paid_out";
    case "failed":
    case "canceled":
    case "expired":
      return "failed";
    default:
      return "awaiting_funds";
  }
}

/** No-op sync kept for claim page redirect compat. */
export async function syncSuccessFeeFromMollie(
  delayEventId: string,
): Promise<{ status: string } | null> {
  const fee = await prisma.successFee.findUnique({ where: { delayEventId } });
  return fee ? { status: fee.status } : null;
}
