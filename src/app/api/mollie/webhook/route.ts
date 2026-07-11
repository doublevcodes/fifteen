import { NextResponse } from "next/server";

/**
 * Legacy payment webhook for passenger → Fifteen charges.
 * Payouts run automatically after claim submit (and again after bank connect).
 */
export async function POST() {
  return NextResponse.json({ ok: true, ignored: true });
}
