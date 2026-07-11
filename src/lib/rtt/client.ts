import {
  ATOC_TO_OPERATOR,
  type Operator,
  operatorFromAtoc,
} from "@/lib/eligibility/dr15";
import { searchStations } from "@/lib/stations/search";

const NG_BASE = "https://data.rtt.io";
const LEGACY_BASE = "https://api.rtt.io/api/v1";

export type ServiceSummary = {
  uniqueIdentity: string;
  identity: string;
  runDate: string;
  operatorCode: string;
  operatorName: string;
  operator: Operator | null;
  originCrs: string;
  originName: string;
  destinationCrs: string;
  destinationName: string;
  /** @deprecated Prefer departureTime — kept for board/compat */
  scheduledTime: string | null;
  /** Scheduled departure from the searched (from) station */
  departureTime: string | null;
  /** Scheduled arrival at the destination (filterTo / train destination) */
  arrivalTime: string | null;
  /** Arrival lateness at destination in minutes, when known from location realtime */
  delayMinutes: number | null;
  atLocationCrs: string;
  atLocationName: string;
};

export type ServiceDelayDetail = {
  uniqueIdentity: string;
  identity: string;
  runDate: string;
  operatorCode: string;
  operatorName: string;
  operator: Operator | null;
  originCrs: string;
  originName: string;
  destinationCrs: string;
  destinationName: string;
  scheduledArrival: string;
  actualArrival: string;
  delayMinutes: number;
  hasActual: boolean;
};

type SearchParams = {
  stationCrs: string;
  filterToCrs?: string;
  filterFromCrs?: string;
  date: string; // YYYY-MM-DD
  timeFrom?: string; // HH:mm
  arrivals?: boolean;
};

type CachedAccessToken = {
  token: string;
  /** epoch ms — refresh a minute early */
  expiresAt: number;
};

const globalRtt = globalThis as unknown as {
  __rttAccessToken?: CachedAccessToken;
};

function hasNgToken(): boolean {
  return Boolean(process.env.RTT_TOKEN?.trim());
}

function hasLegacyAuth(): boolean {
  return Boolean(
    process.env.RTT_USERNAME?.trim() && process.env.RTT_PASSWORD?.trim(),
  );
}

export function rttConfigured(): boolean {
  return hasNgToken() || hasLegacyAuth();
}

function crsCode(crs: string): string {
  const clean = crs.trim().toUpperCase();
  if (clean.includes(":")) return clean;
  return `gb-nr:${clean}`;
}

/**
 * Portal tokens from api-portal.rtt.io are usually refresh tokens.
 * Exchange them for a short-lived access token via /api/get_access_token
 * (see https://realtimetrains.github.io/api-specification/).
 */
