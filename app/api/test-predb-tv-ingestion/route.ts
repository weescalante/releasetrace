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

function hasValidEpisodeIdentity({
  seasonNumber,

  episodeNumber,

  episodeAirDate,
}: {
  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeAirDate:
    string | null;
}) {
  const hasSeasonEpisode =
    seasonNumber !==
      null &&
    episodeNumber !==
      null;

  const hasAirDate =
    episodeAirDate !==
      null &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      episodeAirDate,
    );

  return (
    hasSeasonEpisode ||
    hasAirDate
  );
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
                   * Real PreDB first-seen
                   * timestamp.
                   *
                   * Required by the generic
                   * split-series fallback.
                   */
                  detectedAt:
                    event.release
                      .publishedAt,
                });

              if (
                match.status !==
                "MATCHED"
              ) {
                return {
                  eventKey:
                    event.eventKey,

                  releaseName:
                    event.release
                      .releaseName,

                  status:
                    match.status,

                  preparedDetection:
                    null,

                  validIdentity:
                    false,

                  error:
                    null,
                };
              }

              if (
                match.tmdbId ===
                  null ||
                match.tmdbTitle ===
                  null
              ) {
                return {
                  eventKey:
                    event.eventKey,

                  releaseName:
                    event.release
                      .releaseName,

                  status:
                    "INVALID_MATCH",

                  preparedDetection:
                    null,

                  validIdentity:
                    false,

                  error:
                    "MATCHED result did not contain a verified TMDB TV identity.",
                };
              }

              const seasonNumber =
                match
                  .seasonNumber;

              const episodeNumber =
                match
                  .episodeNumber;

              const episodeAirDate =
                match
                  .episodeAirDate ??
                match
                  .sourceEpisodeAirDate ??
                event.parsed
                  .episodeAirDate;

              const validIdentity =
                hasValidEpisodeIdentity({
                  seasonNumber,

                  episodeNumber,

                  episodeAirDate,
                });

              const preparedDetection = {
                tmdbId:
                  match.tmdbId,

                title:
                  match.tmdbTitle,

                year:
                  match.tmdbYear ===
                  null
                    ? null
                    : String(
                        match.tmdbYear,
                      ),

                quality:
                  event.release
                    .quality ??
                  null,

                detectedAt:
                  event.release
                    .publishedAt,

                posterPath:
                  match
                    .posterPath,

                sourceUrl:
                  event.release
                    .sourceUrl ??
                  null,

                mediaType:
                  "TV",

                detectionType:
                  "WEB",

                seasonNumber,

                episodeNumber,

                episodeTitle:
                  match
                    .episodeTitle,

                episodeAirDate,
              };

              return {
                eventKey:
                  event.eventKey,

                releaseName:
                  event.release
                    .releaseName,

                sourcePage:
                  event.release
                    .sourcePage ??
                  "UNKNOWN",

                status:
                  match.status,

                validIdentity,

                preparedDetection,

                error:
                  validIdentity
                    ? null
                    : "Matched TV event has neither season/episode identity nor a usable episode air date.",
              };
            } catch (error) {
              return {
                eventKey:
                  event.eventKey,

                releaseName:
                  event.release
                    .releaseName,

                status:
                  "ERROR",

                preparedDetection:
                  null,

                validIdentity:
                  false,

                error:
                  error instanceof
                  Error
                    ? error.message
                    : "Unknown TV ingestion preparation error.",
              };
            }
          },
      });

    const prepared =
      results.filter(
        (
          result,
        ) =>
          result
            .preparedDetection !==
            null &&
          result
            .validIdentity,
      );

    const invalid =
      results.filter(
        (
          result,
        ) =>
          !result
            .validIdentity,
      );

    const seasonEpisode =
      prepared.filter(
        (
          result,
        ) =>
          result
            .preparedDetection
            ?.seasonNumber !==
            null &&
          result
            .preparedDetection
            ?.episodeNumber !==
            null,
      );

    const dateFallback =
      prepared.filter(
        (
          result,
        ) =>
          (
            result
              .preparedDetection
              ?.seasonNumber ===
              null ||
            result
              .preparedDetection
              ?.episodeNumber ===
              null
          ) &&
          result
            .preparedDetection
            ?.episodeAirDate !==
            null,
      );

    return NextResponse.json({
      success:
        invalid.length ===
        0,

      databaseChanges:
        false,

      source:
        "PreDB",

      mediaType:
        "TV",

      detectionType:
        "WEB",

      summary: {
        rawTvCandidates:
          rawReleases.length,

        uniqueTvEvents:
          events.length,

        prepared:
          prepared.length,

        invalid:
          invalid.length,

        seasonEpisodeIdentity:
          seasonEpisode.length,

        dateFallbackIdentity:
          dateFallback.length,
      },

      invalid,

      prepared,
    });
  } catch (error) {
    console.error(
      "PreDB TV ingestion preparation test failed:",
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
            : "Unknown PreDB TV ingestion preparation error.",
      },
      {
        status:
          500,
      },
    );
  }
}