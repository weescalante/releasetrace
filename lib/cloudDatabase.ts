import { turso } from "./turso";

export type DetectionType =
  | "CAM"
  | "WEB"
  | "BLURAY";

export type DetectionInput = {
  tmdbId: number | null;

  title: string;

  year: string;

  detectionType: string;

  quality: string;

  detectedAt: string;

  theatricalReleaseDate:
    string | null;

  theatricalReleaseRegion:
    string | null;

  digitalReleaseDate:
    string | null;

  digitalReleaseRegion:
    string | null;

  physicalReleaseDate:
    string | null;

  physicalReleaseRegion:
    string | null;

  posterPath:
    string | null;

  source: string;

  sourceUrl: string;
};

export type PublicDetection = {
  id: number;

  tmdbId: number | null;

  title: string;

  year: string | null;

  detectionType:
    DetectionType;

  quality:
    string | null;

  detectedAt:
    string;

  relevantReleaseDate:
    string | null;

  relevantReleaseRegion:
    string | null;

  posterPath:
    string | null;
};

export type PublicDetectionPage = {
  detections:
    PublicDetection[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;

  nextOffset:
    number | null;
};

export type AdminDetection = {
  id: number;

  tmdbId: number | null;

  title: string;

  year: string | null;

  detectionType:
    DetectionType;

  quality:
    string | null;

  detectedAt:
    string;

  theatricalReleaseDate:
    string | null;

  theatricalReleaseRegion:
    string | null;

  digitalReleaseDate:
    string | null;

  digitalReleaseRegion:
    string | null;

  physicalReleaseDate:
    string | null;

  physicalReleaseRegion:
    string | null;

  posterPath:
    string | null;

  source: string;

  sourceUrl: string;
};

export type AdminDetectionPage = {
  detections:
    AdminDetection[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;

  nextOffset:
    number | null;
};

type DetectionRow = {
  id: number;

  tmdb_id:
    number | null;

  title: string;

  year:
    string | null;

  detection_type:
    string;

  quality:
    string | null;

  detected_at:
    string;

  theatrical_release_date:
    string | null;

  theatrical_release_region:
    string | null;

  digital_release_date:
    string | null;

  digital_release_region:
    string | null;

  physical_release_date:
    string | null;

  physical_release_region:
    string | null;

  poster_path:
    string | null;
};

type AdminDetectionRow =
  DetectionRow & {
    source: string;

    source_url: string;
  };

function normalizeDetectedAt(
  detectedAt: string,
): string {
  const parsedDate =
    new Date(
      detectedAt,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return detectedAt;
  }

  return parsedDate.toISOString();
}

export async function saveCloudDetection(
  detection:
    DetectionInput,
): Promise<boolean> {
  const normalizedDetectedAt =
    normalizeDetectedAt(
      detection.detectedAt,
    );

  const result =
    await turso.execute({
      sql: `
        INSERT INTO detections (
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

        ON CONFLICT (
          source,
          source_url,
          detection_type,
          detected_at
        )

        DO UPDATE SET

          tmdb_id =
            COALESCE(
              excluded.tmdb_id,
              detections.tmdb_id
            ),

          title =
            excluded.title,

          year =
            excluded.year,

          quality =
            excluded.quality,

          theatrical_release_date =
            COALESCE(
              excluded.theatrical_release_date,
              detections.theatrical_release_date
            ),

          theatrical_release_region =
            COALESCE(
              excluded.theatrical_release_region,
              detections.theatrical_release_region
            ),

          digital_release_date =
            COALESCE(
              excluded.digital_release_date,
              detections.digital_release_date
            ),

          digital_release_region =
            COALESCE(
              excluded.digital_release_region,
              detections.digital_release_region
            ),

          physical_release_date =
            COALESCE(
              excluded.physical_release_date,
              detections.physical_release_date
            ),

          physical_release_region =
            COALESCE(
              excluded.physical_release_region,
              detections.physical_release_region
            ),

          poster_path =
            COALESCE(
              excluded.poster_path,
              detections.poster_path
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

  return (
    result.rowsAffected >
    0
  );
}

function getRelevantReleaseDate(
  row: DetectionRow,
): string | null {
  if (
    row.detection_type ===
    "CAM"
  ) {
    return row
      .theatrical_release_date;
  }

  if (
    row.detection_type ===
    "WEB"
  ) {
    return row
      .digital_release_date;
  }

  if (
    row.detection_type ===
    "BLURAY"
  ) {
    return row
      .physical_release_date;
  }

  return null;
}

function getRelevantReleaseRegion(
  row: DetectionRow,
): string | null {
  if (
    row.detection_type ===
    "CAM"
  ) {
    return row
      .theatrical_release_region;
  }

  if (
    row.detection_type ===
    "WEB"
  ) {
    return row
      .digital_release_region;
  }

  if (
    row.detection_type ===
    "BLURAY"
  ) {
    return row
      .physical_release_region;
  }

  return null;
}

function mapDetectionRow(
  row: DetectionRow,
): PublicDetection {
  return {
    id:
      Number(
        row.id,
      ),

    tmdbId:
      row.tmdb_id ===
      null
        ? null
        : Number(
            row.tmdb_id,
          ),

    title:
      String(
        row.title,
      ),

    year:
      row.year ===
      null
        ? null
        : String(
            row.year,
          ),

    detectionType:
      row.detection_type as
        DetectionType,

    quality:
      row.quality ===
      null
        ? null
        : String(
            row.quality,
          ),

    detectedAt:
      String(
        row.detected_at,
      ),

    relevantReleaseDate:
      getRelevantReleaseDate(
        row,
      ),

    relevantReleaseRegion:
      getRelevantReleaseRegion(
        row,
      ),

    posterPath:
      row.poster_path ===
      null
        ? null
        : String(
            row.poster_path,
          ),
  };
}

function mapAdminDetectionRow(
  row:
    AdminDetectionRow,
): AdminDetection {
  return {
    id:
      Number(
        row.id,
      ),

    tmdbId:
      row.tmdb_id ===
      null
        ? null
        : Number(
            row.tmdb_id,
          ),

    title:
      String(
        row.title,
      ),

    year:
      row.year ===
      null
        ? null
        : String(
            row.year,
          ),

    detectionType:
      row.detection_type as
        DetectionType,

    quality:
      row.quality ===
      null
        ? null
        : String(
            row.quality,
          ),

    detectedAt:
      String(
        row.detected_at,
      ),

    theatricalReleaseDate:
      row
        .theatrical_release_date ===
      null
        ? null
        : String(
            row
              .theatrical_release_date,
          ),

    theatricalReleaseRegion:
      row
        .theatrical_release_region ===
      null
        ? null
        : String(
            row
              .theatrical_release_region,
          ),

    digitalReleaseDate:
      row
        .digital_release_date ===
      null
        ? null
        : String(
            row
              .digital_release_date,
          ),

    digitalReleaseRegion:
      row
        .digital_release_region ===
      null
        ? null
        : String(
            row
              .digital_release_region,
          ),

    physicalReleaseDate:
      row
        .physical_release_date ===
      null
        ? null
        : String(
            row
              .physical_release_date,
          ),

    physicalReleaseRegion:
      row
        .physical_release_region ===
      null
        ? null
        : String(
            row
              .physical_release_region,
          ),

    posterPath:
      row.poster_path ===
      null
        ? null
        : String(
            row.poster_path,
          ),

    source:
      String(
        row.source,
      ),

    sourceUrl:
      String(
        row.source_url,
      ),
  };
}

/*
 * VERIFIED-DETECTION SAFEGUARD
 *
 * A detection must not be shown while the
 * exact source item still has an unresolved
 * PENDING Match Review.
 *
 * We match reviews to detections by:
 *
 * - source
 * - source URL
 * - reported year
 * - detection type
 *
 * We intentionally do NOT compare title
 * strings here because HTML decoding or
 * normalization may change title text while
 * the source URL still identifies the exact
 * same source item.
 *
 * Nothing is deleted from detections.
 *
 * Once the review stops being PENDING, the
 * detection automatically becomes eligible
 * to appear again.
 */
const NO_PENDING_REVIEW_CLAUSE = `
  NOT EXISTS (
    SELECT
      1

    FROM match_reviews AS pending_review

    WHERE
      pending_review.status = 'PENDING'

      AND pending_review.source =
          detections.source

      AND pending_review.source_url =
          detections.source_url

      AND COALESCE(
            pending_review.year,
            ''
          ) =
          COALESCE(
            detections.year,
            ''
          )

      AND pending_review.detection_type =
          detections.detection_type
  )
`;

/*
 * PUBLIC DETECTION IDENTITY
 *
 * Public feeds should represent a detection
 * EVENT, not every individual source
 * observation.
 *
 * Primary identity:
 *
 *   TMDB ID + detection type
 *
 * Example:
 *
 *   TMDB 123 + WEB
 *
 * If TMDB ID is unavailable, fall back to:
 *
 *   normalized title + year + type
 *
 * The detection type itself is partitioned
 * separately in the dedupe query.
 *
 * This means a movie can legitimately have:
 *
 *   one CAM event
 *   one WEB event
 *   one BLURAY event
 *
 * while multiple sources observing the same
 * WEB event do not create duplicate public
 * cards.
 */
function getPublicIdentityKeySql() {
  return `
    CASE

      WHEN
        tmdb_id IS NOT NULL

      THEN
        'tmdb:' ||
        CAST(
          tmdb_id
          AS TEXT
        )

      ELSE
        'title:' ||
        LOWER(
          TRIM(
            COALESCE(
              title,
              ''
            )
          )
        ) ||
        '|year:' ||
        COALESCE(
          year,
          ''
        )

    END
  `;
}

/*
 * PUBLIC DEDUPLICATION
 *
 * All eligible source observations remain
 * stored in Turso.
 *
 * Public feeds collapse observations that
 * resolve to the same:
 *
 *   movie + detection type
 *
 * The earliest detected_at observation wins.
 *
 * This preserves Watch Leaks' first-seen
 * timestamp even when another monitored
 * source sees the same availability later.
 */
function getPublicDedupedCte(
  whereClause: string,
) {
  const identityKey =
    getPublicIdentityKeySql();

  return `
    WITH eligible_detections AS (

      SELECT
        *,

        ${identityKey}
          AS public_identity_key

      FROM detections

      WHERE
        ${whereClause}
    ),

    ranked_detections AS (

      SELECT
        *,

        ROW_NUMBER() OVER (

          PARTITION BY
            detection_type,
            public_identity_key

          ORDER BY
            datetime(
              detected_at
            ) ASC,
            id ASC

        ) AS public_rank

      FROM eligible_detections
    )
  `;
}

/*
 * PUBLIC WATCH LEAKS FILTER
 *
 * CAM and WEB public intelligence remains
 * focused on the current release year.
 *
 * BLURAY is intentionally different:
 * Latest Blu-rays is a real-time availability
 * feed, so any verified Blu-ray detection is
 * eligible when its detected_at timestamp is
 * recent, regardless of the movie's original
 * release year or whether TMDB has an official
 * physical-release date.
 *
 * Historical records remain in Turso.
 */
function getPublicDetectionWhereClause(
  detectionType:
    DetectionType,
) {
  const currentYearClause = `
    CAST(year AS INTEGER) =
    CAST(
      strftime('%Y', 'now')
      AS INTEGER
    )
  `;

  if (
    detectionType ===
    "CAM"
  ) {
    return `
      detection_type = 'CAM'

      AND ${currentYearClause}

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          theatrical_release_date IS NOT NULL

          AND date(
            theatrical_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          theatrical_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    `;
  }

  if (
    detectionType ===
    "WEB"
  ) {
    return `
      detection_type = 'WEB'

      AND ${currentYearClause}

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          digital_release_date IS NOT NULL

          AND date(
            digital_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          digital_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    `;
  }

  return `
    detection_type = 'BLURAY'

    AND ${NO_PENDING_REVIEW_CLAUSE}

    AND date(
      detected_at
    )
      BETWEEN date(
        'now',
        '-120 days'
      )
      AND date(
        'now',
        '+1 day'
      )
  `;
}

/*
 * ADMIN DETECTION FILTER
 *
 * Admin remains broader than the public
 * current-year view so historical detection
 * data remains inspectable.
 *
 * Admin intentionally does NOT use the
 * public dedupe layer.
 *
 * Every underlying monitored-source
 * observation remains visible to Admin.
 */
function getAdminDetectionWhereClause(
  detectionType?:
    DetectionType,
) {
  if (
    detectionType ===
    "CAM"
  ) {
    return `
      detection_type = 'CAM'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          theatrical_release_date IS NOT NULL

          AND date(
            theatrical_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          theatrical_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    `;
  }

  if (
    detectionType ===
    "WEB"
  ) {
    return `
      detection_type = 'WEB'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          digital_release_date IS NOT NULL

          AND date(
            digital_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          digital_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    `;
  }

  if (
    detectionType ===
    "BLURAY"
  ) {
    return `
      detection_type = 'BLURAY'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND date(
        detected_at
      )
        BETWEEN date(
          'now',
          '-120 days'
        )
        AND date(
          'now',
          '+1 day'
        )
    `;
  }

  return `
    (
      detection_type = 'CAM'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          theatrical_release_date IS NOT NULL

          AND date(
            theatrical_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          theatrical_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    )

    OR

    (
      detection_type = 'WEB'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND
      (
        (
          digital_release_date IS NOT NULL

          AND date(
            digital_release_date
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+30 days'
            )
        )

        OR

        (
          digital_release_date IS NULL

          AND date(
            detected_at
          )
            BETWEEN date(
              'now',
              '-120 days'
            )
            AND date(
              'now',
              '+1 day'
            )
        )
      )
    )

    OR

    (
      detection_type = 'BLURAY'

      AND ${NO_PENDING_REVIEW_CLAUSE}

      AND date(
        detected_at
      )
        BETWEEN date(
          'now',
          '-120 days'
        )
        AND date(
          'now',
          '+1 day'
        )
    )
  `;
}

export async function getCloudPublicDetectionsPage({
  detectionType,

  limit = 8,

  offset = 0,
}: {
  detectionType:
    DetectionType;

  limit?: number;

  offset?: number;
}): Promise<
  PublicDetectionPage
> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(
          limit,
        ),
        1,
      ),
      50,
    );

  const safeOffset =
    Math.max(
      Math.floor(
        offset,
      ),
      0,
    );

  const whereClause =
    getPublicDetectionWhereClause(
      detectionType,
    );

  const dedupedCte =
    getPublicDedupedCte(
      whereClause,
    );

  const [
    detectionsResult,
    countResult,
  ] =
    await Promise.all([
      turso.execute({
        sql: `
          ${dedupedCte}

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

          FROM ranked_detections

          WHERE
            public_rank = 1

          ORDER BY
            datetime(
              detected_at
            ) DESC,
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
        ${dedupedCte}

        SELECT
          COUNT(*) AS total

        FROM ranked_detections

        WHERE
          public_rank = 1
      `),
    ]);

  const rows =
    detectionsResult
      .rows as unknown as
      DetectionRow[];

  const total =
    Number(
      countResult
        .rows[0]
        ?.total ??
        0,
    );

  const detections =
    rows.map(
      mapDetectionRow,
    );

  const nextOffset =
    safeOffset +
    detections.length;

  const hasMore =
    nextOffset <
    total;

  return {
    detections,

    total,

    limit:
      safeLimit,

    offset:
      safeOffset,

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
  const camWhere =
    getPublicDetectionWhereClause(
      "CAM",
    );

  const webWhere =
    getPublicDetectionWhereClause(
      "WEB",
    );

  const blurayWhere =
    getPublicDetectionWhereClause(
      "BLURAY",
    );

  const combinedWhere = `
    (
      ${camWhere}
    )

    OR

    (
      ${webWhere}
    )

    OR

    (
      ${blurayWhere}
    )
  `;

  const dedupedCte =
    getPublicDedupedCte(
      combinedWhere,
    );

  const result =
    await turso.execute(`
      ${dedupedCte}

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

      FROM ranked_detections

      WHERE
        public_rank = 1

      ORDER BY
        datetime(
          detected_at
        ) DESC,
        id DESC
    `);

  const rows =
    result.rows as unknown as
      DetectionRow[];

  return rows.map(
    mapDetectionRow,
  );
}

/*
 * Movie detail pages use this function for
 * public detection history.
 *
 * Public history uses the same logical-event
 * dedupe rule as the main Watch Leaks feeds.
 *
 * If CinemaCity and PreDB both identify the
 * same movie's WEB availability, the movie
 * detail page shows one WEB event using the
 * earliest detected_at timestamp.
 *
 * Underlying source observations remain in
 * Turso and remain available to Admin.
 */
export async function getCloudPublicDetectionsByTmdbId(
  tmdbId: number,
): Promise<
  PublicDetection[]
> {
  const whereClause = `
    tmdb_id = ?

    AND ${NO_PENDING_REVIEW_CLAUSE}
  `;

  const dedupedCte =
    getPublicDedupedCte(
      whereClause,
    );

  const result =
    await turso.execute({
      sql: `
        ${dedupedCte}

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

        FROM ranked_detections

        WHERE
          public_rank = 1

        ORDER BY
          datetime(
            detected_at
          ) ASC,
          id ASC
      `,

      args: [
        tmdbId,
      ],
    });

  const rows =
    result.rows as unknown as
      DetectionRow[];

  return rows.map(
    mapDetectionRow,
  );
}

export async function getCloudAdminDetectionsPage({
  limit = 50,

  offset = 0,

  detectionType,
}: {
  limit?: number;

  offset?: number;

  detectionType?:
    DetectionType;
} = {}): Promise<
  AdminDetectionPage
> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(
          limit,
        ),
        1,
      ),
      100,
    );

  const safeOffset =
    Math.max(
      Math.floor(
        offset,
      ),
      0,
    );

  const whereClause =
    getAdminDetectionWhereClause(
      detectionType,
    );

  const [
    detectionsResult,
    countResult,
  ] =
    await Promise.all([
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

            poster_path,

            source,
            source_url

          FROM detections

          WHERE
            ${whereClause}

          ORDER BY
            datetime(
              detected_at
            ) DESC,
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

        WHERE
          ${whereClause}
      `),
    ]);

  const rows =
    detectionsResult
      .rows as unknown as
      AdminDetectionRow[];

  const total =
    Number(
      countResult
        .rows[0]
        ?.total ??
        0,
    );

  const detections =
    rows.map(
      mapAdminDetectionRow,
    );

  const nextOffset =
    safeOffset +
    detections.length;

  const hasMore =
    nextOffset <
    total;

  return {
    detections,

    total,

    limit:
      safeLimit,

    offset:
      safeOffset,

    hasMore,

    nextOffset:
      hasMore
        ? nextOffset
        : null,
  };
}