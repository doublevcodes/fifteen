import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readEvidenceFile } from "@/lib/evidence/store";

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
  if (!event?.evidencePath) {
    return NextResponse.json({ error: "No evidence" }, { status: 404 });
  }

  const bytes = await readEvidenceFile(event.evidencePath);
  const filename = event.evidencePath.split("/").pop() ?? "evidence.bin";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": event.evidenceMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
