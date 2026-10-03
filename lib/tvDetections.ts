import {
  turso,
} from "./turso";

export type PublicTvDetection = {
  id:
    number;

  tmdbId:
    number;

  title:
    string;

  year:
    string | null;

  detectionType:
    "WEB";

  quality:
    string | null;

  detectedAt:
    string;

  posterPath:
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

type TvDetectionRow = {
  id:
    number;

  tmdb_id:
    number;

  title:
    string;

  year:
    string | null;

  detection_type:
    string;

  quality:
    string | null;

  detected_at:
    string;

  poster_path:
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

function mapTvDetectionRow(
  row:
    TvDetectionRow,
): PublicTvDetection {
  return {
    id:
      Number(
        row.id,
      ),

    tmdbId:
      Number(
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
      "WEB",

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

    posterPath:
      row.poster_path ===
      null
        ? null
        : String(
            row.poster_path,
          ),

    seasonNumber:
      row.season_number ===
      null
        ? null
        : Number(
            row.season_number,
          ),

    episodeNumber:
      row.episode_number ===
      null
        ? null
        : Number(
            row.episode_number,
          ),

    episodeTitle:
      row.episode_title ===
      null
        ? null
        : String(
            row.episode_title,
          ),

    episodeAirDate:
      row.episode_air_date ===
      null
        ? null
        : String(
            row.episode_air_date,
          ),
  };
}

/*
 * Public television detection identity
 * is episode-specific.
 *
 * Preferred identity:
 *
 *   TMDB TV ID
 *   + detection type
 *   + season
 *   + episode
 *
 * Fallback identity:
 *
 *   TMDB TV ID
 *   + detection type
 *   + episode air date
 *
 * This prevents separate episodes from
 * collapsing into one show-level WEB event.
 */
export async function getPublicTvDetectionsByTmdbId(
  tmdbId:
    number,
): Promise<
  PublicTvDetection[]
> {
  if (
    !Number.isInteger(
      tmdbId,
    ) ||
    tmdbId <=
      0
  ) {
    return [];
  }

  const result =
    await turso.execute({
      sql: `
        WITH eligible_detections AS (

          SELECT
            id,
            tmdb_id,
            title,
            year,

            detection_type,
            quality,
            detected_at,

            poster_path,

            season_number,
            episode_number,
            episode_title,
            episode_air_date,

            CASE

              WHEN
                season_number IS NOT NULL
                AND episode_number IS NOT NULL

              THEN
                'episode:' ||
                CAST(
                  season_number
                  AS TEXT
                ) ||
                ':' ||
                CAST(
                  episode_number
                  AS TEXT
                )

              WHEN
                episode_air_date IS NOT NULL

              THEN
                'date:' ||
                episode_air_date

              ELSE
                'row:' ||
                CAST(
                  id
                  AS TEXT
                )

            END
              AS episode_identity_key

          FROM detections

          WHERE
            media_type = 'TV'

            AND detection_type = 'WEB'

            AND tmdb_id = ?
        ),

        ranked_detections AS (

          SELECT
            *,

            ROW_NUMBER() OVER (

              PARTITION BY
                tmdb_id,
                detection_type,
                episode_identity_key

              ORDER BY
                datetime(
                  detected_at
                ) ASC,
                id ASC

            ) AS public_rank

          FROM eligible_detections
        )

        SELECT
          id,
          tmdb_id,
          title,
          year,

          detection_type,
          quality,
          detected_at,

          poster_path,

          season_number,
          episode_number,
          episode_title,
          episode_air_date

        FROM ranked_detections

        WHERE
          public_rank = 1

        ORDER BY
          CASE
            WHEN
              episode_air_date IS NULL
            THEN
              1
            ELSE
              0
          END ASC,

          date(
            episode_air_date
          ) DESC,

          datetime(
            detected_at
          ) DESC,

          season_number DESC,
          episode_number DESC,
          id DESC
      `,

      args: [
        tmdbId,
      ],
    });

  const rows =
    result.rows as unknown as
    TvDetectionRow[];

  return rows.map(
    mapTvDetectionRow,
  );
}