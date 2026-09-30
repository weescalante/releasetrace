import { turso } from "./turso";

export type MatchReviewReason =
  | "UNMATCHED"
  | "AMBIGUOUS"
  | "TITLE_MISMATCH"
  | "MISSING_RELEASE_DATE";

export type MatchReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "IGNORED"
  | "RESOLVED";

export type MatchReviewDetectionType =
  | "CAM"
  | "WEB";

export type MatchReviewInput = {
  source: string;
  sourceUrl: string;

  sourceTitle: string;
  normalizedTitle: string;

  year: string | null;

  quality: string | null;

  detectionType: MatchReviewDetectionType;

  publishedAt: string | null;

  /*
   * Rich source evidence preserved for
   * AI verification.
   */
  sourceDescription?: string | null;
  sourceCountry?: string | null;
  sourceGenres?: string | null;
  sourceAudioLanguage?: string | null;
  sourceSubtitleLanguage?: string | null;

  reason: MatchReviewReason;

  candidateTmdbId?: number | null;

  candidateTitle?: string | null;

  candidateYear?: string | null;

  confidence?: number | null;

  details?: string | null;
};

export type AdminMatchReview = {
  id: number;

  source: string;
  sourceUrl: string;

  sourceTitle: string;
  normalizedTitle: string;

  year: string | null;

  quality: string | null;

  detectionType: MatchReviewDetectionType;

  publishedAt: string | null;

  sourceDescription: string | null;
  sourceCountry: string | null;
  sourceGenres: string | null;
  sourceAudioLanguage: string | null;
  sourceSubtitleLanguage: string | null;

  reason: MatchReviewReason;

  candidateTmdbId: number | null;

  candidateTitle: string | null;

  candidateYear: string | null;

  confidence: number | null;

  details: string | null;

  status: MatchReviewStatus;

  firstSeenAt: string;
  lastSeenAt: string;

  reviewedAt: string | null;
};

export type AdminMatchReviewPage = {
  reviews: AdminMatchReview[];

  total: number;

  limit: number;
  offset: number;

  hasMore: boolean;

  nextOffset: number | null;
};

export type MatchReviewStatusCounts = {
  pending: number;
  approved: number;
  ignored: number;
  resolved: number;
};

export type MatchReviewIdentity = {
  source: string;

  sourceUrl: string;

  /*
   * Retained because other parts of the
   * application already pass this value.
   *
   * It is no longer required when clearing
   * related reviews after a verified
   * detection is successfully stored.
   */
  normalizedTitle: string;

  year: string | null;

  detectionType: MatchReviewDetectionType;
};

type MatchReviewRow = {
  id: number;

  source: string;
  source_url: string;

  source_title: string;
  normalized_title: string;

  year: string | null;

  quality: string | null;

  detection_type: string;

  published_at: string | null;

  source_description: string | null;

  source_country: string | null;

  source_genres: string | null;

  source_audio_language: string | null;

  source_subtitle_language: string | null;

  reason: string;

  candidate_tmdb_id: number | null;

  candidate_title: string | null;

  candidate_year: string | null;

  confidence: number | null;

  details: string | null;

  status: string;

  first_seen_at: string;
  last_seen_at: string;

  reviewed_at: string | null;
};

let tableReady:
  Promise<void> | null =
  null;

function normalizeDate(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return parsed.toISOString();
}

function buildReviewKey(
  review: MatchReviewInput,
) {
  return [
    review.source,
    review.sourceUrl,
    review.normalizedTitle,
    review.year ?? "",
    review.detectionType,
    review.quality ?? "",
    review.reason,
    review.candidateTmdbId ?? "",
  ].join("||");
}

/*
 * The normal PENDING queue is an
 * operational queue rather than a
 * historical archive.
 *
 * In 2026:
 *
 * 2026 -> visible
 * 2024 -> hidden
 * 2001 -> hidden
 *
 * Unknown years remain visible because
 * they may genuinely require human review.
 */
const ACTIVE_REVIEW_YEAR_CLAUSE = `
  (
    year IS NULL

    OR trim(year) = ''

    OR CAST(year AS INTEGER) =
       CAST(
         strftime('%Y', 'now')
         AS INTEGER
       )
  )
`;

