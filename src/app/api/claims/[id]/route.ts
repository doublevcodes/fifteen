import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSuccessFeeForEvent } from "@/lib/mollie/create-success-fee-payment";

const patchSchema = z.object({
  status: z.enum([
    "unclaimed",
    "copied",
    "detected",
    "eligible",
    "fetching_proof",
    "submitting",
    "submitted",
    "failed",
    "needs_attention",
  ]),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await prisma.delayEvent.findFirst({
    where: { id, userId: user.id },
    include: { successFee: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(req: Request, { params }: Params) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.delayEvent.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const becomingSubmitted =
    parsed.data.status === "submitted" && existing.status !== "submitted";

  const event = await prisma.delayEvent.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(becomingSubmitted && !existing.submittedAt
        ? { submittedAt: new Date() }
        : {}),
    },
    include: { successFee: true },
  });

  let successFee = event.successFee;
  if (becomingSubmitted) {
    await ensureSuccessFeeForEvent(id, { swallowErrors: true });
    successFee = await prisma.successFee.findUnique({
      where: { delayEventId: id },
    });
  }

  return NextResponse.json({ event: { ...event, successFee } });
}
