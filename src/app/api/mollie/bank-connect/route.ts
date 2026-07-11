import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMollieClient } from "@/lib/mollie/client";
import { payOutPendingForUser } from "@/lib/mollie/create-success-fee-payment";

const bodySchema = z.object({
  bankAccountName: z.string().trim().min(1, "Account name is required").max(120),
  bankSortCode: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Sort code must be 6 digits")),
  bankAccountNumber: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Account number must be 8 digits")),
});

/**
 * Connect passenger bank details and create/update a Mollie Customer for payouts.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const { bankAccountName, bankSortCode, bankAccountNumber } = parsed.data;

  let mollieCustomerId: string | null = null;
  try {
    const mollie = getMollieClient();
    const profile = await prisma.claimProfile.findUnique({
      where: { userId: user.id },
    });

    const metadata = {
      sortCode: bankSortCode,
      accountNumberLast4: bankAccountNumber.slice(-4),
      userId: user.id,
    };

    if (profile?.mollieCustomerId) {
      await mollie.customers.update(profile.mollieCustomerId, {
        name: bankAccountName,
        email: user.email ?? undefined,
        metadata,
      });
      mollieCustomerId = profile.mollieCustomerId;
    } else {
      const customer = await mollie.customers.create({
        name: bankAccountName,
        email: user.email ?? undefined,
        metadata,
      });
      mollieCustomerId = customer.id;
    }
  } catch (err) {
    console.error("[bank-connect]", err);
    const mollieMessage =
      err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : null;
    return NextResponse.json(
      {
        error:
          mollieMessage ??
          (err instanceof Error
            ? err.message
            : "Could not create Mollie customer"),
      },
      { status: 502 },
    );
  }

  const claimProfile = await prisma.claimProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      bankAccountName,
      bankSortCode,
      bankAccountNumber,
      mollieCustomerId,
      bankConnectedAt: new Date(),
      payoutPreference: "bank",
    },
    update: {
      bankAccountName,
      bankSortCode,
      bankAccountNumber,
      mollieCustomerId,
      bankConnectedAt: new Date(),
      payoutPreference: "bank",
    },
  });

  let paidOutCount = 0;
  try {
    paidOutCount = await payOutPendingForUser(user.id);
  } catch (err) {
    console.warn("[bank-connect] pending payouts failed", err);
  }

  return NextResponse.json({
    ok: true,
    mollieCustomerId,
    bankConnectedAt: claimProfile.bankConnectedAt,
    bankAccountName: claimProfile.bankAccountName,
    bankSortCode: claimProfile.bankSortCode,
    bankAccountNumberLast4: bankAccountNumber.slice(-4),
    paidOutCount,
  });
}
