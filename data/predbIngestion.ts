import {
  getPredbMovieReleases,
  type PredbMovieRelease,
} from "./predb";

import {
  dedupePredbReleases,
} from "../lib/predbDeduper";

import {
  matchMovieSource,
} from "../lib/movieMatchEngine";

import {
  savePredbFirstSeenDetection,
} from "../lib/predbDetectionStore";

import {
  saveMatchReview,
} from "../lib/matchReviews";

import {
  createBluRayComResolver,
  type BluRayComResolver,
} from "../lib/blurayComResolver";

const PREDB_SOURCE =
  "PreDB";

const RELEASE_WINDOW_DAYS =
  90;

const DAY_IN_MS =
  24 *
  60 *
  60 *
  1000;

export type PredbIngestionSummary = {
  rawPosts: number;

  uniqueEvents: number;

  matched: number;

  eligibleWindowEvents:
    number;

  outsideWindow:
    number;

  inserted: number;

  earlierUpdated: number;

  alreadyTracked: number;

  reviews: number;

  reviewsOutsideWindow:
    number;

  skipped: number;

  errors: number;

  databaseChanges:
    boolean;

  blurayIndexLoaded:
    boolean;

  blurayIndexRecords:
    number;

  blurayOfficialDatesResolved:
    number;

  blurayOfficialDatesUnavailable:
    number;
};

export type PredbIngestionResult = {
  success: boolean;

  summary:
    PredbIngestionSummary;

  items:
    PredbIngestionItem[];
};

export type PredbIngestionItem = {
  title: string;

  year: string;

  signal:
    | "WEB"
    | "BLURAY";

  releaseName: string;

  postId: string;

  publishedAt: string;

  status:
    | "INSERTED"
    | "EARLIER_UPDATED"
    | "ALREADY_TRACKED"
    | "REVIEW"
    | "SKIPPED"
    | "OUTSIDE_WINDOW"
    | "DRY_RUN_MATCHED"
    | "DRY_RUN_REVIEW"
    | "ERROR";

  tmdbId:
    number | null;

  tmdbTitle:
    string | null;

  details:
    string | null;
};

type ReleaseWindowMetadata = {
  theatricalReleaseDate:
    string | null;

  digitalReleaseDate:
    string | null;

  physicalReleaseDate:
    string | null;
};

type MatchReviewCandidateOptions =
  Parameters<
    typeof saveMatchReview
  >[0]["candidateOptions"];

type ResolvedPhysicalMetadata = {
  physicalReleaseDate:
    string | null;

  physicalReleaseRegion:
    string | null;

  source:
    "BLURAY_COM"
    | "TMDB"
    | "UNAVAILABLE";

  details:
    string;
};

function hasValidTimestamp(
  value: string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return !Number.isNaN(
    timestamp,
  );
}

function getTimestamp(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return null;
  }

  return timestamp;
}

function isDateInsideReleaseWindow(
  value:
    string | null,
) {
  const timestamp =
    getTimestamp(
      value,
    );

  if (
    timestamp ===
    null
  ) {
    return false;
  }

  const now =
    Date.now();

  const windowMs =
    RELEASE_WINDOW_DAYS *
    DAY_IN_MS;

  return (
    timestamp >=
      now -
        windowMs &&
    timestamp <=
      now +
        windowMs
  );
}

function getMatchingWindowDates(
  metadata:
    ReleaseWindowMetadata,
) {
  const dates: {
    stage:
      | "Theatrical"
      | "Digital"
      | "Physical";

    date: string;
  }[] = [];

  if (
    metadata
      .theatricalReleaseDate &&
    isDateInsideReleaseWindow(
      metadata
        .theatricalReleaseDate,
    )
  ) {
    dates.push({
      stage:
        "Theatrical",

      date:
        metadata
          .theatricalReleaseDate,
    });
  }

  if (
    metadata
      .digitalReleaseDate &&
    isDateInsideReleaseWindow(
      metadata
        .digitalReleaseDate,
    )
  ) {
    dates.push({
      stage:
        "Digital",

      date:
        metadata
          .digitalReleaseDate,
    });
  }

  if (
    metadata
      .physicalReleaseDate &&
    isDateInsideReleaseWindow(
      metadata
        .physicalReleaseDate,
    )
  ) {
    dates.push({
      stage:
        "Physical",

      date:
        metadata
          .physicalReleaseDate,
    });
  }

  return dates;
}

