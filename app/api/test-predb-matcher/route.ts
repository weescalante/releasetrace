import {
  NextResponse,
} from "next/server";

import {
  getPredbMovieReleases,
} from "../../../data/predb";

import {
  matchMovieSource,
} from "../../../lib/movieMatchEngine";

export const dynamic =
  "force-dynamic";

export async function GET() {
  /*
   * This endpoint is only for local
   * development testing.
   *
   * Even if it were accidentally deployed,
   * production will refuse to run it.
   */
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        success:
          false,

        message:
          "Not available in production.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const releases =
      await getPredbMovieReleases();

    const candidates =
      releases.slice(
        0,
        10,
      );

    const results = [];

    for (
      const release of
      candidates
    ) {
      /*
       * Explicitly narrow PreDB's broader
       * signal type:
       *
       * WEB | BLURAY | OTHER
       *
       * into the detection types accepted
       * by the shared matcher.
       */
      if (
        release.signal !==
          "WEB" &&
        release.signal !==
          "BLURAY"
      ) {
        continue;
      }

      const matchResult =
        await matchMovieSource({
          sourceName:
            "PreDB",

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

      results.push({
        release: {
          postId:
            release.postId,

          releaseName:
            release.releaseName,

          normalizedTitle:
            release.normalizedTitle,

          year:
            release.year,

          signal:
            release.signal,

          quality:
            release.quality,

          publishedAt:
            release.publishedAt,

          sourceUrl:
            release.sourceUrl,
        },

        result:
          matchResult.match
            ? {
                status:
                  "MATCHED",

                tmdbId:
                  matchResult
                    .match.id,

                tmdbTitle:
                  matchResult
                    .match
                    .matchedTitle,

                tmdbYear:
                  matchResult
                    .match
                    .matchedYear,

                confidence:
                  matchResult
                    .match
                    .confidence,

                posterPath:
                  matchResult
                    .match
                    .posterPath,

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

                physicalReleaseDate:
                  matchResult
                    .match
                    .physicalReleaseDate,

                physicalReleaseRegion:
                  matchResult
                    .match
                    .physicalReleaseRegion,
              }
            : matchResult
                .reviewReason
              ? {
                  status:
                    "REVIEW",

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

                  candidateOptions:
                    matchResult
                      .candidateOptions
                      ?.length ??
                    0,

                  details:
                    matchResult
                      .details,
                }
              : {
                  status:
                    "SKIPPED",

                  details:
                    matchResult
                      .details,
                },
      });
    }

    return NextResponse.json({
      success:
        true,

      tested:
        results.length,

      databaseChanges:
        false,

      results,
    });
  } catch (error) {
    console.error(
      "PreDB matcher test failed:",
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
            : "Unknown test error.",
      },
      {
        status:
          500,
      },
    );
  }
}