async function getNgAccessToken(): Promise<string> {
  const refresh = process.env.RTT_TOKEN?.trim();
  if (!refresh) throw new Error("RTT_TOKEN is not set");

  const cached = globalRtt.__rttAccessToken;
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const res = await fetch(`${NG_BASE}/api/get_access_token`, {
    headers: {
      Authorization: `Bearer ${refresh}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `RTT token exchange failed (${res.status}): ${body.slice(0, 200)}. ` +
        `If this is a refresh token from api-portal.rtt.io, confirm it is still valid.`,
    );
  }

  const data = (await res.json()) as {
    token?: string;
    validUntil?: string;
  };

  if (!data.token) {
    throw new Error("RTT /api/get_access_token returned no token");
  }

  const expiresAt = data.validUntil
    ? new Date(data.validUntil).getTime()
    : Date.now() + 15 * 60_000;

  globalRtt.__rttAccessToken = { token: data.token, expiresAt };
  return data.token;
}

async function ngFetch(pathname: string, query: Record<string, string> = {}) {
  const accessToken = await getNgAccessToken();
  const url = new URL(pathname, NG_BASE);
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v);
  }

  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  // Access token may have expired — clear cache and retry once
  if (res.status === 401) {
    globalRtt.__rttAccessToken = undefined;
    const retryToken = await getNgAccessToken();
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  }

  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RTT NG ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function legacyFetch(path: string) {
  const user = process.env.RTT_USERNAME!;
  const pass = process.env.RTT_PASSWORD!;
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(`${LEGACY_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RTT legacy ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseHm(date: string, hm: string | null | undefined): string | null {
  if (!hm || hm.length < 4) return null;
  const hours = hm.slice(0, 2);
  const minutes = hm.slice(2, 4);
  return `${date}T${hours}:${minutes}:00`;
}

function delayMinutesBetween(scheduledIso: string, actualIso: string): number {
  const sched = new Date(scheduledIso).getTime();
  const actual = new Date(actualIso).getTime();
  if (Number.isNaN(sched) || Number.isNaN(actual)) return 0;
  return Math.max(0, Math.floor((actual - sched) / 60000));
}

function locShortCode(location: Record<string, unknown> | undefined): string {
  if (!location) return "";
  const shorts = location.shortCodes as string[] | undefined;
  if (shorts?.[0]) return shorts[0].toUpperCase();
  const direct = String(location.crs ?? location.code ?? "").toUpperCase();
  if (direct && direct.length === 3) return direct;

  // Location line-up origin/destination often only include TIPLOC longCodes.
  // Resolve CRS via station name when possible.
  const name = locName(location);
  if (name) {
    const match = searchStations(name, 1)[0];
    if (match && normalizeName(match.stationName) === normalizeName(name)) {
      return match.crsCode;
    }
    // Prefer a starts-with / contains match when exact equality fails
    // (e.g. "London Waterloo" vs "London Waterloo").
    const loose = searchStations(name, 5).find((s) =>
      normalizeName(name).includes(normalizeName(s.stationName)) ||
      normalizeName(s.stationName).includes(normalizeName(name)),
    );
    if (loose) return loose.crsCode;
  }
  return "";
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function locName(location: Record<string, unknown> | undefined, fallback = ""): string {
  if (!location) return fallback;
  return String(location.description ?? location.name ?? fallback);
}

function endpointPair(
  pairs: unknown,
): { crs: string; name: string } {
  const first = Array.isArray(pairs) ? (pairs[0] as Record<string, unknown>) : null;
  const location = (first?.location ?? {}) as Record<string, unknown>;
  return {
    crs: locShortCode(location),
    name: locName(location),
  };
}

function mockServices(params: SearchParams): ServiceSummary[] {
  const station = params.stationCrs.toUpperCase();
  const dest = (params.filterToCrs ?? "WAT").toUpperCase();
  const operators: Array<{ code: string; name: string }> = [
    { code: "SW", name: "South Western Railway" },
    { code: "SN", name: "Southern" },
    { code: "SE", name: "Southeastern" },
  ];
  return operators.map((op, i) => {
    const hour = 8 + i;
    const identity = `M${op.code}${String(hour).padStart(2, "0")}00`;
    const departureTime = `${params.date}T${String(hour).padStart(2, "0")}:15:00`;
    const arrivalTime = `${params.date}T${String(hour + 1).padStart(2, "0")}:02:00`;
    const delayMinutes = [27, 8, 34][i] ?? 0;
    return {
      uniqueIdentity: `gb-nr:${identity}:${params.date}`,
      identity,
      runDate: params.date,
      operatorCode: op.code,
      operatorName: op.name,
      operator: operatorFromAtoc(op.code),
      originCrs: station,
      originName: station,
      destinationCrs: dest,
      destinationName: dest,
      scheduledTime: departureTime,
      departureTime,
      arrivalTime,
      delayMinutes,
      atLocationCrs: station,
      atLocationName: station,
    };
  });
}

function mockServiceDetail(
  uniqueIdentity: string,
  destinationCrs: string,
): ServiceDelayDetail {
  const [, identity = "MOCK", runDate = new Date().toISOString().slice(0, 10)] =
    uniqueIdentity.split(":");
  const code = identity.includes("SN")
    ? "SN"
    : identity.includes("SE")
      ? "SE"
      : "SW";
  const scheduledArrival = `${runDate}T09:15:00`;
  const actualArrival = `${runDate}T09:42:00`;
  return {
    uniqueIdentity,
    identity,
    runDate,
    operatorCode: code,
    operatorName:
      code === "SN"
        ? "Southern"
        : code === "SE"
          ? "Southeastern"
          : "South Western Railway",
    operator: operatorFromAtoc(code),
    originCrs: "SUR",
    originName: "Surbiton",
    destinationCrs: destinationCrs.toUpperCase(),
    destinationName: destinationCrs.toUpperCase(),
    scheduledArrival,
    actualArrival,
    delayMinutes: 27,
    hasActual: true,
  };
}

export type LocationServiceDetail = Omit<ServiceSummary, "delayMinutes"> & {
  delayMinutes: number;
  platform: string | null;
  scheduledArrival: string | null;
  actualArrival: string | null;
};

export async function searchServices(
  params: SearchParams,
): Promise<ServiceSummary[]> {
  if (!rttConfigured()) {
    return mockServices(params).filter((s) => s.operator != null);
  }

  let services: ServiceSummary[] = [];

  if (hasNgToken()) {
    const data = await fetchNgLocation(params);
    if (!data?.services) return [];

    services = (data.services as Array<Record<string, unknown>>)
      .map((svc) => mapNgLocationService(svc, params.stationCrs))
      .filter((s): s is ServiceSummary => s != null && s.operator != null);
  } else {
    const station = params.stationCrs.toUpperCase();
    const [y, m, d] = params.date.split("-");
    const time = (params.timeFrom ?? "0800").replace(":", "");
    let path = `/json/search/${station}`;
    if (params.filterToCrs) {
      path += `/to/${params.filterToCrs.toUpperCase()}`;
    }
    path += `/${y}/${m}/${d}/${time}`;
    if (params.arrivals) path += "/arrivals";

    const data = await legacyFetch(path);
    if (!data?.services) return [];

    services = (data.services as Array<Record<string, unknown>>)
      .map((svc) => mapLegacyLocationService(svc, params.date, station))
      .filter((s): s is ServiceSummary => s != null && s.operator != null);
  }

  const destCrs = params.filterToCrs?.toUpperCase();
  if (!destCrs || services.length === 0) return services;

  // One extra location query at the destination (not N service fetches —
  // RTT rate-limits ~30/min and parallel detail lookups wipe arrivals).
  return mergeDestinationArrivals(services, params, destCrs);
}

/** Location lineup including arrival lateness + platform (for live boards). */
export async function searchLocationWithDelays(
  params: SearchParams & { timeWindow?: string },
): Promise<LocationServiceDetail[]> {
  if (!rttConfigured()) {
    return mockServices(params)
      .filter((s) => s.operator != null)
      .map((s) => ({
        ...s,
        delayMinutes: 27,
        platform: "4",
        scheduledArrival: s.scheduledTime,
        actualArrival: s.scheduledTime,
      }));
  }

  if (hasNgToken()) {
    const data = await fetchNgLocation(params);
    if (!data?.services) return [];
    return (data.services as Array<Record<string, unknown>>)
      .map((svc) => mapNgLocationServiceDetailed(svc, params.stationCrs))
      .filter((s): s is LocationServiceDetail => s != null && s.operator != null);
  }

  // Legacy location search — lateness when present on locationDetail
  const summaries = await searchServices({ ...params, arrivals: true });
  return summaries.map((s) => ({
    ...s,
    delayMinutes: 0,
    platform: null,
    scheduledArrival: s.scheduledTime,
    actualArrival: null,
  }));
}

async function fetchNgLocation(
  params: SearchParams & { timeWindow?: string },
) {
  const timeFrom = params.timeFrom
    ? `${params.date}T${params.timeFrom}:00`
    : `${params.date}T00:00:00`;
  return ngFetch("/rtt/location", {
    code: crsCode(params.stationCrs),
    ...(params.filterToCrs ? { filterTo: crsCode(params.filterToCrs) } : {}),
    ...(params.filterFromCrs
      ? { filterFrom: crsCode(params.filterFromCrs) }
      : {}),
    timeFrom,
    timeWindow: params.timeWindow ?? "180",
  });
}

function mapNgLocationService(
  svc: Record<string, unknown>,
  stationCrs: string,
): ServiceSummary | null {
  const detailed = mapNgLocationServiceDetailed(svc, stationCrs);
  if (!detailed) return null;
  const {
    delayMinutes: _d,
    platform: _p,
    scheduledArrival: _sa,
    actualArrival: _aa,
    ...summary
  } = detailed;
  // Location delay is at the from station — destination lateness comes from merge.
  return { ...summary, delayMinutes: null };
}

function mapNgLocationServiceDetailed(
  svc: Record<string, unknown>,
  stationCrs: string,
): LocationServiceDetail | null {
  const meta = (svc.scheduleMetadata ?? {}) as Record<string, unknown>;
  const operator = (meta.operator ?? {}) as { code?: string; name?: string };
  const uniqueIdentity = String(meta.uniqueIdentity ?? "");
  if (!uniqueIdentity) return null;

  const origin = endpointPair(svc.origin);
  const destination = endpointPair(svc.destination);

  const temporal = (svc.temporalData ?? {}) as {
    arrival?: {
      scheduleAdvertised?: string;
      realtimeActual?: string;
      realtimeForecast?: string;
      realtimeAdvertisedLateness?: number;
    };
    departure?: {
      scheduleAdvertised?: string;
      realtimeActual?: string;
      realtimeForecast?: string;
      realtimeAdvertisedLateness?: number;
    };
  };

  const arrival = temporal.arrival;
  const departure = temporal.departure;
  const scheduledArrival = arrival?.scheduleAdvertised ?? null;
  const actualArrival =
    arrival?.realtimeActual ?? arrival?.realtimeForecast ?? null;
  const departureTime =
    departure?.scheduleAdvertised ?? arrival?.scheduleAdvertised ?? null;

  const delayMinutes =
    typeof arrival?.realtimeAdvertisedLateness === "number"
      ? Math.max(0, arrival.realtimeAdvertisedLateness)
      : typeof departure?.realtimeAdvertisedLateness === "number"
        ? Math.max(0, departure.realtimeAdvertisedLateness)
        : 0;

  const locMeta = (svc.locationMetadata ?? {}) as {
    platform?: { planned?: string; actual?: string };
  };
  const platform =
    locMeta.platform?.actual ?? locMeta.platform?.planned ?? null;

  return {
    uniqueIdentity,
    identity: String(meta.identity ?? uniqueIdentity.split(":")[1] ?? ""),
    runDate: String(
      meta.departureDate ?? uniqueIdentity.split(":")[2] ?? "",
    ),
    operatorCode: operator.code ?? "",
    operatorName: operator.name ?? operator.code ?? "",
    operator: operatorFromAtoc(operator.code),
    originCrs: origin.crs,
    originName: origin.name || stationCrs.toUpperCase(),
    destinationCrs: destination.crs,
    destinationName: destination.name,
    scheduledTime: departureTime,
    departureTime,
    arrivalTime: null,
    atLocationCrs: stationCrs.toUpperCase(),
    atLocationName: stationCrs.toUpperCase(),
    delayMinutes,
    platform,
    scheduledArrival,
    actualArrival,
  };
}

function mapLegacyLocationService(
  container: Record<string, unknown>,
  runDate: string,
  stationCrs: string,
): ServiceSummary | null {
  const loc = (container.locationDetail ?? container) as Record<
    string,
    unknown
  >;
  const service = (
    container.serviceUid ? container : loc
  ) as Record<string, unknown>;

  const serviceUid = String(
    service.serviceUid ?? loc.serviceUid ?? container.serviceUid ?? "",
  );
  if (!serviceUid) return null;

  const atocCode = String(
    service.atocCode ?? loc.atocCode ?? container.atocCode ?? "",
  );
  const runDateRaw = String(
    service.runDate ?? loc.runDate ?? container.runDate ?? runDate,
  ).replaceAll("/", "-");
  const date = runDateRaw.includes("-") ? runDateRaw : runDate;

  const origin = ((loc.origin ?? service.origin) as Array<{
    description?: string;
    crs?: string;
  }>)?.[0];
  const destination = ((loc.destination ?? service.destination) as Array<{
    description?: string;
    crs?: string;
  }>)?.[0];

  const gbttDeparture = loc.gbttBookedDeparture as string | undefined;
  const gbttArrival = loc.gbttBookedArrival as string | undefined;
  const departureTime =
    parseHm(date, gbttDeparture) ?? parseHm(date, gbttArrival);

  return {
    uniqueIdentity: `legacy:${serviceUid}:${date}`,
    identity: serviceUid,
    runDate: date,
    operatorCode: atocCode,
    operatorName: String(service.atocName ?? atocCode),
    operator: operatorFromAtoc(atocCode),
    originCrs: origin?.crs ?? "",
    originName: origin?.description ?? origin?.crs ?? "",
    destinationCrs: destination?.crs ?? "",
    destinationName: destination?.description ?? destination?.crs ?? "",
    scheduledTime: departureTime,
    departureTime,
    arrivalTime: null,
    delayMinutes: null,
    atLocationCrs: stationCrs,
    atLocationName: String(loc.description ?? stationCrs),
  };
}

/**
 * Location search only returns times at the queried station. Pair the from
 * departures with a second location query at the destination (filterFrom the
 * origin) and merge scheduled arrival by uniqueIdentity — two requests total,
 * instead of one detail fetch per service (which trips RTT rate limits).
 */
async function mergeDestinationArrivals(
  services: ServiceSummary[],
  params: SearchParams,
  destCrs: string,
): Promise<ServiceSummary[]> {
  const arrivalByUid = new Map<
    string,
    { arrivalTime: string; delayMinutes: number | null }
  >();

  try {
    if (hasNgToken()) {
      // Arrivals land after departure — widen the window so late journeys still match.
      const data = await fetchNgLocation({
        stationCrs: destCrs,
        filterFromCrs: params.stationCrs,
        date: params.date,
        timeFrom: params.timeFrom,
        timeWindow: "240",
        arrivals: true,
      });
      for (const raw of (data?.services ?? []) as Array<Record<string, unknown>>) {
        const meta = (raw.scheduleMetadata ?? {}) as Record<string, unknown>;
        const uid = String(meta.uniqueIdentity ?? "");
        if (!uid) continue;
        const temporal = (raw.temporalData ?? {}) as {
          arrival?: {
            scheduleAdvertised?: string;
            realtimeAdvertisedLateness?: number;
          };
          departure?: {
            scheduleAdvertised?: string;
            realtimeAdvertisedLateness?: number;
          };
        };
        const arrivalTime =
          temporal.arrival?.scheduleAdvertised ??
          temporal.departure?.scheduleAdvertised ??
          null;
        if (!arrivalTime) continue;
        const delayMinutes =
          typeof temporal.arrival?.realtimeAdvertisedLateness === "number"
            ? Math.max(0, temporal.arrival.realtimeAdvertisedLateness)
            : typeof temporal.departure?.realtimeAdvertisedLateness === "number"
              ? Math.max(0, temporal.departure.realtimeAdvertisedLateness)
              : null;
        arrivalByUid.set(uid, { arrivalTime, delayMinutes });
      }
    } else {
      const station = destCrs.toUpperCase();
      const from = params.stationCrs.toUpperCase();
      const [y, m, d] = params.date.split("-");
      const time = (params.timeFrom ?? "0800").replace(":", "");
      const path = `/json/search/${station}/from/${from}/${y}/${m}/${d}/${time}/arrivals`;
      const data = await legacyFetch(path);
      for (const container of (data?.services ?? []) as Array<
        Record<string, unknown>
      >) {
        const loc = (container.locationDetail ?? container) as Record<
          string,
          unknown
        >;
        const service = (
          container.serviceUid ? container : loc
        ) as Record<string, unknown>;
        const serviceUid = String(
          service.serviceUid ?? loc.serviceUid ?? container.serviceUid ?? "",
        );
        const runDateRaw = String(
          service.runDate ?? loc.runDate ?? container.runDate ?? params.date,
        ).replaceAll("/", "-");
        const date = runDateRaw.includes("-") ? runDateRaw : params.date;
        if (!serviceUid) continue;
        const uid = `legacy:${serviceUid}:${date}`;
        const arrivalTime =
          parseHm(date, loc.gbttBookedArrival as string | undefined) ??
          parseHm(date, loc.gbttBookedDeparture as string | undefined);
        if (!arrivalTime) continue;
        const lateness = loc.realtimeArrivalLateness;
        const delayMinutes =
          typeof lateness === "number" ? Math.max(0, lateness) : null;
        arrivalByUid.set(uid, { arrivalTime, delayMinutes });
      }
    }
  } catch {
    return services;
  }

  return services.map((svc) => {
    const matched = arrivalByUid.get(svc.uniqueIdentity);
    if (!matched) return svc;
    return {
      ...svc,
      arrivalTime: matched.arrivalTime,
      delayMinutes: matched.delayMinutes ?? svc.delayMinutes,
    };
  });
}

export async function getServiceDelay(
  uniqueIdentity: string,
  destinationCrs: string,
): Promise<ServiceDelayDetail> {
  if (!rttConfigured()) {
    return mockServiceDetail(uniqueIdentity, destinationCrs);
  }

  if (hasNgToken() && !uniqueIdentity.startsWith("legacy:")) {
    const data = await ngFetch("/rtt/service", { uniqueIdentity });
    if (!data) throw new Error("Service not found");
    return mapNgServiceDetail(data, destinationCrs);
  }

  const parts = uniqueIdentity.split(":");
  const serviceUid = parts[1];
  const date = parts[2];
  if (!serviceUid || !date) throw new Error("Invalid service id");
  const [y, m, d] = date.split("-");
  const data = await legacyFetch(`/json/service/${serviceUid}/${y}/${m}/${d}`);
  if (!data) throw new Error("Service not found");
  return mapLegacyServiceDetail(data, destinationCrs, date);
}

function mapNgServiceDetail(
  data: Record<string, unknown>,
  destinationCrs: string,
): ServiceDelayDetail {
  // NG wraps the payload: { systemStatus, query, service: { … } }
  const service = (data.service ?? data) as Record<string, unknown>;
  const meta = (service.scheduleMetadata ?? {}) as Record<string, unknown>;
  const operator = (meta.operator ?? {}) as { code?: string; name?: string };
  const locations = (service.locations ?? []) as Array<Record<string, unknown>>;

  const destUpper = destinationCrs.toUpperCase();
  const destStop =
    locations.find((loc) => {
      const location = (loc.location ?? {}) as Record<string, unknown>;
      const crs = locShortCode(location);
      return crs === destUpper;
    }) ?? locations[locations.length - 1];

  if (!destStop) throw new Error("Destination stop not found on service");

  const temporal = (destStop.temporalData ?? {}) as {
    arrival?: {
      scheduleAdvertised?: string;
      realtimeActual?: string;
      realtimeForecast?: string;
      realtimeAdvertisedLateness?: number;
    };
  };
  const arrival = temporal.arrival;
  const scheduledArrival = arrival?.scheduleAdvertised;
  if (!scheduledArrival) {
    throw new Error("No scheduled arrival at destination");
  }

  const actualArrival =
    arrival.realtimeActual ?? arrival.realtimeForecast ?? scheduledArrival;
  const hasActual = Boolean(arrival.realtimeActual);
  const delayMinutes =
    typeof arrival.realtimeAdvertisedLateness === "number"
      ? Math.max(0, arrival.realtimeAdvertisedLateness)
      : delayMinutesBetween(scheduledArrival, actualArrival);

  const first = locations[0];
  const last = locations[locations.length - 1];
  const firstLoc = (first?.location ?? {}) as Record<string, unknown>;
  const lastLoc = (last?.location ?? {}) as Record<string, unknown>;
  const originPair = endpointPair(service.origin);
  const destPair = endpointPair(service.destination);

  return {
    uniqueIdentity: String(meta.uniqueIdentity ?? ""),
    identity: String(meta.identity ?? ""),
    runDate: String(meta.departureDate ?? ""),
    operatorCode: operator.code ?? "",
    operatorName: operator.name ?? "",
    operator: operatorFromAtoc(operator.code),
    originCrs: originPair.crs || locShortCode(firstLoc),
    originName: originPair.name || locName(firstLoc),
    destinationCrs: destPair.crs || locShortCode(lastLoc) || destUpper,
    destinationName: destPair.name || locName(lastLoc, destUpper),
    scheduledArrival,
    actualArrival,
    delayMinutes,
    hasActual,
  };
}

function mapLegacyServiceDetail(
  data: Record<string, unknown>,
  destinationCrs: string,
  runDate: string,
): ServiceDelayDetail {
  const locations = (data.locations ?? []) as Array<Record<string, unknown>>;
  const destUpper = destinationCrs.toUpperCase();
  const destStop =
    locations.find(
      (loc) => String(loc.crs ?? "").toUpperCase() === destUpper,
    ) ?? locations[locations.length - 1];

  if (!destStop) throw new Error("Destination stop not found on service");

  const scheduled =
    parseHm(runDate, destStop.gbttBookedArrival as string | undefined) ??
    parseHm(runDate, destStop.gbttBookedDeparture as string | undefined);
  if (!scheduled) throw new Error("No scheduled arrival at destination");

  const actual =
    parseHm(runDate, destStop.realtimeArrival as string | undefined) ??
    scheduled;
  const hasActual = Boolean(destStop.realtimeArrival);
  const lateness = destStop.realtimeArrivalLateness;
  const delayMinutes =
    typeof lateness === "number"
      ? Math.max(0, lateness)
      : delayMinutesBetween(scheduled, actual);

  const origin = (data.origin as Array<{ crs?: string; description?: string }>)?.[0];
  const destination = (
    data.destination as Array<{ crs?: string; description?: string }>
  )?.[0];
  const atocCode = String(data.atocCode ?? "");

  return {
    uniqueIdentity: `legacy:${data.serviceUid}:${runDate}`,
    identity: String(data.serviceUid ?? ""),
    runDate,
    operatorCode: atocCode,
    operatorName: String(data.atocName ?? atocCode),
    operator: operatorFromAtoc(atocCode),
    originCrs: origin?.crs ?? "",
    originName: origin?.description ?? "",
    destinationCrs: destination?.crs ?? destUpper,
    destinationName: destination?.description ?? destUpper,
    scheduledArrival: scheduled,
    actualArrival: actual,
    delayMinutes,
    hasActual,
  };
}

export function supportedOperatorCodes(): string[] {
  return Object.keys(ATOC_TO_OPERATOR);
}