function isMovieInsideReleaseWindow(
  metadata:
    ReleaseWindowMetadata,
) {
  return (
    getMatchingWindowDates(
      metadata,
    ).length >
    0
  );
}

function describeReleaseWindow(
  metadata:
    ReleaseWindowMetadata,
) {
  const matchingDates =
    getMatchingWindowDates(
      metadata,
    );

  if (
    matchingDates.length ===
    0
  ) {
    return `No official theatrical, digital, or physical release milestone falls within the rolling ±${RELEASE_WINDOW_DAYS}-day Watch Leaks window.`;
  }

  return matchingDates
    .map(
      (item) =>
        `${item.stage}: ${item.date}`,
    )
    .join(
      "; ",
    );
}

function reviewHasRecentCandidate(
  candidateOptions:
    MatchReviewCandidateOptions,
) {
  return (
    candidateOptions ??
    []
  ).some(
    (candidate) =>
      isDateInsideReleaseWindow(
        candidate.releaseDate ??
          null,
      ),
  );
}

async function createOptionalBluRayResolver(
  releases: {
    signal: string;
  }[],
) {
  const hasBluRay =
    releases.some(
      (
        release,
      ) =>
        release.signal ===
        "BLURAY",
    );

  if (
    !hasBluRay
  ) {
    return null;
  }

  try {
    console.log(
      `Loading Blu-ray.com ±${RELEASE_WINDOW_DAYS}-day release index...`,
    );

    const resolver =
      await createBluRayComResolver({
        daysBefore:
          RELEASE_WINDOW_DAYS,

        daysAfter:
          RELEASE_WINDOW_DAYS,
      });

    console.log(
      `Blu-ray.com index loaded: ${resolver.totalReleaseRecords} records across ${resolver.months.length} month(s).`,
    );

    return resolver;
  } catch (error) {
    console.error(
      "Blu-ray.com index could not be loaded. PreDB ingestion will continue using TMDB release metadata:",
      error,
    );

    /*
     * Blu-ray.com enrichment is valuable,
     * but a temporary upstream failure must
     * not stop the entire PreDB ingestion.
     */
    return null;
  }
}

function resolvePhysicalMetadata({
  resolver,

  title,

  year,

  quality,

  tmdbPhysicalReleaseDate,

  tmdbPhysicalReleaseRegion,
}: {
  resolver:
    BluRayComResolver | null;

  title: string;

  year:
    string | null;

  quality:
    string | null;

  tmdbPhysicalReleaseDate:
    string | null;

  tmdbPhysicalReleaseRegion:
    string | null;
}): ResolvedPhysicalMetadata {
  if (
    resolver
  ) {
    const result =
      resolver.resolve({
        title,

        year,

        quality,
      });

    if (
      result.matched &&
      result.officialReleaseDate
    ) {
      const selected =
        result.selectedRelease;

      return {
        physicalReleaseDate:
          result.officialReleaseDate,

        /*
         * The Blu-ray.com release calendar
         * being indexed here is the US
         * physical-release calendar.
         */
        physicalReleaseRegion:
          "US",

        source:
          "BLURAY_COM",

        details:
          selected
            ? `Blu-ray.com matched product ${selected.productId} "${selected.title}" (${selected.format}); official physical release ${result.officialReleaseDate}.`
            : `Blu-ray.com resolved official physical release ${result.officialReleaseDate}.`,
      };
    }
  }

  if (
    tmdbPhysicalReleaseDate
  ) {
    return {
      physicalReleaseDate:
        tmdbPhysicalReleaseDate,

      physicalReleaseRegion:
        tmdbPhysicalReleaseRegion,

      source:
        "TMDB",

      details:
        `Blu-ray.com did not provide a confirmed matching edition. Using TMDB physical release metadata: ${tmdbPhysicalReleaseDate}.`,
    };
  }

  return {
    physicalReleaseDate:
      null,

    physicalReleaseRegion:
      null,

    source:
      "UNAVAILABLE",

    details:
      "No confirmed Blu-ray.com release date and no TMDB physical release date are currently available.",
  };
}

