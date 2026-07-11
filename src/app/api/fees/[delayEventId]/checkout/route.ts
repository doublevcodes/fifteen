import { NextResponse } from "next/server";

type Params = { params: Promise<{ delayEventId: string }> };

/** Legacy charge checkout — replaced by receive-then-payout. */
export async function POST(_req: Request, { params }: Params) {
  const { delayEventId } = await params;
  return NextResponse.json(
    {
      error:
        "Success-fee checkout is retired. Fifteen receives Delay Repay and pays you out. Use POST /api/fees/" +
        delayEventId +
        "/payout after connecting a bank in Settings.",
    },
    { status: 410 },
  );
}
