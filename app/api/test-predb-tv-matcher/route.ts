import {
  NextResponse,
} from "next/server";

import {
  getPredbTvReleases,
} from "../../../data/predb";

import {
  dedupePredbTvReleases,
} from "../../../lib/predbTvDeduper";

import {
  matchTvSource,
} from "../../../lib/tvMatchEngine";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const CONCURRENCY =
  3;

async function mapWithConcurrency<
  T,
  R,
>({
  items,
  concurrency,
  worker,
}: {
  items:
    T[];

  concurrency:
    number;

  worker:
    (
      item: T,
      index: number,
    ) => Promise<R>;
}) {
  const results:
    R[] =
    new Array(
      items.length,
    );

  let nextIndex =
    0;

  async function runWorker() {
    while (
      nextIndex <
      items.length
    ) {
      const index =
        nextIndex;

      nextIndex +=
        1;

      results[index] =
        await worker(
          items[index],
          index,
        );
    }
  }

  const workerCount =
    Math.min(
      concurrency,
      items.length,
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },

      () =>
        runWorker(),
    ),
  );

  return results;
}

export async function GET() {
  try {
    const rawReleases =
      await getPredbTvReleases();

    const events =
      dedupePredbTvReleases(
        rawReleases,
      );

    const results =
      await mapWithConcurrency({
        items:
          events,

        concurrency:
          CONCURRENCY,

        worker:
          async (
            event,
          ) => {
            try {
              const match =
                await matchTvSource({
                  sourceReleaseName:
                    event.release
                      .releaseName,

                  seriesTitle:
                    event.parsed
                      .seriesTitle,

                  titleCandidates:
                    event.parsed
                      .titleCandidates,

                  apparentYear:
                    event.parsed
                      .apparentYear,

                  seasonNumber:
                    event.parsed
                      .seasonNumber,

                  episodeNumber:
                    event.parsed
                      .episodeNumber,

                  episodeAirDate:
                    event.parsed
                      .episodeAirDate,

                  /*
                   * Real PreDB first-seen time.
                   *
                   * This enables the generic
                   * split-series resolver to
                   * compare candidate episode
                   * air dates with the actual
                   * source observation time.
                   */
                  detectedAt:
                    event.release
                      .publishedAt,
                });

              return {
                eventKey:
                  event.eventKey,

                source: {
                  postId:
                    event.release
                      .postId,

                  releaseName:
                    event.release
                      .releaseName,

                  sourcePage:
                    event.release
                      .sourcePage ??
                    "UNKNOWN",

                  signal:
                    event.release
                      .signal,

                  quality:
                    event.release
                      .quality,

                  firstSeen:
                    event.release
                      .publishedAt,

                  variantCount:
                    event.variantCount,
                },

                parsed: {
                  seriesTitle:
                    event.parsed
                      .seriesTitle,

                  titleCandidates:
                    event.parsed
                      .titleCandidates,

                  apparentYear:
                    event.parsed
                      .apparentYear,

                  seasonNumber:
                    event.parsed
                      .seasonNumber,

                  episodeNumber:
                    event.parsed
                      .episodeNumber,

                  episodeAirDate:
                    event.parsed
                      .episodeAirDate,

                  isEpisode:
                    event.parsed
                      .isEpisode,

                  isSeasonPack:
                    event.parsed
                      .isSeasonPack,
                },

                match,

                error:
                  null,
              };
            } catch (error) {
              return {
                eventKey:
                  event.eventKey,

                source: {
                  postId:
                    event.release
                      .postId,

                  releaseName:
                    event.release
                      .releaseName,

                  sourcePage:
                    event.release
                      .sourcePage ??
                    "UNKNOWN",

                  signal:
                    event.release
                      .signal,

                  quality:
                    event.release
                      .quality,

                  firstSeen:
                    event.release
                      .publishedAt,

                  variantCount:
                    event.variantCount,
                },

                parsed: {
                  seriesTitle:
                    event.parsed
                      .seriesTitle,

                  titleCandidates:
                    event.parsed
                      .titleCandidates,

                  apparentYear:
                    event.parsed
                      .apparentYear,

                  seasonNumber:
                    event.parsed
                      .seasonNumber,

                  episodeNumber:
                    event.parsed
                      .episodeNumber,

                  episodeAirDate:
                    event.parsed
                      .episodeAirDate,

                  isEpisode:
                    event.parsed
                      .isEpisode,

                  isSeasonPack:
                    event.parsed
                      .isSeasonPack,
                },

                match:
                  null,

                error:
                  error instanceof
                  Error
                    ? error.message
                    : "Unknown TV matching error.",
              };
            }
          },
      });

    const matched =
      results.filter(
        (
          result,
        ) =>
          result.match
            ?.status ===
          "MATCHED",
      );

    const reviews =
      results.filter(
        (
          result,
        ) =>
          result.match
            ?.status ===
          "REVIEW",
      );

    const unmatched =
      results.filter(
        (
          result,
        ) =>
          result.match
            ?.status ===
          "UNMATCHED",
      );

    const errors =
      results.filter(
        (
          result,
        ) =>
          result.error !==
          null,
      );

    const dateBased =
      results.filter(
        (
          result,
        ) =>
          result.parsed
            .episodeAirDate !==
          null,
      );

    const seasonEpisode =
      results.filter(
        (
          result,
        ) =>
          result.parsed
            .seasonNumber !==
            null &&
          result.parsed
            .episodeNumber !==
            null,
      );

    const validationTitles = [
      "dark matter 2024",
      "fair city",
      "the price is right",
      "seth meyers",
      "jimmy fallon",
      "watch what happens live",
      "the sisters grimm",
      "war 2026",
      "link click",
      "the bold and the beautiful",
      "beyond the gates",
      "red queen",
      "icons unearthed",
    ];

    const validationExamples =
      results.filter(
        (
          result,
        ) => {
          const title =
            result.parsed
              .seriesTitle
              .toLowerCase();

          return validationTitles.some(
            (
              expected,
            ) =>
              title ===
              expected,
          );
        },
      );

    return NextResponse.json({
      success:
        errors.length ===
        0,

      databaseChanges:
        false,

      source:
        "PreDB",

      matcher:
        "TMDB TV",

      summary: {
        rawTvCandidates:
          rawReleases.length,

        uniqueTvEvents:
          events.length,

        matched:
          matched.length,

        review:
          reviews.length,

        unmatched:
          unmatched.length,

        errors:
          errors.length,

        seasonEpisodeEvents:
          seasonEpisode.length,

        dateBasedEvents:
          dateBased.length,
      },

      validationExamples,

      reviews,

      unmatched,

      errors,

      allResults:
        results,
    });
  } catch (error) {
    console.error(
      "PreDB TV matcher test failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        databaseChanges:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB TV matcher test error.",
      },
      {
        status:
          500,
      },
    );
  }
}