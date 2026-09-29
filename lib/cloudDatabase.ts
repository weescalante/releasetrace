import { turso } from "./turso";

export type DetectionType = "CAM" | "WEB";

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

  detectionType: DetectionType;
  quality: string | null;

  detectedAt: string;

  relevantReleaseDate: string | null;
  relevantReleaseRegion: string | null;

  posterPath: string | null;
};

export type PublicDetectionPage = {
  detections: PublicDetection[];

  total: number;

  limit: number;
  offset: number;

  hasMore: boolean;

  nextOffset: number | null;
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

function normalizeDetectedAt(
  detectedAt: string,
): string {
  const parsedDate = new Date(detectedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return detectedAt;
  }

  return parsedDate.toISOString();
}

export async function saveCloudDetection(
  detection: DetectionInput,
): Promise<boolean> {
  const normalizedDetectedAt =
    normalizeDetectedAt(
      detection.detectedAt,
    );

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

      normalizedDetectedAt,

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

function mapDetectionRow(
  row: DetectionRow,
): PublicDetection {
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
      row.detection_type as DetectionType,

    quality:
      row.quality === null
        ? null
        : String(row.quality),

    detectedAt: String(row.detected_at),

    relevantReleaseDate:
      getRelevantReleaseDate(row),

    relevantReleaseRegion:
      getRelevantReleaseRegion(row),

    posterPath:
      row.poster_path === null
        ? null
        : String(row.poster_path),
  };
}

function getDetectionWhereClause(
  detectionType: DetectionType,
) {
  if (detectionType === "CAM") {
    return `
      detection_type = 'CAM'

      AND theatrical_release_date IS NOT NULL

      AND date(theatrical_release_date)
        BETWEEN date('now', '-120 days')
        AND date('now', '+30 days')
    `;
  }

  return `
    detection_type = 'WEB'

    AND digital_release_date IS NOT NULL

    AND date(digital_release_date)
      BETWEEN date('now', '-120 days')
      AND date('now', '+30 days')
  `;
}

export async function getCloudPublicDetectionsPage({
  detectionType,
  limit = 8,
  offset = 0,
}: {
  detectionType: DetectionType;
  limit?: number;
  offset?: number;
}): Promise<PublicDetectionPage> {
  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    50,
  );

  const safeOffset = Math.max(
    Math.floor(offset),
    0,
  );

  const whereClause =
    getDetectionWhereClause(
      detectionType,
    );

  const [
    detectionsResult,
    countResult,
  ] = await Promise.all([
    turso.execute({
      sql: `
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

        WHERE ${whereClause}

        ORDER BY
          datetime(detected_at) DESC,
          id DESC

        LIMIT ?
        OFFSET ?
      `,
      args: [
        safeLimit,
        safeOffset,
      ],
    }),

    turso.execute(`
      SELECT
        COUNT(*) AS total
      FROM detections

      WHERE ${whereClause}
    `),
  ]);

  const rows =
    detectionsResult.rows as unknown as DetectionRow[];

  const total = Number(
    countResult.rows[0]?.total ?? 0,
  );

  const detections =
    rows.map(mapDetectionRow);

  const nextOffset =
    safeOffset + detections.length;

  const hasMore =
    nextOffset < total;

  return {
    detections,

    total,

    limit: safeLimit,
    offset: safeOffset,

    hasMore,

    nextOffset:
      hasMore
        ? nextOffset
        : null,
  };
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

    WHERE
      (
        detection_type = 'CAM'

        AND theatrical_release_date IS NOT NULL

        AND date(theatrical_release_date)
          BETWEEN date('now', '-120 days')
          AND date('now', '+30 days')
      )

      OR

      (
        detection_type = 'WEB'

        AND digital_release_date IS NOT NULL

        AND date(digital_release_date)
          BETWEEN date('now', '-120 days')
          AND date('now', '+30 days')
      )

    ORDER BY
      datetime(detected_at) DESC,
      id DESC
  `);

  const rows =
    result.rows as unknown as DetectionRow[];

  return rows.map(mapDetectionRow);
}