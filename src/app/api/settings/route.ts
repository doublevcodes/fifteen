import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  legalName: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  payoutPreference: z.enum(["bank", "paypal", "voucher"]).optional(),
  defaultTicketType: z
    .enum([
      "single",
      "return",
      "contactless",
      "season_weekly",
      "season_flexi",
      "season_monthly",
      "season_quarterly",
      "season_annual",
    ])
    .optional(),
  autoSubmitConsent: z.boolean().optional(),
});

export async function GET() {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, operatorCredentials, tflCredential] = await Promise.all([
    prisma.claimProfile.findUnique({ where: { userId: user.id } }),
    prisma.operatorCredential.findMany({
      where: { userId: user.id },
      select: { operator: true, portalEmail: true, updatedAt: true },
    }),
    prisma.tflCredential.findUnique({
      where: { userId: user.id },
      select: { portalEmail: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    profile: profile
      ? {
          ...profile,
          bankAccountNumber: undefined,
          bankAccountNumberLast4: profile.bankAccountNumber
            ? profile.bankAccountNumber.slice(-4)
            : null,
        }
      : null,
    operatorCredentials,
    tflCredential,
  });
}

export async function PUT(req: Request) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const profile = await prisma.claimProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      legalName: data.legalName ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      postcode: data.postcode ?? null,
      phone: data.phone ?? null,
      payoutPreference: data.payoutPreference ?? "bank",
      defaultTicketType: data.defaultTicketType ?? "contactless",
      autoSubmitConsent: data.autoSubmitConsent ?? false,
    },
    update: {
      ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
      ...(data.addressLine1 !== undefined
        ? { addressLine1: data.addressLine1 }
        : {}),
      ...(data.addressLine2 !== undefined
        ? { addressLine2: data.addressLine2 }
        : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.postcode !== undefined ? { postcode: data.postcode } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.payoutPreference !== undefined
        ? { payoutPreference: data.payoutPreference }
        : {}),
      ...(data.defaultTicketType !== undefined
        ? { defaultTicketType: data.defaultTicketType }
        : {}),
      ...(data.autoSubmitConsent !== undefined
        ? { autoSubmitConsent: data.autoSubmitConsent }
        : {}),
    },
  });

  return NextResponse.json({ profile });
}

const operatorCredSchema = z.object({
  operator: z.enum(["SWR", "SOUTHERN", "SOUTHEASTERN"]),
  portalEmail: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const kind = body?.kind as string | undefined;

  if (kind === "operator") {
    const parsed = operatorCredSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const cred = await prisma.operatorCredential.upsert({
      where: {
        userId_operator: {
          userId: user.id,
          operator: parsed.data.operator,
        },
      },
      create: {
        userId: user.id,
        operator: parsed.data.operator,
        portalEmail: parsed.data.portalEmail,
        passwordCiphertext: encryptSecret(parsed.data.password),
      },
      update: {
        portalEmail: parsed.data.portalEmail,
        passwordCiphertext: encryptSecret(parsed.data.password),
      },
      select: { operator: true, portalEmail: true, updatedAt: true },
    });
    return NextResponse.json({ operatorCredential: cred });
  }

  if (kind === "tfl") {
    const parsed = z
      .object({
        portalEmail: z.string().email(),
        password: z.string().min(1),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const cred = await prisma.tflCredential.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        portalEmail: parsed.data.portalEmail,
        passwordCiphertext: encryptSecret(parsed.data.password),
      },
      update: {
        portalEmail: parsed.data.portalEmail,
        passwordCiphertext: encryptSecret(parsed.data.password),
      },
      select: { portalEmail: true, updatedAt: true },
    });
    return NextResponse.json({ tflCredential: cred });
  }

  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}
