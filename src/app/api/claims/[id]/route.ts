import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const event = await prisma.delayEvent.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ event });
}
