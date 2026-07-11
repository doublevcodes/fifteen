import { unstable_cache } from "next/cache";
import {
  rttConfigured,
  searchLocationWithDelays,
} from "@/lib/rtt/client";

/**
 * High-traffic hubs across the SWR / Southern / Southeastern networks.
 * Kept lean to stay under RTT's ~30 req/min rate limit (one request per hub).
 */
export const NETWORK_HUBS = [
  // London
  { crs: "WAT", name: "London Waterloo" },
  { crs: "VIC", name: "London Victoria" },
  { crs: "LBG", name: "London Bridge" },
  { crs: "CHX", name: "London Charing Cross" },
  { crs: "CST", name: "London Cannon Street" },
  { crs: "CLJ", name: "Clapham Junction" },
  { crs: "ECR", name: "East Croydon" },
  // SWR
  { crs: "WOK", name: "Woking" },
  { crs: "GLD", name: "Guildford" },
  { crs: "RDG", name: "Reading" },
  { crs: "SOU", name: "Southampton Central" },
  { crs: "PMH", name: "Portsmouth Harbour" },
  { crs: "BMH", name: "Bournemouth" },
  // Southern
  { crs: "BTN", name: "Brighton" },
  { crs: "GTW", name: "Gatwick Airport" },
  // Southeastern
  { crs: "AFK", name: "Ashford International" },
  { crs: "DVP", name: "Dover Priory" },
  { crs: "HGS", name: "Hastings" },
  { crs: "DFD", name: "Dartford" },
] as const;

/** @deprecated Use NETWORK_HUBS */
export const LONDON_TERMINI = NETWORK_HUBS;

export type BoardRow = {
  key: string;
  time: string;
  from: string;
  terminus: string;
  plat: string;
  delayMinutes: number;
  status: string;
};

export type DelayedBoard = {
  rows: BoardRow[];
  mock: boolean;
  asOf: string;
};

const SAMPLE_ROWS: BoardRow[] = [
  {
    key: "sample-1",
    time: "08:12",
    from: "Guildford",
    terminus: "London Waterloo",
    plat: "7",
    delayMinutes: 18,
    status: "Delayed  +18",
  },
  {
    key: "sample-2",
    time: "08:27",
    from: "London Victoria",
    terminus: "Brighton",
    plat: "4",
    delayMinutes: 22,
    status: "Delayed  +22",
  },
  {
    key: "sample-3",
    time: "08:42",
    from: "Hastings",
    terminus: "London Bridge",
    plat: "8",
    delayMinutes: 27,
    status: "Delayed  +27",
  },
  {
    key: "sample-4",
    time: "08:55",
    from: "London Waterloo",
    terminus: "Portsmouth Harbour",
    plat: "1",
    delayMinutes: 15,
    status: "Delayed  +15",
  },
  {
    key: "sample-5",
    time: "09:03",
    from: "Reading",
    terminus: "London Waterloo",
    plat: "10",
    delayMinutes: 31,
    status: "Delayed  +31",
  },
  {
    key: "sample-6",
    time: "09:18",
    from: "Dover Priory",
    terminus: "London Cannon Street",
    plat: "2",
    delayMinutes: 19,
    status: "Delayed  +19",
  },
];

const MIN_DELAY = 15;
const LOOKBACK_MINUTES = 90;
const WINDOW_MINUTES = 120;
const BOARD_LIMIT = 6;
/** Parallel RTT location calls per wave — leave headroom under the 30/min cap. */
const BATCH_SIZE = 5;

function londonNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/London" }),
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isoToHm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function shortStationName(name: string): string {
  return name.replace(/^London\s+/i, "").trim() || name;
}

const fetchCachedLiveBoard = unstable_cache(
  async (): Promise<BoardRow[]> => fetchLiveDelayedRows(),
  ["delayed-network-board-v2"],
  { revalidate: 90 },
);

/**
 * Recent DR15-eligible delayed arrivals across SWR / Southern / Southeastern hubs.
 * Falls back to sample rows when RTT is unset or returns nothing.
 */
export async function getDelayedTerminusBoard(): Promise<DelayedBoard> {
  const asOf = formatHm(londonNow());

  if (!rttConfigured()) {
    return { rows: SAMPLE_ROWS, mock: true, asOf };
  }

  try {
    const rows = await fetchCachedLiveBoard();
    if (rows.length === 0) {
      return { rows: SAMPLE_ROWS, mock: true, asOf };
    }
    return { rows, mock: false, asOf };
  } catch {
    return { rows: SAMPLE_ROWS, mock: true, asOf };
  }
}

async function fetchLiveDelayedRows(): Promise<BoardRow[]> {
  const now = londonNow();
  const from = new Date(now.getTime() - LOOKBACK_MINUTES * 60_000);
  const date = `${from.getFullYear()}-${pad2(from.getMonth() + 1)}-${pad2(from.getDate())}`;
  const timeFrom = formatHm(from);

  const batches: Awaited<ReturnType<typeof searchHubBatch>>[] = [];
  for (let i = 0; i < NETWORK_HUBS.length; i += BATCH_SIZE) {
    const slice = NETWORK_HUBS.slice(i, i + BATCH_SIZE);
    batches.push(await searchHubBatch(slice, date, timeFrom));
  }

  const seen = new Set<string>();
  return batches
    .flat()
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
    .filter((row) => {
      if (seen.has(row.dedupeKey)) return false;
      seen.add(row.dedupeKey);
      return true;
    })
    .slice(0, BOARD_LIMIT)
    .map(({ sortAt: _s, dedupeKey: _d, ...row }) => row);
}

async function searchHubBatch(
  hubs: readonly { crs: string; name: string }[],
  date: string,
  timeFrom: string,
) {
  const results = await Promise.all(
    hubs.map(async (hub) => {
      try {
        const services = await searchLocationWithDelays({
          stationCrs: hub.crs,
          date,
          timeFrom,
          timeWindow: String(WINDOW_MINUTES),
        });
        return services
          .filter(
            (s) =>
              s.operator != null &&
              s.delayMinutes >= MIN_DELAY &&
              s.scheduledArrival != null,
          )
          .map((s) => ({
            key: `${s.uniqueIdentity}:${hub.crs}`,
            time: isoToHm(s.scheduledArrival) ?? "——",
            from: shortStationName(s.originName || s.originCrs || "Unknown"),
            terminus: shortStationName(s.destinationName || hub.name),
            plat: s.platform ?? "—",
            delayMinutes: s.delayMinutes,
            status: `Delayed  +${s.delayMinutes}`,
            sortAt: s.actualArrival ?? s.scheduledArrival ?? "",
            dedupeKey: s.uniqueIdentity,
          }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export function boardFromLabel(mock: boolean): string {
  return mock ? "Live delays · sample" : "Live delays · nationwide";
}
