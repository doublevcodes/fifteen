import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attemptPayOut } from "@/lib/mollie/create-success-fee-payment";

type Params = { params: Promise<{ delayEventId: string }> };

/** Internal/retry: attempt automatic passenger payout for a submitted claim. */
export async function POST(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { delayEventId } = await params;
  try {
    const event = await prisma.delayEvent.findFirst({
      where: { id: delayEventId, userId: user.id },
    });
    if (!event) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await attemptPayOut(delayEventId);
    if (!result) {
      return NextResponse.json(
        { error: "Connect a bank account in Settings before payout" },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payout failed" },
      { status: 400 },
    );
  }
}