async function addColumnIfMissing(
  existingColumns: Set<string>,

  columnName: string,

  alterSql: string,
) {
  if (
    existingColumns.has(
      columnName,
    )
  ) {
    return;
  }

  try {
    await turso.execute(
      alterSql,
    );

    existingColumns.add(
      columnName,
    );
  } catch (error) {
    /*
     * Protect against two server instances
     * attempting the same migration at
     * roughly the same time.
     */
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : "";

    if (
      !message.includes(
        "duplicate column",
      )
    ) {
      throw error;
    }
  }
}

async function ensureMatchReviewTable() {
  if (!tableReady) {
    tableReady = (
      async () => {
        /*
         * Fresh databases get the complete
         * current schema immediately.
         */
        await turso.execute(`
          CREATE TABLE IF NOT EXISTS match_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            review_key TEXT NOT NULL UNIQUE,

            source TEXT NOT NULL,
            source_url TEXT NOT NULL,

            source_title TEXT NOT NULL,
            normalized_title TEXT NOT NULL,

            year TEXT,

            quality TEXT,

            detection_type TEXT NOT NULL,

            published_at TEXT,

            source_description TEXT,

            source_country TEXT,

            source_genres TEXT,

            source_audio_language TEXT,

            source_subtitle_language TEXT,

            reason TEXT NOT NULL,

            candidate_tmdb_id INTEGER,

            candidate_title TEXT,

            candidate_year TEXT,

            confidence REAL,

            details TEXT,

            status TEXT NOT NULL DEFAULT 'PENDING',

            first_seen_at TEXT NOT NULL,

            last_seen_at TEXT NOT NULL,

            reviewed_at TEXT
          )
        `);

        /*
         * CREATE TABLE IF NOT EXISTS does
         * not add columns to an already
         * existing SQLite table.
         *
         * Inspect the live schema and add
         * only fields that are missing.
         */
        const tableInfo =
          await turso.execute(`
            PRAGMA table_info(
              match_reviews
            )
          `);

        const existingColumns =
          new Set(
            tableInfo.rows.map(
              (row) =>
                String(
                  row.name ?? "",
                ),
            ),
          );

        await addColumnIfMissing(
          existingColumns,

          "source_description",

          `
            ALTER TABLE match_reviews
            ADD COLUMN source_description TEXT
          `,
        );

        await addColumnIfMissing(
          existingColumns,

          "source_country",

          `
            ALTER TABLE match_reviews
            ADD COLUMN source_country TEXT
          `,
        );

        await addColumnIfMissing(
          existingColumns,

          "source_genres",

          `
            ALTER TABLE match_reviews
            ADD COLUMN source_genres TEXT
          `,
        );

        await addColumnIfMissing(
          existingColumns,

          "source_audio_language",

          `
            ALTER TABLE match_reviews
            ADD COLUMN source_audio_language TEXT
          `,
        );

        await addColumnIfMissing(
          existingColumns,

          "source_subtitle_language",

          `
            ALTER TABLE match_reviews
            ADD COLUMN source_subtitle_language TEXT
          `,
        );

        await turso.execute(`
          CREATE INDEX IF NOT EXISTS
            idx_match_reviews_status

          ON match_reviews (
            status
          )
        `);

        await turso.execute(`
          CREATE INDEX IF NOT EXISTS
            idx_match_reviews_reason

          ON match_reviews (
            reason
          )
        `);

        await turso.execute(`
          CREATE INDEX IF NOT EXISTS
            idx_match_reviews_last_seen

          ON match_reviews (
            last_seen_at
          )
        `);

        await turso.execute(`
          CREATE INDEX IF NOT EXISTS
            idx_match_reviews_identity

          ON match_reviews (
            source,
            source_url,
            normalized_title,
            year,
            detection_type
          )
        `);
      }
    )();
  }

  try {
    await tableReady;
  } catch (error) {
    tableReady =
      null;

    throw error;
  }
}

