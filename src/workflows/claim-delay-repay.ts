import { getWorkflowMetadata } from "workflow";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/secrets";
import { buildClaimSummary } from "@/lib/claims/summary";
import { saveEvidenceFile, readEvidenceFile } from "@/lib/evidence/store";
import {
  calculateCompensation,
  type Operator,
  type TicketType,
} from "@/lib/eligibility/dr15";
import { getDelayRepayPortal, getTflProofFetcher } from "@/lib/portals";
import { parseTflFareFromProofBytes } from "@/lib/portals/tfl-fare";
import { getServiceDelay } from "@/lib/rtt/client";
import { ensureSuccessFeeForEvent } from "@/lib/mollie/create-success-fee-payment";

export type ClaimWorkflowInput = {
  userId: string;
  delayEventId: string;
};

async function loadContext(input: ClaimWorkflowInput) {
  "use step";

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    include: {
      claimProfile: true,
      tflCredential: true,
      operatorCredentials: true,
    },
  });

  const event = await prisma.delayEvent.findFirst({
    where: { id: input.delayEventId, userId: input.userId },
  });

  if (!event) {
    throw new Error("No delay event to process");
  }

  if (!user.claimProfile?.autoSubmitConsent) {
    await prisma.delayEvent.update({
      where: { id: event.id },
      data: {
        status: "needs_attention",
        submitError: "Auto-submit consent not enabled in settings.",
      },
    });
    return { abort: true as const, eventId: event.id, reason: "no_consent" };
  }

  console.log(`[claim workflow] loaded event=${event.id} status=${event.status}`);
  return {
    abort: false as const,
    eventId: event.id,
    userId: user.id,
    userEmail: user.email,
    profile: user.claimProfile,
    tflCredential: user.tflCredential
      ? {
          email: user.tflCredential.portalEmail,
          password: decryptSecret(user.tflCredential.passwordCiphertext),
        }
      : null,
    operatorCredentials: user.operatorCredentials.map((c) => ({
      operator: c.operator,
      email: c.portalEmail,
      password: decryptSecret(c.passwordCiphertext),
    })),
  };
}

async function verifyDelay(eventId: string) {
  "use step";

  const event = await prisma.delayEvent.findUniqueOrThrow({
    where: { id: eventId },
  });

  try {
    const detail = await getServiceDelay(
      event.serviceUid,
      event.destinationCrs,
    );
    if (detail && detail.delayMinutes >= 15) {
      await prisma.delayEvent.update({
        where: { id: eventId },
        data: {
          delayMinutes: detail.delayMinutes,
          scheduledArrival: detail.scheduledArrival,
          actualArrival: detail.actualArrival,
          status: "eligible",
        },
      });
      console.log(
        `[claim workflow] verified delay=${detail.delayMinutes}m for ${eventId}`,
      );
      return { ok: true as const, delayMinutes: detail.delayMinutes };
    }
  } catch (err) {
    console.warn("[claim workflow] RTT re-check failed, using stored delay", err);
  }

  if (event.delayMinutes < 15) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "failed",
        submitError: "Delay under 15 minutes — not eligible.",
      },
    });
    return { ok: false as const };
  }

  await prisma.delayEvent.update({
    where: { id: eventId },
    data: { status: "eligible" },
  });
  return { ok: true as const, delayMinutes: event.delayMinutes };
}

