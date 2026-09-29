export type RedZoneObservation = {
  tmdbId: number;
  signal: "CAM" | "WEB";
  firstSeen: string;
};

export const redZoneObservations: RedZoneObservation[] = [];