function mapMatchReviewRow(
  row: MatchReviewRow,
): AdminMatchReview {
  return {
    id:
      Number(
        row.id,
      ),

    source:
      String(
        row.source,
      ),

    sourceUrl:
      String(
        row.source_url,
      ),

    sourceTitle:
      String(
        row.source_title,
      ),

    normalizedTitle:
      String(
        row.normalized_title,
      ),

    year:
      row.year === null
        ? null
        : String(
            row.year,
          ),

    quality:
      row.quality === null
        ? null
        : String(
            row.quality,
          ),

    detectionType:
      row.detection_type as
        MatchReviewDetectionType,

    publishedAt:
      row.published_at === null
        ? null
        : String(
            row.published_at,
          ),

    sourceDescription:
      row.source_description === null
        ? null
        : String(
            row.source_description,
          ),

    sourceCountry:
      row.source_country === null
        ? null
        : String(
            row.source_country,
          ),

    sourceGenres:
      row.source_genres === null
        ? null
        : String(
            row.source_genres,
          ),

    sourceAudioLanguage:
      row.source_audio_language === null
        ? null
        : String(
            row.source_audio_language,
          ),

    sourceSubtitleLanguage:
      row.source_subtitle_language === null
        ? null
        : String(
            row.source_subtitle_language,
          ),

    reason:
      row.reason as
        MatchReviewReason,

    candidateTmdbId:
      row.candidate_tmdb_id === null
        ? null
        : Number(
            row.candidate_tmdb_id,
          ),

    candidateTitle:
      row.candidate_title === null
        ? null
        : String(
            row.candidate_title,
          ),

    candidateYear:
      row.candidate_year === null
        ? null
        : String(
            row.candidate_year,
          ),

    confidence:
      row.confidence === null
        ? null
        : Number(
            row.confidence,
          ),

    details:
      row.details === null
        ? null
        : String(
            row.details,
          ),

    status:
      row.status as
        MatchReviewStatus,

    firstSeenAt:
      String(
        row.first_seen_at,
      ),

    lastSeenAt:
      String(
        row.last_seen_at,
      ),

    reviewedAt:
      row.reviewed_at === null
        ? null
        : String(
            row.reviewed_at,
          ),
  };
}

export async function saveMatchReview(
  review: MatchReviewInput,
): Promise<boolean> {
  await ensureMatchReviewTable();

  const now =
    new Date()
      .toISOString();

  const publishedAt =
    normalizeDate(
      review.publishedAt,
    );

  const reviewKey =
    buildReviewKey(
      review,
    );

  const result =
    await turso.execute({
      sql: `
        INSERT INTO match_reviews (
          review_key,

          source,
          source_url,

          source_title,
          normalized_title,

          year,

          quality,

          detection_type,

          published_at,

          source_description,

          source_country,

          source_genres,

          source_audio_language,

          source_subtitle_language,

          reason,

          candidate_tmdb_id,

          candidate_title,

          candidate_year,

          confidence,

          details,

          status,

          first_seen_at,
          last_seen_at
        )

        VALUES (
          ?,

          ?, ?,

          ?, ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          ?,

          'PENDING',

          ?,
          ?
        )

        ON CONFLICT(review_key)

        DO UPDATE SET

          source_title =
            excluded.source_title,

          normalized_title =
            excluded.normalized_title,

          year =
            excluded.year,

          quality =
            excluded.quality,

          detection_type =
            excluded.detection_type,

          published_at =
            excluded.published_at,

          /*
           * Preserve existing rich source
           * evidence if a later ingestion
           * happens to omit a field.
           */
          source_description =
            COALESCE(
              excluded.source_description,
              match_reviews.source_description
            ),

          source_country =
            COALESCE(
              excluded.source_country,
              match_reviews.source_country
            ),

          source_genres =
            COALESCE(
              excluded.source_genres,
              match_reviews.source_genres
            ),

          source_audio_language =
            COALESCE(
              excluded.source_audio_language,
              match_reviews.source_audio_language
            ),

          source_subtitle_language =
            COALESCE(
              excluded.source_subtitle_language,
              match_reviews.source_subtitle_language
            ),

          candidate_tmdb_id =
            excluded.candidate_tmdb_id,

          candidate_title =
            excluded.candidate_title,

          candidate_year =
            excluded.candidate_year,

          confidence =
            excluded.confidence,

          details =
            excluded.details,

          /*
           * Legacy RESOLVED rows may reopen
           * if the unresolved condition
           * appears again.
           *
           * APPROVED and IGNORED decisions
           * remain sticky.
           */
          status =
            CASE
              WHEN match_reviews.status = 'RESOLVED'
                THEN 'PENDING'

              ELSE match_reviews.status
            END,

          reviewed_at =
            CASE
              WHEN match_reviews.status = 'RESOLVED'
                THEN NULL

              ELSE match_reviews.reviewed_at
            END,

          last_seen_at =
            excluded.last_seen_at
      `,

      args: [
        reviewKey,

        review.source,
        review.sourceUrl,

        review.sourceTitle,
        review.normalizedTitle,

        review.year,

        review.quality,

        review.detectionType,

        publishedAt,

        review.sourceDescription ??
          null,

        review.sourceCountry ??
          null,

        review.sourceGenres ??
          null,

        review.sourceAudioLanguage ??
          null,

        review.sourceSubtitleLanguage ??
          null,

        review.reason,

        review.candidateTmdbId ??
          null,

        review.candidateTitle ??
          null,

        review.candidateYear ??
          null,

        review.confidence ??
          null,

        review.details ??
          null,

        now,
        now,
      ],
    });

  return (
    result.rowsAffected >
    0
  );
}