async function fetchEvidence(eventId: string, tflCred: { email: string; password: string } | null) {
  "use step";

  const event = await prisma.delayEvent.findUniqueOrThrow({
    where: { id: eventId },
  });

  if (event.ticketType !== "contactless") {
    console.log(`[claim workflow] skip TfL proof for ticketType=${event.ticketType}`);
    return { ok: true as const, skipped: true as const };
  }

  if (!tflCred) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "needs_attention",
        submitError: "Contactless claim requires TfL credentials in settings.",
      },
    });
    return { ok: false as const, skipped: false as const };
  }

  await prisma.delayEvent.update({
    where: { id: eventId },
    data: { status: "fetching_proof", submitError: null },
  });

  const fetcher = getTflProofFetcher();
  const result = await fetcher.fetchJourneyProof({
    credentials: tflCred,
    runDate: event.runDate,
    originCrs: event.originCrs,
    originName: event.originName,
    destinationCrs: event.destinationCrs,
    destinationName: event.destinationName,
    scheduledArrival: event.scheduledArrival,
    actualArrival: event.actualArrival,
  });

  if (!result.ok || !result.fileBytes) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "needs_attention",
        submitError: result.error ?? "Failed to fetch TfL journey proof.",
      },
    });
    return { ok: false as const, skipped: false as const, retryable: result.retryable };
  }

  // Compensation base must come from the TfL journey charge on the proof —
  // never the user-entered estimate.
  const farePence =
    result.farePence ??
    parseTflFareFromProofBytes(result.fileBytes, result.mimeType);

  if (farePence == null || farePence <= 0) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "needs_attention",
        submitError:
          "Could not read journey charge from TfL proof — compensation needs the PAYG fare.",
        evidencePath: undefined,
      },
    });
    // Still save evidence for debugging
    const saved = await saveEvidenceFile({
      userId: event.userId,
      delayEventId: event.id,
      bytes: result.fileBytes,
      mimeType: result.mimeType ?? "application/pdf",
    });
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        evidencePath: saved.relativePath,
        evidenceMime: saved.mimeType,
      },
    });
    return { ok: false as const, skipped: false as const };
  }

  const saved = await saveEvidenceFile({
    userId: event.userId,
    delayEventId: event.id,
    bytes: result.fileBytes,
    mimeType: result.mimeType ?? "application/pdf",
  });

  const compensation = calculateCompensation({
    operator: event.operator as Operator,
    delayMinutes: event.delayMinutes,
    ticketPricePence: farePence,
    ticketType: "contactless",
  });

  if (!compensation.eligible) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "failed",
        submitError: "Not eligible after applying TfL journey fare.",
        contactlessFarePence: farePence,
        ticketPricePence: farePence,
        evidencePath: saved.relativePath,
        evidenceMime: saved.mimeType,
      },
    });
    return { ok: false as const, skipped: false as const };
  }

  const claimSummary = buildClaimSummary({
    operator: event.operator as Operator,
    originName: event.originName,
    destinationName: event.destinationName,
    runDate: event.runDate,
    scheduledArrival: event.scheduledArrival,
    actualArrival: event.actualArrival,
    delayMinutes: event.delayMinutes,
    ticketType: "contactless",
    ticketPricePence: farePence,
    compensationTier: compensation.tier,
    compensationAmountPence: compensation.compensationAmountPence,
  });

  await prisma.delayEvent.update({
    where: { id: eventId },
    data: {
      evidencePath: saved.relativePath,
      evidenceMime: saved.mimeType,
      tflJourneyId: result.tflJourneyId,
      contactlessFarePence: farePence,
      ticketPricePence: farePence,
      compensationTier: compensation.tier,
      compensationAmountPence: compensation.compensationAmountPence,
      claimSummary,
      status: "eligible",
    },
  });

  console.log(
    `[claim workflow] evidence saved for ${eventId} tflFare=${farePence} compensation=${compensation.compensationAmountPence}`,
  );
  return { ok: true as const, skipped: false as const };
}

