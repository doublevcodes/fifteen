import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { claimDelayRepayWorkflow } from "@/workflows/claim-delay-repay";

type Params = { params: Promise<{ id: string }> };

const RETRYABLE = new Set([
  "needs_attention",
  "failed",
  "unclaimed",
  "detected",
  "eligible",
  "copied",
]);

export async function POST(_req: Request, { params }: Params) {
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

  if (!RETRYABLE.has(event.status)) {
    return NextResponse.json(
      { error: `Cannot retry from status ${event.status}` },
      { status: 409 },
    );
  }

  const profile = await prisma.claimProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile?.autoSubmitConsent) {
    return NextResponse.json(
      { error: "Enable auto-submit consent in settings first." },
      { status: 400 },
    );
  }

  await prisma.delayEvent.update({
    where: { id },
    data: { status: "detected", submitError: null },
  });

  const run = await start(claimDelayRepayWorkflow, [
    { userId: user.id, delayEventId: id },
  ]);

  await prisma.delayEvent.update({
    where: { id },
    data: { workflowRunId: run.runId },
  });

  return NextResponse.json({ runId: run.runId, eventId: id });
}
