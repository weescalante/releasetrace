import { turso } from "./turso";

export type DetectionInput = {
  tmdbId: number | null;
  title: string;
  year: string;

  detectionType: string;
  quality: string;

  detectedAt: string;

  theatricalReleaseDate: string | null;
  theatricalReleaseRegion: string | null;

  digitalReleaseDate: string | null;
  digitalReleaseRegion: string | null;

  physicalReleaseDate: string | null;
  physicalReleaseRegion: string | null;

  posterPath: string | null;

  source: string;
  sourceUrl: string;
};

export type PublicDetection = {
  id: number;

  tmdbId: number | null;
  title: string;
  year: string | null;

  detectionType: "CAM" | "WEB";
  quality: string | null;

  detectedAt: string;

  relevantReleaseDate: string | null;
  relevantReleaseRegion: string | null;

  posterPath: string | null;
};

type DetectionRow = {
  id: number;

  tmdb_id: number | null;
  title: string;
  year: string | null;

  detection_type: string;
  quality: string | null;

  detected_at: string;

  theatrical_release_date: string | null;
  theatrical_release_region: string | null;

  digital_release_date: string | null;
  digital_release_region: string | null;

  physical_release_date: string | null;
  physical_release_region: string | null;

  poster_path: string | null;
};

export async function saveCloudDetection(
  detection: DetectionInput,
): Promise<boolean> {
  const result = await turso.execute({
    sql: `
      INSERT OR IGNORE INTO detections (
        tmdb_id,
        title,
        year,

        detection_type,
        quality,

        detected_at,

        theatrical_release_date,
        theatrical_release_region,

        digital_release_date,
        digital_release_region,

        physical_release_date,
        physical_release_region,

        poster_path,

        source,
        source_url
      )
      VALUES (
        ?, ?, ?,
        ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?,
        ?, ?
      )
    `,
    args: [
      detection.tmdbId,
      detection.title,
      detection.year,

      detection.detectionType,
      detection.quality,

      detection.detectedAt,

      detection.theatricalReleaseDate,
      detection.theatricalReleaseRegion,

      detection.digitalReleaseDate,
      detection.digitalReleaseRegion,

      detection.physicalReleaseDate,
      detection.physicalReleaseRegion,

      detection.posterPath,

      detection.source,
      detection.sourceUrl,
    ],
  });

  return result.rowsAffected > 0;
}

function getRelevantReleaseDate(
  row: DetectionRow,
): string | null {
  if (row.detection_type === "CAM") {
    return row.theatrical_release_date;
  }

  if (row.detection_type === "WEB") {
    return row.digital_release_date;
  }

  return null;
}

function getRelevantReleaseRegion(
  row: DetectionRow,
): string | null {
  if (row.detection_type === "CAM") {
    return row.theatrical_release_region;
  }

  if (row.detection_type === "WEB") {
    return row.digital_release_region;
  }

  return null;
}

function isRecentRelease(
  releaseDate: string | null,
): boolean {
  if (!releaseDate) {
    return false;
  }

  const release = new Date(releaseDate);
  const today = new Date();

  const daysDifference =
    (today.getTime() - release.getTime()) /
    (1000 * 60 * 60 * 24);

  return daysDifference >= -30 && daysDifference <= 120;
}

export async function getCloudPublicDetections(): Promise<
  PublicDetection[]
> {
  const result = await turso.execute(`
    SELECT
      id,
      tmdb_id,
      title,
      year,

      detection_type,
      quality,

      detected_at,

      theatrical_release_date,
      theatrical_release_region,

      digital_release_date,
      digital_release_region,

      physical_release_date,
      physical_release_region,

      poster_path
    FROM detections
    WHERE detection_type IN ('CAM', 'WEB')
  `);

  const rows =
    result.rows as unknown as DetectionRow[];

  return rows
    .map((row) => {
      const relevantReleaseDate =
        getRelevantReleaseDate(row);

      const relevantReleaseRegion =
        getRelevantReleaseRegion(row);

      return {
        id: Number(row.id),

        tmdbId:
          row.tmdb_id === null
            ? null
            : Number(row.tmdb_id),

        title: String(row.title),

        year:
          row.year === null
            ? null
            : String(row.year),

        detectionType:
          row.detection_type as "CAM" | "WEB",

        quality:
          row.quality === null
            ? null
            : String(row.quality),

        detectedAt: String(row.detected_at),

        relevantReleaseDate,
        relevantReleaseRegion,

        posterPath:
          row.poster_path === null
            ? null
            : String(row.poster_path),
      };
    })
    .filter((detection) =>
      isRecentRelease(
        detection.relevantReleaseDate,
      ),
    )
    .sort((a, b) => {
      const aTime = new Date(
        a.detectedAt,
      ).getTime();

      const bTime = new Date(
        b.detectedAt,
      ).getTime();

      const safeATime = Number.isNaN(aTime)
        ? 0
        : aTime;

      const safeBTime = Number.isNaN(bTime)
        ? 0
        : bTime;

      return safeBTime - safeATime;
    });
}