async function submitClaim(
  eventId: string,
  operatorCredentials: { operator: string; email: string; password: string }[],
  profile: {
    legalName: string | null;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    phone: string | null;
    payoutPreference: string;
  } | null,
  userEmail: string | null,
) {
  "use step";

  const event = await prisma.delayEvent.findUniqueOrThrow({
    where: { id: eventId },
  });

  await prisma.delayEvent.update({
    where: { id: eventId },
    data: { status: "submitting", submitError: null },
  });

  const cred =
    operatorCredentials.find((c) => c.operator === event.operator) ?? null;

  let evidenceFile: {
    bytes: Buffer;
    mimeType: string;
    filename: string;
  } | null = null;

  if (event.evidencePath) {
    const bytes = await readEvidenceFile(event.evidencePath);
    evidenceFile = {
      bytes,
      mimeType: event.evidenceMime ?? "application/pdf",
      filename: event.evidencePath.split("/").pop() ?? "evidence.pdf",
    };
  }

  const portal = getDelayRepayPortal();
  const result = await portal.submit({
    operator: event.operator as Operator,
    credentials: cred
      ? { email: cred.email, password: cred.password }
      : null,
    claimant: {
      legalName: profile?.legalName ?? null,
      addressLine1: profile?.addressLine1 ?? null,
      city: profile?.city ?? null,
      postcode: profile?.postcode ?? null,
      phone: profile?.phone ?? null,
      email: userEmail,
      payoutPreference: profile?.payoutPreference ?? "bank",
    },
    journey: {
      originCrs: event.originCrs,
      originName: event.originName,
      destinationCrs: event.destinationCrs,
      destinationName: event.destinationName,
      serviceUid: event.serviceUid,
      runDate: event.runDate,
      scheduledArrival: event.scheduledArrival,
      actualArrival: event.actualArrival,
      delayMinutes: event.delayMinutes,
    },
    ticketType: event.ticketType as TicketType,
    ticketPricePence: event.ticketPricePence,
    compensationAmountPence: event.compensationAmountPence,
    evidenceFile,
  });

  if (result.ok) {
    await prisma.delayEvent.update({
      where: { id: eventId },
      data: {
        status: "submitted",
        portalClaimRef: result.claimRef,
        submittedAt: new Date(),
        submitError: null,
      },
    });
    console.log(`[claim workflow] submitted ${eventId} ref=${result.claimRef}`);
    return { ok: true as const, claimRef: result.claimRef };
  }

  await prisma.delayEvent.update({
    where: { id: eventId },
    data: {
      status: "needs_attention",
      submitError: result.error ?? "Portal submit failed.",
    },
  });
  console.warn(`[claim workflow] needs_attention ${eventId}: ${result.error}`);
  return { ok: false as const, error: result.error };
}

async function recordWorkflowRun(eventId: string, runId: string) {
  "use step";
  await prisma.delayEvent.update({
    where: { id: eventId },
    data: { workflowRunId: runId },
  });
}

/** Open settlement row after portal submit (Fifteen receives DR → pays user). */
async function createSuccessFeeStep(eventId: string) {
  "use step";
  const result = await ensureSuccessFeeForEvent(eventId, { swallowErrors: true });
  console.log(
    `[claim workflow] settlement event=${eventId} status=${result?.status ?? "skipped"} payout=${result?.userPayoutPence ?? 0}`,
  );
  return result;
}

export async function claimDelayRepayWorkflow(input: ClaimWorkflowInput) {
  "use workflow";

  const meta = getWorkflowMetadata();

  const ctx = await loadContext(input);
  if (ctx.abort) {
    return { status: "needs_attention" as const, reason: ctx.reason, eventId: ctx.eventId };
  }

  await recordWorkflowRun(ctx.eventId, meta.workflowRunId);

  const verified = await verifyDelay(ctx.eventId);
  if (!verified.ok) {
    return { status: "failed" as const, eventId: ctx.eventId };
  }

  const evidence = await fetchEvidence(ctx.eventId, ctx.tflCredential);
  if (!evidence.ok) {
    return {
      status: "needs_attention" as const,
      eventId: ctx.eventId,
      retryable: evidence.retryable,
    };
  }

  const submitted = await submitClaim(
    ctx.eventId,
    ctx.operatorCredentials,
    ctx.profile
      ? {
          legalName: ctx.profile.legalName,
          addressLine1: ctx.profile.addressLine1,
          city: ctx.profile.city,
          postcode: ctx.profile.postcode,
          phone: ctx.profile.phone,
          payoutPreference: ctx.profile.payoutPreference,
        }
      : null,
    ctx.userEmail,
  );

  if (!submitted.ok) {
    return { status: "needs_attention" as const, eventId: ctx.eventId };
  }

  await createSuccessFeeStep(ctx.eventId);

  return {
    status: "submitted" as const,
    eventId: ctx.eventId,
    claimRef: submitted.claimRef,
  };
}
