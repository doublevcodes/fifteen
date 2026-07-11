/// <reference types="node" />

declare module "uk-railway-stations" {
  type Station = {
    stationName: string;
    lat: number;
    long: number;
    crsCode: string;
    iataAirportCode?: string | null;
    constituentCountry: string;
  };
  const stations: Station[];
  export default stations;
}