export async function getMatchReviewById(
  id: number,
): Promise<
  AdminMatchReview | null
> {
  await ensureMatchReviewTable();

  if (
    !Number.isInteger(
      id,
    ) ||
    id < 1
  ) {
    return null;
  }

  const result =
    await turso.execute({
      sql: `
        SELECT
          id,

          source,
          source_url,

          source_title,
          normalized_title,

          year,

          quality,

          detection_type,

          published_at,

          source_description,

          source_country,

          source_genres,

          source_audio_language,

          source_subtitle_language,

          reason,

          candidate_tmdb_id,

          candidate_title,

          candidate_year,

          confidence,

          details,

          status,

          first_seen_at,
          last_seen_at,

          reviewed_at

        FROM match_reviews

        WHERE id = ?

        LIMIT 1
      `,

      args: [
        id,
      ],
    });

  const row =
    result.rows[0] as unknown as
      MatchReviewRow |
      undefined;

  if (
    !row
  ) {
    return null;
  }

  return mapMatchReviewRow(
    row,
  );
}

export async function getAdminMatchReviewsPage({
  limit = 50,

  offset = 0,

  status = "PENDING",

  reason,
}: {
  limit?: number;

  offset?: number;

  status?:
    MatchReviewStatus;

  reason?:
    MatchReviewReason;
} = {}): Promise<
  AdminMatchReviewPage
