import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { rttConfigured, searchServices } from "@/lib/rtt/client";

const querySchema = z.object({
  station: z.string().min(3).max(8),
  to: z.string().min(3).max(8).optional(),
  from: z.string().min(3).max(8).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  arrivals: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function GET(req: Request) {
  try {
    await requireDbUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    station: url.searchParams.get("station") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    time: url.searchParams.get("time") ?? undefined,
    arrivals: url.searchParams.get("arrivals") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const services = await searchServices({
      stationCrs: parsed.data.station,
      filterToCrs: parsed.data.to,
      filterFromCrs: parsed.data.from,
      date: parsed.data.date,
      timeFrom: parsed.data.time,
      arrivals: parsed.data.arrivals,
    });
    return NextResponse.json({ services, mock: !rttConfigured() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
