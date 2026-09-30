import { turso } from "./turso";

export type DetectionType =
  | "CAM"
  | "WEB";

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
 * same CinemaCity item.
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
 * PUBLIC SHADOW ZONE / WATCH LEAKS FILTER
 *
 * Public detection intelligence is focused
 * on the current release year.
 *
 * In 2026:
 *   only 2026 titles are eligible.
 *
 * In 2027:
 *   this automatically becomes 2027.
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

/*
 * ADMIN DETECTION FILTER
 *
 * Admin remains broader than the public
 * current-year view so historical detection
 * data remains inspectable.
 *
 * However, the same verification safeguard
 * applies:
 *
 * a detection with a matching PENDING
 * review is not treated as verified
 * Detection Intelligence.
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

            poster_path

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

  const result =
    await turso.execute(`
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
          ${camWhere}
        )

        OR

        (
          ${webWhere}
        )

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
 * detection history.
 *
 * Apply the pending-review safeguard here
 * as well so an unresolved legacy detection
 * cannot leak back into a public movie
 * detail page while being hidden from the
 * main detection feed.
 *
 * We do NOT impose the current-year filter
 * here because an approved historical
 * detection can still legitimately belong
 * in a movie's detection history.
 */
export async function getCloudPublicDetectionsByTmdbId(
  tmdbId: number,
): Promise<
  PublicDetection[]
> {
  const result =
    await turso.execute({
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

        WHERE tmdb_id = ?

          AND ${NO_PENDING_REVIEW_CLAUSE}

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