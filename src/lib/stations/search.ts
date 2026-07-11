import stationsData from "uk-railway-stations";

export type Station = {
  stationName: string;
  crsCode: string;
  lat?: number;
  long?: number;
  constituentCountry?: string;
};

const stations = stationsData as Station[];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findStationByCrs(crs: string): Station | undefined {
  const code = crs.trim().toUpperCase();
  return stations.find((s) => s.crsCode === code);
}

/**
 * Ranked station suggestions by name or CRS.
 * Exact CRS / name prefix match first, then substring matches.
 */
export function searchStations(query: string, limit = 8): Station[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const qNorm = normalize(q);
  const qUpper = q.toUpperCase();
  const scored: Array<{ station: Station; score: number }> = [];

  for (const station of stations) {
    const nameNorm = normalize(station.stationName);
    const crs = station.crsCode;

    let score = -1;
    if (crs === qUpper) score = 100;
    else if (crs.startsWith(qUpper) && qUpper.length >= 2) score = 90;
    else if (nameNorm === qNorm) score = 80;
    else if (nameNorm.startsWith(qNorm)) score = 70;
    else if (nameNorm.includes(` ${qNorm}`)) score = 55;
    else if (nameNorm.includes(qNorm)) score = 40;
    else if (crs.includes(qUpper) && qUpper.length >= 2) score = 30;

    if (score >= 0) scored.push({ station, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.station.stationName.localeCompare(b.station.stationName);
  });

  return scored.slice(0, limit).map((s) => s.station);
}