> {
  await ensureMatchReviewTable();

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

  const whereParts = [
    "status = ?",
  ];

  const args:
    (
      | string
      | number
      | null
    )[] = [
      status,
    ];

  /*
   * PENDING is the active working queue.
   *
   * Historical movie years remain stored
   * but do not clutter normal operations.
   */
  if (
    status ===
    "PENDING"
  ) {
    whereParts.push(
      ACTIVE_REVIEW_YEAR_CLAUSE,
    );
  }

  if (
    reason
  ) {
    whereParts.push(
      "reason = ?",
    );

    args.push(
      reason,
    );
  }

  const whereClause =
    whereParts.join(
      " AND ",
    );

  const [
    reviewsResult,
    countResult,
  ] = await Promise.all([
    turso.execute({
      sql: `
        SELECT
          id,

          source,
          source_url,

          source_title,
          normalized_title,

          year,

          quality,

          detection_type,

          published_at,

          source_description,

          source_country,

          source_genres,

          source_audio_language,

          source_subtitle_language,

          reason,

          candidate_tmdb_id,

          candidate_title,

          candidate_year,

          confidence,

          details,

          status,

          first_seen_at,
          last_seen_at,

          reviewed_at

        FROM match_reviews

        WHERE ${whereClause}

        ORDER BY
          datetime(last_seen_at) DESC,
          id DESC

        LIMIT ?
        OFFSET ?
      `,

      args: [
        ...args,

        safeLimit,
        safeOffset,
      ],
    }),

    turso.execute({
      sql: `
        SELECT
          COUNT(*) AS total

        FROM match_reviews

        WHERE ${whereClause}
      `,

      args,
    }),
  ]);

  const rows =
    reviewsResult
      .rows as unknown as
      MatchReviewRow[];

  const total =
    Number(
      countResult
        .rows[0]
        ?.total ??
        0,
    );

  const reviews =
    rows.map(
      mapMatchReviewRow,
    );

  const nextOffset =
    safeOffset +
    reviews.length;

  const hasMore =
    nextOffset <
    total;

  return {
    reviews,

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

export async function getMatchReviewStatusCounts(): Promise<
  MatchReviewStatusCounts
> {
  await ensureMatchReviewTable();

  const result =
    await turso.execute(`
      SELECT
        status,
        COUNT(*) AS total

      FROM match_reviews

      GROUP BY status
    `);

  const counts:
    MatchReviewStatusCounts = {
      pending:
        0,

      approved:
        0,

      ignored:
        0,

      resolved:
        0,
    };

  for (
    const row of
      result.rows
  ) {
    const status =
      String(
        row.status ??
          "",
      );

    const total =
      Number(
        row.total ??
          0,
      );

    if (
      status ===
      "PENDING"
    ) {
      counts.pending =
        total;
    } else if (
      status ===
      "APPROVED"
    ) {
      counts.approved =
        total;
    } else if (
      status ===
      "IGNORED"
    ) {
      counts.ignored =
        total;
    } else if (
      status ===
      "RESOLVED"
    ) {
      counts.resolved =
        total;
    }
  }

  return counts;
}

export async function getPendingMatchReviewCount() {
  await ensureMatchReviewTable();

  const result =
    await turso.execute(`
      SELECT
        COUNT(*) AS total

      FROM match_reviews

      WHERE status = 'PENDING'

        AND ${ACTIVE_REVIEW_YEAR_CLAUSE}
    `);

  return Number(
    result.rows[0]
      ?.total ??
      0,
  );
}

export async function setMatchReviewStatus(
  id: number,

  status:
    MatchReviewStatus,
): Promise<boolean> {
  await ensureMatchReviewTable();

  const reviewedAt =
    status ===
    "PENDING"
      ? null
      : new Date()
          .toISOString();

  const result =
    await turso.execute({
      sql: `
        UPDATE match_reviews

        SET
          status = ?,
          reviewed_at = ?

        WHERE id = ?
      `,

      args: [
        status,

        reviewedAt,

        id,
      ],
    });

  return (
    result.rowsAffected >
    0
  );
}

/*
 * Once a detection has successfully passed
 * deterministic/AI verification AND has
 * actually been saved, related stale review
 * rows can be cleared.
 *
 * IMPORTANT:
 *
 * source_url is the strongest identifier
 * for a specific CinemaCity feed item.
 *
 * We intentionally DO NOT require an exact
 * normalized_title match here.
 *
 * Example:
 *
 * Earlier review:
 *
 * The Widower: &#039;Til Death Do Us Part
 *
 * Current normalized detection:
 *
 * The Widower: 'Til Death Do Us Part
 *
 * They are the same CinemaCity item because
 * they have the same source URL.
 *
 * Requiring title equality would incorrectly
 * leave the old review PENDING.
 *
 * We still require:
 *
 * - same source
 * - same source URL
 * - same reported year
 * - same detection type
 *
 * Therefore a different source item or a CAM
 * vs WEB detection cannot accidentally clear
 * the review.
 */
export async function approveRelatedMatchReviews(
  identity:
    MatchReviewIdentity,
): Promise<number> {
  await ensureMatchReviewTable();

  const now =
    new Date()
      .toISOString();

  const result =
    await turso.execute({
      sql: `
        UPDATE match_reviews

        SET
          status = 'APPROVED',
          reviewed_at = ?

        WHERE source = ?

          AND source_url = ?

          AND COALESCE(year, '') =
              COALESCE(?, '')

          AND detection_type = ?

          AND status IN (
            'PENDING',
            'RESOLVED'
          )
      `,

      args: [
        now,

        identity.source,

        identity.sourceUrl,

        identity.year,

        identity.detectionType,
      ],
    });

  return Number(
    result.rowsAffected ??
      0,
  );
}

export async function markMatchReviewApproved(
  id: number,
): Promise<boolean> {
  return setMatchReviewStatus(
    id,
    "APPROVED",
  );
}

export async function markMatchReviewIgnored(
  id: number,
): Promise<boolean> {
  return setMatchReviewStatus(
    id,
    "IGNORED",
  );
}