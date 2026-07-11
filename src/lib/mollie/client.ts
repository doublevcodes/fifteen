import createMollieClient, { type MollieClient } from "@mollie/api-client";

let client: MollieClient | null = null;

export function getMollieClient(): MollieClient {
  const apiKey = process.env.MOLLIE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MOLLIE_API_KEY is not set");
  }
  if (!client) {
    client = createMollieClient({ apiKey });
  }
  return client;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

/** Mollie cannot reach localhost; only send webhookUrl for public hosts. */
export function isPublicAppUrl(url: string = getAppBaseUrl()): boolean {
  try {
    const host = new URL(url).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
}

/** Charity Mollie org for split routing. Empty = mock (ledger only, no routing). */
export function getCharityOrgId(): string | null {
  const orgId = process.env.MOLLIE_CHARITY_ORG_ID?.trim();
  return orgId || null;
}
