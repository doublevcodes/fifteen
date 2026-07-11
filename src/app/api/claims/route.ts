import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { buildClaimSummary } from "@/lib/claims/summary";
import { prisma } from "@/lib/db";
import {
  calculateCompensation,
  type Operator,
  type TicketType,
} from "@/lib/eligibility/dr15";
import { claimDelayRepayWorkflow } from "@/workflows/claim-delay-repay";

const createSchema = z.object({
  operator: z.enum(["SWR", "SOUTHERN", "SOUTHEASTERN"]),
  originCrs: z.string().min(3).max(8),
  originName: z.string().min(1),
  destinationCrs: z.string().min(3).max(8),
  destinationName: z.string().min(1),
  serviceUid: z.string().min(1),
  runDate: z.string().min(8),
  scheduledArrival: z.string().min(1),
  actualArrival: z.string().min(1),
  delayMinutes: z.number().int().min(0),
  ticketType: z.enum([
    "single",
    "return",
    "contactless",
    "season_weekly",
    "season_flexi",
    "season_monthly",
    "season_quarterly",
    "season_annual",
  ]),
  ticketPricePence: z.number().int().nonnegative(),
});

export async function GET() {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.delayEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const unclaimedTotalPence = events
    .filter((e) => e.status !== "submitted")
    .reduce((sum, e) => sum + e.compensationAmountPence, 0);

  return NextResponse.json({ events, unclaimedTotalPence });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const isContactless = data.ticketType === "contactless";

    if (!isContactless && data.ticketPricePence <= 0) {
      return NextResponse.json(
        { error: "Ticket price is required" },
        { status: 400 },
      );
    }

    // Contactless fare comes from TfL proof during auto-submit; use a provisional
    // £0 until the workflow reads the journey charge.
    const provisionalPrice = isContactless ? 0 : data.ticketPricePence;

    let compensationTier = "pending";
    let compensationAmountPence = 0;
    let claimSummary = "";

    if (!isContactless) {
      const compensation = calculateCompensation({
        operator: data.operator as Operator,
        delayMinutes: data.delayMinutes,
        ticketPricePence: provisionalPrice,
        ticketType: data.ticketType as TicketType,
      });

      if (!compensation.eligible) {
        return NextResponse.json(
          {
            error: "Not eligible for Delay Repay",
            compensation,
          },
          { status: 422 },
        );
      }

      compensationTier = compensation.tier;
      compensationAmountPence = compensation.compensationAmountPence;
      claimSummary = buildClaimSummary({
        operator: data.operator,
        originName: data.originName,
        destinationName: data.destinationName,
        runDate: data.runDate,
        scheduledArrival: data.scheduledArrival,
        actualArrival: data.actualArrival,
        delayMinutes: data.delayMinutes,
        ticketType: data.ticketType,
        ticketPricePence: provisionalPrice,
        compensationTier: compensation.tier,
        compensationAmountPence: compensation.compensationAmountPence,
      });
    } else {
      if (data.delayMinutes < 15) {
        return NextResponse.json(
          { error: "Not eligible for Delay Repay — delay under 15 minutes" },
          { status: 422 },
        );
      }
      claimSummary = [
        `Delay Repay claim — contactless (PAYG)`,
        ``,
        `Journey date: ${data.runDate}`,
        `Route: ${data.originName} → ${data.destinationName}`,
        `Delay: ${data.delayMinutes} minutes`,
        ``,
        `Fare and compensation will be set from your TfL journey charge once proof is fetched.`,
      ].join("\n");
    }

    const profile = await prisma.claimProfile.findUnique({
      where: { userId: user.id },
    });
    const autoSubmit = Boolean(profile?.autoSubmitConsent);

    if (isContactless && !autoSubmit) {
      return NextResponse.json(
        {
          error:
            "Contactless claims need auto-submit enabled (and a TfL login) so Fifteen can read the journey charge from your TfL proof. Turn this on in Settings, or choose a different ticket type.",
        },
        { status: 400 },
      );
    }

    const event = await prisma.delayEvent.create({
      data: {
        userId: user.id,
        operator: data.operator,
        originCrs: data.originCrs.toUpperCase(),
        originName: data.originName,
        destinationCrs: data.destinationCrs.toUpperCase(),
        destinationName: data.destinationName,
        serviceUid: data.serviceUid,
        runDate: data.runDate,
        scheduledArrival: data.scheduledArrival,
        actualArrival: data.actualArrival,
        delayMinutes: data.delayMinutes,
        ticketType: data.ticketType,
        ticketPricePence: provisionalPrice,
        compensationTier,
        compensationAmountPence,
        claimSummary,
        status: autoSubmit ? "detected" : "unclaimed",
      },
    });

    let workflowRunId: string | null = null;
    if (autoSubmit) {
      const run = await start(claimDelayRepayWorkflow, [
        { userId: user.id, delayEventId: event.id },
      ]);
      workflowRunId = run.runId;
      await prisma.delayEvent.update({
        where: { id: event.id },
        data: { workflowRunId },
      });
    }

    return NextResponse.json(
      {
        event: {
          ...event,
          workflowRunId,
          status: autoSubmit ? "detected" : event.status,
        },
        autoSubmit,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save claim";
    // Prisma unique constraint on (userId, serviceUid, runDate)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You already have a claim for this service on that date." },
        { status: 409 },
      );
    }
    console.error("[api/claims] POST failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
