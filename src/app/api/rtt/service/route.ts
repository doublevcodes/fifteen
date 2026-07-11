import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { getServiceDelay } from "@/lib/rtt/client";

const querySchema = z.object({
  uniqueIdentity: z.string().min(3),
  destination: z.string().min(3).max(8),
});

export async function GET(req: Request) {
  try {
    await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    uniqueIdentity: url.searchParams.get("uniqueIdentity") ?? undefined,
    destination: url.searchParams.get("destination") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const detail = await getServiceDelay(
      parsed.data.uniqueIdentity,
      parsed.data.destination,
    );
    return NextResponse.json({ service: detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