async function savePredbReview({
  sourceUrl,

  sourceTitle,

  normalizedTitle,

  year,

  quality,

  detectionType,

  publishedAt,

  reason,

  candidateTmdbId,

  candidateTitle,

  candidateYear,

  confidence,

  candidateOptions,

  details,
}: {
  sourceUrl:
    string;

  sourceTitle:
    string;

  normalizedTitle:
    string;

  year:
    string;

  quality:
    string;

  detectionType:
    | "WEB"
    | "BLURAY";

  publishedAt:
    string;

  reason:
    "UNMATCHED"
    | "AMBIGUOUS"
    | "TITLE_MISMATCH"
    | "MISSING_RELEASE_DATE";

  candidateTmdbId:
    number | null;

  candidateTitle:
    string | null;

  candidateYear:
    string | null;

  confidence:
    number | null;

  candidateOptions:
    MatchReviewCandidateOptions;

  details:
    string | null;
}) {
  return saveMatchReview({
    source:
      PREDB_SOURCE,

    sourceUrl,

    sourceTitle,

    normalizedTitle,

    year:
      year ===
      "Unknown"
        ? null
        : year,

    quality:
      quality ===
      "Unknown"
        ? null
        : quality,

    detectionType,

    publishedAt:
      hasValidTimestamp(
        publishedAt,
      )
        ? publishedAt
        : null,

    sourceDescription:
      null,

    sourceCountry:
      null,

    sourceGenres:
      null,

    sourceAudioLanguage:
      null,

    sourceSubtitleLanguage:
      null,

    reason,

    candidateTmdbId,

    candidateTitle,

    candidateYear,

    confidence,

    candidateOptions,

    details,
  });
}

export async function ingestPredbMovies({
  write = false,

  rawReleases:
    suppliedRawReleases,
}: {
  write?: boolean;

  rawReleases?:
    PredbMovieRelease[];
} = {}): Promise<
  PredbIngestionResult
