import {
  turso,
} from "./turso";

export type PredbTvDetectionInput = {
  tmdbId:
    number;

  title:
    string;

  year:
    string | null;

  quality:
    string | null;

  detectedAt:
    string;

  posterPath:
    string | null;

  sourceUrl:
    string | null;

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeTitle:
    string | null;

  episodeAirDate:
    string | null;
};

type ExistingPredbTvDetectionRow = {
  id:
    number;

  detected_at:
    string;

  source_url:
    string | null;

  quality:
    string | null;

  season_number:
    number | null;

  episode_number:
    number | null;

  episode_title:
    string | null;

  episode_air_date:
    string | null;
};

type SavePredbTvDetectionResult = {
  action:
    | "INSERTED"
    | "EARLIER_UPDATED"
    | "ALREADY_TRACKED";

  detectionId:
    number | null;

  detectedAt:
    string;
};

function getTimestamp(
  value:
    string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return Number.isNaN(
    timestamp,
  )
    ? null
    : timestamp;
}

function normalizeDateOnly(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function validateEpisodeIdentity(
  detection:
    PredbTvDetectionInput,
) {
  const hasSeason =
    detection
      .seasonNumber !==
    null;

  const hasEpisode =
    detection
      .episodeNumber !==
    null;

  if (
    hasSeason !==
    hasEpisode
  ) {
    throw new Error(
      "TV detection must provide both seasonNumber and episodeNumber together.",
    );
  }

  if (
    hasSeason &&
    hasEpisode
  ) {
    if (
      !Number.isInteger(
        detection
          .seasonNumber,
      ) ||
      !Number.isInteger(
        detection
          .episodeNumber,
      ) ||
      (
        detection
          .seasonNumber ??
        0
      ) <
        0 ||
      (
        detection
          .episodeNumber ??
        0
      ) <
        0
    ) {
      throw new Error(
        "TV season and episode numbers must be valid integers.",
      );
    }

    return;
  }

  if (
    !normalizeDateOnly(
      detection
        .episodeAirDate,
    )
  ) {
    throw new Error(
      "A TV detection without season/episode numbers requires episodeAirDate for logical identity.",
    );
  }
}

async function findBySeasonEpisode({
  tmdbId,

  seasonNumber,

  episodeNumber,
}: {
  tmdbId:
    number;

  seasonNumber:
    number;

  episodeNumber:
    number;
}) {
  const result =
    await turso.execute({
      sql: `
        SELECT
          id,
          detected_at,
          source_url,
          quality,

          season_number,
          episode_number,
          episode_title,
          episode_air_date

        FROM detections

        WHERE
          source = 'PreDB'

          AND media_type = 'TV'

          AND tmdb_id = ?

          AND detection_type = 'WEB'

          AND season_number = ?

          AND episode_number = ?

        ORDER BY
          datetime(
            detected_at
          ) ASC,
          id ASC

        LIMIT 1
      `,

      args: [
        tmdbId,

        seasonNumber,

        episodeNumber,
      ],
    });

  return result
    .rows[0] as unknown as
    | ExistingPredbTvDetectionRow
    | undefined;
}

async function findByEpisodeAirDate({
  tmdbId,

  episodeAirDate,
}: {
  tmdbId:
    number;

  episodeAirDate:
    string;
}) {
  const result =
    await turso.execute({
      sql: `
        SELECT
          id,
          detected_at,
          source_url,
          quality,

          season_number,
          episode_number,
          episode_title,
          episode_air_date

        FROM detections

        WHERE
          source = 'PreDB'

          AND media_type = 'TV'

          AND tmdb_id = ?

          AND detection_type = 'WEB'

          AND episode_air_date = ?

        ORDER BY
          datetime(
            detected_at
          ) ASC,
          id ASC

        LIMIT 1
      `,

      args: [
        tmdbId,

        episodeAirDate,
      ],
    });

  return result
    .rows[0] as unknown as
    | ExistingPredbTvDetectionRow
    | undefined;
}

/*
 * TV logical identity differs from movies.
 *
 * Movie:
 *
 *   TMDB ID + detection type
 *
 * TV:
 *
 *   TMDB TV ID
 *   + detection type
 *   + season
 *   + episode
 *
 * If season/episode numbers are unavailable,
 * episode air date is used as the fallback
 * identity.
 *
 * Example:
 *
 *   Fair City.2026.09.29
 *
 * can still remain separate from:
 *
 *   Fair City.2026.09.27
 *
 * even when PreDB does not provide SxxExx.
 */
async function findExistingTvDetection(
  detection:
    PredbTvDetectionInput,
) {
  if (
    detection
      .seasonNumber !==
      null &&
    detection
      .episodeNumber !==
      null
  ) {
    const exact =
      await findBySeasonEpisode({
        tmdbId:
          detection.tmdbId,

        seasonNumber:
          detection
            .seasonNumber,

        episodeNumber:
          detection
            .episodeNumber,
      });

    if (exact) {
      return exact;
    }
  }

  /*
   * Date lookup is also used as a secondary
   * fallback for SxxExx releases.
   *
   * This lets an older date-only record be
   * upgraded later if TMDB eventually gives
   * us the exact season/episode identity.
   */
  const airDate =
    normalizeDateOnly(
      detection
        .episodeAirDate,
    );

  if (airDate) {
    return await findByEpisodeAirDate({
      tmdbId:
        detection.tmdbId,

      episodeAirDate:
        airDate,
    });
  }

  return undefined;
}

async function findStoredRow(
  detection:
    PredbTvDetectionInput,
) {
  return await findExistingTvDetection(
    detection,
  );
}

async function insertTvDetection({
  detection,

  detectedAt,
}: {
  detection:
    PredbTvDetectionInput;

  detectedAt:
    string;
}) {
  await turso.execute({
    sql: `
      INSERT INTO detections (
        tmdb_id,
        title,
        year,

        detection_type,
        quality,

        detected_at,

        poster_path,

        source,
        source_url,

        media_type,

        season_number,
        episode_number,
        episode_title,
        episode_air_date
      )

      VALUES (
        ?, ?, ?,

        'WEB', ?,

        ?,

        ?,

        'PreDB', ?,

        'TV',

        ?, ?, ?, ?
      )

      ON CONFLICT (
        source,
        source_url,
        detection_type,
        detected_at
      )

      DO UPDATE SET

        tmdb_id =
          excluded.tmdb_id,

        title =
          excluded.title,

        year =
          excluded.year,

        quality =
          excluded.quality,

        poster_path =
          COALESCE(
            excluded.poster_path,
            detections.poster_path
          ),

        media_type =
          'TV',

        season_number =
          COALESCE(
            excluded.season_number,
            detections.season_number
          ),

        episode_number =
          COALESCE(
            excluded.episode_number,
            detections.episode_number
          ),

        episode_title =
          COALESCE(
            excluded.episode_title,
            detections.episode_title
          ),

        episode_air_date =
          COALESCE(
            excluded.episode_air_date,
            detections.episode_air_date
          )
    `,

    args: [
      detection.tmdbId,

      detection.title,

      detection.year,

      detection.quality,

      detectedAt,

      detection.posterPath,

      detection.sourceUrl,

      detection.seasonNumber,

      detection.episodeNumber,

      detection.episodeTitle,

      normalizeDateOnly(
        detection
          .episodeAirDate,
      ),
    ],
  });
}

async function enrichExistingTvDetection({
  existing,

  detection,
}: {
  existing:
    ExistingPredbTvDetectionRow;

  detection:
    PredbTvDetectionInput;
}) {
  /*
   * A later observation must never move the
   * first-seen clock forward.
   *
   * But it CAN enrich an older date-only
   * record with newly resolved episode
   * identity or metadata.
   */
  await turso.execute({
    sql: `
      UPDATE detections

      SET
        season_number =
          COALESCE(
            season_number,
            ?
          ),

        episode_number =
          COALESCE(
            episode_number,
            ?
          ),

        episode_title =
          COALESCE(
            episode_title,
            ?
          ),

        episode_air_date =
          COALESCE(
            episode_air_date,
            ?
          ),

        poster_path =
          COALESCE(
            poster_path,
            ?
          )

      WHERE id = ?
    `,

    args: [
      detection
        .seasonNumber,

      detection
        .episodeNumber,

      detection
        .episodeTitle,

      normalizeDateOnly(
        detection
          .episodeAirDate,
      ),

      detection
        .posterPath,

      Number(
        existing.id,
      ),
    ],
  });
}

/*
 * Save the earliest known PreDB availability
 * for one logical television episode.
 *
 * This function intentionally does NOT use
 * the movie-oriented
 * savePredbFirstSeenDetection().
 *
 * Movie identity:
 *
 *   PreDB + TMDB ID + type
 *
 * TV identity:
 *
 *   PreDB + TMDB TV ID + type
 *   + season + episode
 *
 * or, when SxxExx is unavailable:
 *
 *   PreDB + TMDB TV ID + type
 *   + episode air date
 */
export async function savePredbTvFirstSeenDetection(
  detection:
    PredbTvDetectionInput,
): Promise<
  SavePredbTvDetectionResult
> {
  if (
    !Number.isInteger(
      detection.tmdbId,
    ) ||
    detection.tmdbId <=
      0
  ) {
    throw new Error(
      "A verified TMDB TV ID is required before saving a PreDB TV detection.",
    );
  }

  validateEpisodeIdentity(
    detection,
  );

  const normalizedIncomingDate =
    new Date(
      detection.detectedAt,
    );

  if (
    Number.isNaN(
      normalizedIncomingDate
        .getTime(),
    )
  ) {
    throw new Error(
      `Invalid PreDB TV detection timestamp: ${detection.detectedAt}`,
    );
  }

  const incomingDetectedAt =
    normalizedIncomingDate
      .toISOString();

  const existing =
    await findExistingTvDetection(
      detection,
    );

  if (!existing) {
    await insertTvDetection({
      detection,

      detectedAt:
        incomingDetectedAt,
    });

    const inserted =
      await findStoredRow(
        detection,
      );

    return {
      action:
        "INSERTED",

      detectionId:
        inserted
          ? Number(
              inserted.id,
            )
          : null,

      detectedAt:
        inserted
          ? String(
              inserted
                .detected_at,
            )
          : incomingDetectedAt,
    };
  }

  const existingTimestamp =
    getTimestamp(
      String(
        existing
          .detected_at,
      ),
    );

  const incomingTimestamp =
    getTimestamp(
      incomingDetectedAt,
    );

  if (
    incomingTimestamp !==
      null &&
    (
      existingTimestamp ===
        null ||
      incomingTimestamp <
        existingTimestamp
    )
  ) {
    /*
     * We discovered an earlier PreDB
     * observation of this same episode.
     *
     * Move the logical first-seen event
     * backwards and refresh metadata from
     * that earlier observation.
     */
    await turso.execute({
      sql: `
        UPDATE detections

        SET
          tmdb_id = ?,

          title = ?,

          year = ?,

          quality = ?,

          detected_at = ?,

          poster_path =
            COALESCE(
              ?,
              poster_path
            ),

          source_url = ?,

          media_type = 'TV',

          season_number =
            COALESCE(
              ?,
              season_number
            ),

          episode_number =
            COALESCE(
              ?,
              episode_number
            ),

          episode_title =
            COALESCE(
              ?,
              episode_title
            ),

          episode_air_date =
            COALESCE(
              ?,
              episode_air_date
            )

        WHERE id = ?
      `,

      args: [
        detection.tmdbId,

        detection.title,

        detection.year,

        detection.quality,

        incomingDetectedAt,

        detection.posterPath,

        detection.sourceUrl,

        detection
          .seasonNumber,

        detection
          .episodeNumber,

        detection
          .episodeTitle,

        normalizeDateOnly(
          detection
            .episodeAirDate,
        ),

        Number(
          existing.id,
        ),
      ],
    });

    return {
      action:
        "EARLIER_UPDATED",

      detectionId:
        Number(
          existing.id,
        ),

      detectedAt:
        incomingDetectedAt,
    };
  }

  await enrichExistingTvDetection({
    existing,

    detection,
  });

  /*
   * This episode is already known and the
   * stored timestamp is earlier than or equal
   * to the incoming observation.
   *
   * Preserve first-seen time.
   */
  return {
    action:
      "ALREADY_TRACKED",

    detectionId:
      Number(
        existing.id,
      ),

    detectedAt:
      String(
        existing
          .detected_at,
      ),
  };
}