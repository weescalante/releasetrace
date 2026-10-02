import {
  saveCloudDetection,
  type DetectionInput,
} from "./cloudDatabase";

import {
  turso,
} from "./turso";

type ExistingPredbDetectionRow = {
  id: number;

  detected_at: string;

  source_url: string;

  quality:
    string | null;
};

function getTimestamp(
  value: string,
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

/*
 * PreDB often publishes multiple encodes of
 * the same title:
 *
 * BDRip
 * 720p
 * 1080p
 * REMUX
 * COMPLETE BLURAY
 *
 * Watch Leaks cares about the FIRST known
 * availability event for latency.
 *
 * This helper therefore treats:
 *
 * source + TMDB ID + detection type
 *
 * as one logical PreDB availability event.
 */
export async function savePredbFirstSeenDetection(
  detection:
    DetectionInput,
): Promise<{
  action:
    | "INSERTED"
    | "EARLIER_UPDATED"
    | "ALREADY_TRACKED";

  detectionId:
    number | null;

  detectedAt:
    string;
}> {
  if (
    detection.source !==
    "PreDB"
  ) {
    throw new Error(
      "savePredbFirstSeenDetection only accepts PreDB detections.",
    );
  }

  if (
    detection.tmdbId ===
    null
  ) {
    throw new Error(
      "A verified TMDB ID is required before saving a PreDB detection.",
    );
  }

  const normalizedIncomingDate =
    new Date(
      detection.detectedAt,
    );

  if (
    Number.isNaN(
      normalizedIncomingDate.getTime(),
    )
  ) {
    throw new Error(
      `Invalid PreDB detection timestamp: ${detection.detectedAt}`,
    );
  }

  const incomingDetectedAt =
    normalizedIncomingDate
      .toISOString();

  const existingResult =
    await turso.execute({
      sql: `
        SELECT
          id,
          detected_at,
          source_url,
          quality

        FROM detections

        WHERE
          source = ?
          AND tmdb_id = ?
          AND detection_type = ?

        ORDER BY
          datetime(
            detected_at
          ) ASC,
          id ASC

        LIMIT 1
      `,

      args: [
        "PreDB",

        detection.tmdbId,

        detection.detectionType,
      ],
    });

  const existing =
    existingResult
      .rows[0] as unknown as
      | ExistingPredbDetectionRow
      | undefined;

  if (
    !existing
  ) {
    await saveCloudDetection({
      ...detection,

      detectedAt:
        incomingDetectedAt,
    });

    const insertedResult =
      await turso.execute({
        sql: `
          SELECT
            id,
            detected_at

          FROM detections

          WHERE
            source = ?
            AND tmdb_id = ?
            AND detection_type = ?

          ORDER BY
            datetime(
              detected_at
            ) ASC,
            id ASC

          LIMIT 1
        `,

        args: [
          "PreDB",

          detection.tmdbId,

          detection.detectionType,
        ],
      });

    const inserted =
      insertedResult
        .rows[0] as unknown as
        | {
            id:
              number;

            detected_at:
              string;
          }
        | undefined;

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
              inserted.detected_at,
            )
          : incomingDetectedAt,
    };
  }

  const existingTimestamp =
    getTimestamp(
      String(
        existing.detected_at,
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
     * We discovered an earlier PreDB post
     * than the one previously stored.
     *
     * Move the logical detection back to
     * that true earliest known appearance.
     *
     * Release metadata is also refreshed
     * from the newly verified match.
     */
    await turso.execute({
      sql: `
        UPDATE detections

        SET
          title = ?,
          year = ?,
          quality = ?,

          detected_at = ?,

          theatrical_release_date =
            COALESCE(
              ?,
              theatrical_release_date
            ),

          theatrical_release_region =
            COALESCE(
              ?,
              theatrical_release_region
            ),

          digital_release_date =
            COALESCE(
              ?,
              digital_release_date
            ),

          digital_release_region =
            COALESCE(
              ?,
              digital_release_region
            ),

          physical_release_date =
            COALESCE(
              ?,
              physical_release_date
            ),

          physical_release_region =
            COALESCE(
              ?,
              physical_release_region
            ),

          poster_path =
            COALESCE(
              ?,
              poster_path
            ),

          source_url = ?

        WHERE id = ?
      `,

      args: [
        detection.title,

        detection.year,

        detection.quality,

        incomingDetectedAt,

        detection
          .theatricalReleaseDate,

        detection
          .theatricalReleaseRegion,

        detection
          .digitalReleaseDate,

        detection
          .digitalReleaseRegion,

        detection
          .physicalReleaseDate,

        detection
          .physicalReleaseRegion,

        detection.posterPath,

        detection.sourceUrl,

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

  /*
   * The movie/type combination is already
   * known and its stored timestamp is
   * earlier than or equal to this post.
   *
   * Do not create another public event and
   * do not move the first-seen clock.
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
        existing.detected_at,
      ),
  };
}