> {
  /*
   * Normal local/direct execution still fetches
   * PreDB itself.
   *
   * Production GitHub Actions can instead fetch
   * the HTML externally, let the API route parse
   * it, and supply the resulting release objects
   * here. This avoids requiring Vercel to make a
   * blocked outbound request to PreDB.
   */
  const rawReleases =
    suppliedRawReleases ??
    await getPredbMovieReleases();

  /*
   * Collapse multiple PreDB encodes into one
   * logical title/type availability event.
   */
  const releases =
    dedupePredbReleases(
      rawReleases,
    );

  /*
   * Build the Blu-ray.com index only once
   * for this entire ingestion run.
   */
  const blurayResolver =
    await createOptionalBluRayResolver(
      releases,
    );

  const summary:
    PredbIngestionSummary = {
      rawPosts:
        rawReleases.length,

      uniqueEvents:
        releases.length,

      matched:
        0,

      eligibleWindowEvents:
        0,

      outsideWindow:
        0,

      inserted:
        0,

      earlierUpdated:
        0,

      alreadyTracked:
        0,

      reviews:
        0,

      reviewsOutsideWindow:
        0,

      skipped:
        0,

      errors:
        0,

      databaseChanges:
        false,

      blurayIndexLoaded:
        Boolean(
          blurayResolver,
        ),

      blurayIndexRecords:
        blurayResolver
          ?.totalReleaseRecords ??
        0,

      blurayOfficialDatesResolved:
        0,

      blurayOfficialDatesUnavailable:
        0,
    };

  console.log(
    `PreDB rolling release window: ±${RELEASE_WINDOW_DAYS} days`,
  );

  console.log(
    `PreDB raw posts: ${rawReleases.length}`,
  );

  console.log(
    `PreDB unique availability events: ${releases.length}`,
  );

  const items:
    PredbIngestionItem[] =
    [];

  for (
    const release of
    releases
  ) {
    if (
      release.signal !==
        "WEB" &&
      release.signal !==
        "BLURAY"
    ) {
      summary.skipped +=
        1;

      continue;
    }

    try {
      if (
        !hasValidTimestamp(
          release.publishedAt,
        )
      ) {
        summary.skipped +=
          1;

        items.push({
          title:
            release.normalizedTitle,

          year:
            release.year,

          signal:
            release.signal,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "SKIPPED",

          tmdbId:
            null,

          tmdbTitle:
            null,

          details:
            "PreDB item has no valid publication timestamp.",
        });

        continue;
      }

      /*
       * TMDB remains the identity authority.
       *
       * Blu-ray.com is used only after we know
       * which movie this PreDB release belongs
       * to.
       */
      const matchResult =
        await matchMovieSource({
          sourceName:
            PREDB_SOURCE,

          sourceTitle:
            release.releaseName,

          normalizedTitle:
            release.normalizedTitle,

          year:
            release.year,

          detectionType:
            release.signal,

          quality:
            release.quality,

          description:
            null,

          country:
            null,

          genres:
            [],

          audioLanguage:
            null,
        });

      if (
        matchResult.match
      ) {
        summary.matched +=
          1;

        /*
         * WEB detections retain TMDB physical
         * metadata as-is because Blu-ray.com
         * enrichment is only relevant to the
         * BLURAY detection pipeline.
         */
        let physicalMetadata:
          ResolvedPhysicalMetadata = {
            physicalReleaseDate:
              matchResult
                .match
                .physicalReleaseDate,

            physicalReleaseRegion:
              matchResult
                .match
                .physicalReleaseRegion,

            source:
              matchResult
                .match
                .physicalReleaseDate
                ? "TMDB"
                : "UNAVAILABLE",

            details:
              matchResult
                .match
                .physicalReleaseDate
                ? `TMDB physical release metadata: ${matchResult.match.physicalReleaseDate}.`
                : "No physical release metadata required for this WEB detection.",
          };

        if (
          release.signal ===
          "BLURAY"
        ) {
          physicalMetadata =
            resolvePhysicalMetadata({
              resolver:
                blurayResolver,

              /*
               * Use the verified TMDB identity,
               * not the raw scene name, for the
               * Blu-ray.com lookup.
               */
              title:
                matchResult
                  .match
                  .matchedTitle,

              year:
                matchResult
                  .match
                  .matchedYear ??
                release.year,

              quality:
                release.quality,

              tmdbPhysicalReleaseDate:
                matchResult
                  .match
                  .physicalReleaseDate,

              tmdbPhysicalReleaseRegion:
                matchResult
                  .match
                  .physicalReleaseRegion,
            });

          if (
            physicalMetadata.source ===
            "BLURAY_COM"
          ) {
            summary
              .blurayOfficialDatesResolved +=
              1;
          } else {
            summary
              .blurayOfficialDatesUnavailable +=
              1;
          }
        }

        /*
         * Release-window eligibility uses the
         * improved physical release date.
         *
         * Therefore a Blu-ray.com date can make
         * the physical milestone authoritative
         * for this test.
         */
        const releaseMetadata:
          ReleaseWindowMetadata = {
          theatricalReleaseDate:
            matchResult
              .match
              .theatricalReleaseDate,

          digitalReleaseDate:
            matchResult
              .match
              .digitalReleaseDate,

          physicalReleaseDate:
            physicalMetadata
              .physicalReleaseDate,
        };

        const isInsideWindow =
          isMovieInsideReleaseWindow(
            releaseMetadata,
          );

        if (
          !isInsideWindow
        ) {
          summary.outsideWindow +=
            1;

          items.push({
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            releaseName:
              release.releaseName,

            postId:
              release.postId,

            publishedAt:
              release.publishedAt,

            status:
              "OUTSIDE_WINDOW",

            tmdbId:
              matchResult
                .match.id,

            tmdbTitle:
              matchResult
                .match
                .matchedTitle,

            details:
              `${describeReleaseWindow(
                releaseMetadata,
              )} ${physicalMetadata.details}`,
          });

          /*
           * Old catalog releases never reach
           * Turso and never enter review.
           */
          continue;
        }

        summary
          .eligibleWindowEvents +=
          1;

        const windowDetails =
          describeReleaseWindow(
            releaseMetadata,
          );

        const resolutionDetails =
          release.signal ===
          "BLURAY"
            ? ` ${physicalMetadata.details}`
            : "";

        if (!write) {
          items.push({
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            releaseName:
              release.releaseName,

            postId:
              release.postId,

            publishedAt:
              release.publishedAt,

            status:
              "DRY_RUN_MATCHED",

            tmdbId:
              matchResult
                .match.id,

            tmdbTitle:
              matchResult
                .match
                .matchedTitle,

            details:
              `Eligible rolling release window. ${windowDetails}.${resolutionDetails}`,
          });

          continue;
        }

        const saveResult =
          await savePredbFirstSeenDetection({
            tmdbId:
              matchResult
                .match.id,

            title:
              matchResult
                .match
                .matchedTitle,

            year:
              matchResult
                .match
                .matchedYear ??
              release.year,

            detectionType:
              release.signal,

            quality:
              release.quality,

            detectedAt:
              release.publishedAt,

            theatricalReleaseDate:
              matchResult
                .match
                .theatricalReleaseDate,

            theatricalReleaseRegion:
              matchResult
                .match
                .theatricalReleaseRegion,

            digitalReleaseDate:
              matchResult
                .match
                .digitalReleaseDate,

            digitalReleaseRegion:
              matchResult
                .match
                .digitalReleaseRegion,

            /*
             * This is the key integration.
             *
             * If Blu-ray.com has an official
             * matching physical edition, its
             * date becomes the stored physical
             * release date.
             *
             * Otherwise we fall back to TMDB.
             */
            physicalReleaseDate:
              physicalMetadata
                .physicalReleaseDate,

            physicalReleaseRegion:
              physicalMetadata
                .physicalReleaseRegion,

            posterPath:
              matchResult
                .match
                .posterPath,

            source:
              PREDB_SOURCE,

            sourceUrl:
              release.sourceUrl,
          });

        if (
          saveResult.action ===
          "INSERTED"
        ) {
          summary.inserted +=
            1;
        } else if (
          saveResult.action ===
          "EARLIER_UPDATED"
        ) {
          summary.earlierUpdated +=
            1;
        } else {
          summary.alreadyTracked +=
            1;
        }

        items.push({
          title:
            release.normalizedTitle,

          year:
            release.year,

          signal:
            release.signal,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            saveResult.action,

          tmdbId:
            matchResult
              .match.id,

          tmdbTitle:
            matchResult
              .match
              .matchedTitle,

          details:
            `Eligible rolling release window. ${windowDetails}.${resolutionDetails}`,
        });

        continue;
      }

      if (
        matchResult.reviewReason
      ) {
        const candidateOptions =
          matchResult
            .candidateOptions ??
          [];

        /*
         * Keep the review queue focused only
         * on potentially recent movies.
         */
        const hasRecentCandidate =
          reviewHasRecentCandidate(
            candidateOptions,
          );

        if (
          !hasRecentCandidate
        ) {
          summary
            .reviewsOutsideWindow +=
            1;

          items.push({
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            releaseName:
              release.releaseName,

            postId:
              release.postId,

            publishedAt:
              release.publishedAt,

            status:
              "OUTSIDE_WINDOW",

            tmdbId:
              matchResult
                .candidateTmdbId,

            tmdbTitle:
              matchResult
                .candidateTitle,

            details:
              `Unresolved PreDB item was not retained because no plausible TMDB candidate has a release date inside the rolling ±${RELEASE_WINDOW_DAYS}-day window.`,
          });

          continue;
        }

        summary.reviews +=
          1;

        if (!write) {
          items.push({
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            releaseName:
              release.releaseName,

            postId:
              release.postId,

            publishedAt:
              release.publishedAt,

            status:
              "DRY_RUN_REVIEW",

            tmdbId:
              matchResult
                .candidateTmdbId,

            tmdbTitle:
              matchResult
                .candidateTitle,

            details:
              matchResult
                .details,
          });

          continue;
        }

        await savePredbReview({
          sourceUrl:
            release.sourceUrl,

          sourceTitle:
            release.releaseName,

          normalizedTitle:
            release.normalizedTitle,

          year:
            release.year,

          quality:
            release.quality,

          detectionType:
            release.signal,

          publishedAt:
            release.publishedAt,

          reason:
            matchResult
              .reviewReason,

          candidateTmdbId:
            matchResult
              .candidateTmdbId,

          candidateTitle:
            matchResult
              .candidateTitle,

          candidateYear:
            matchResult
              .candidateYear,

          confidence:
            matchResult
              .confidence,

          candidateOptions,

          details:
            matchResult
              .details,
        });

        items.push({
          title:
            release.normalizedTitle,

          year:
            release.year,

          signal:
            release.signal,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "REVIEW",

          tmdbId:
            matchResult
              .candidateTmdbId,

          tmdbTitle:
            matchResult
              .candidateTitle,

          details:
            matchResult
              .details,
        });

        continue;
      }

      summary.skipped +=
        1;

      items.push({
        title:
          release.normalizedTitle,

        year:
          release.year,

        signal:
          release.signal,

        releaseName:
          release.releaseName,

        postId:
          release.postId,

        publishedAt:
          release.publishedAt,

        status:
          "SKIPPED",

        tmdbId:
          matchResult
            .candidateTmdbId,

        tmdbTitle:
          matchResult
            .candidateTitle,

        details:
          matchResult
            .details,
      });
    } catch (error) {
      summary.errors +=
        1;

      items.push({
        title:
          release.normalizedTitle,

        year:
          release.year,

        signal:
          release.signal,

        releaseName:
          release.releaseName,

        postId:
          release.postId,

        publishedAt:
          release.publishedAt,

        status:
          "ERROR",

        tmdbId:
          null,

        tmdbTitle:
          null,

        details:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB ingestion error.",
      });

      console.error(
        `PreDB ingestion failed for ${release.releaseName}:`,
        error,
      );
    }
  }

  summary.databaseChanges =
    write &&
    (
      summary.inserted > 0 ||
      summary.earlierUpdated > 0
    );

  console.log(
    `PreDB matched identities: ${summary.matched}`,
  );

  console.log(
    `PreDB eligible ±${RELEASE_WINDOW_DAYS}-day events: ${summary.eligibleWindowEvents}`,
  );

  console.log(
    `PreDB matched events outside window: ${summary.outsideWindow}`,
  );

  console.log(
    `PreDB reviews retained: ${summary.reviews}`,
  );

  console.log(
    `PreDB reviews rejected as old: ${summary.reviewsOutsideWindow}`,
  );

  console.log(
    `Blu-ray.com index loaded: ${summary.blurayIndexLoaded}`,
  );

  console.log(
    `Blu-ray.com release records: ${summary.blurayIndexRecords}`,
  );

  console.log(
    `Blu-ray.com official dates resolved: ${summary.blurayOfficialDatesResolved}`,
  );

  console.log(
    `Blu-ray physical dates unresolved/fallback: ${summary.blurayOfficialDatesUnavailable}`,
  );

  return {
    success:
      summary.errors ===
      0,

    summary,

    items,
  };
}