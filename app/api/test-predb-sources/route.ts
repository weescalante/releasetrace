import {
  NextResponse,
} from "next/server";

import {
  classifyPredbUnknownContent,
  getPredbAllRelevantReleases,
  type PredbMovieRelease,
} from "../../../data/predb";

export const dynamic =
  "force-dynamic";

function summarizeRelease(
  release:
    PredbMovieRelease,
) {
  return {
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

    category:
      release.category,

    sourcePage:
      release.sourcePage ??
      "UNKNOWN",

    publishedAt:
      release.publishedAt,

    sourceUrl:
      release.sourceUrl,
  };
}

function countBySignal(
  releases:
    PredbMovieRelease[],
) {
  return {
    WEB:
      releases.filter(
        (
          release,
        ) =>
          release.signal ===
          "WEB",
      ).length,

    BLURAY:
      releases.filter(
        (
          release,
        ) =>
          release.signal ===
          "BLURAY",
      ).length,

    OTHER:
      releases.filter(
        (
          release,
        ) =>
          release.signal ===
          "OTHER",
      ).length,
  };
}

function countBySourcePage(
  releases:
    PredbMovieRelease[],
) {
  const result:
    Record<
      string,
      number
    > = {};

  for (
    const release of
    releases
  ) {
    const sourcePage =
      release.sourcePage ??
      "UNKNOWN";

    result[
      sourcePage
    ] =
      (
        result[
          sourcePage
        ] ??
        0
      ) +
      1;
  }

  return result;
}

export async function GET() {
  try {
    /*
     * Fetch Movies, TV and Unknown once each.
     *
     * getPredbAllRelevantReleases()
     * already excludes Unknown releases
     * classified as IGNORE.
     */
    const allRelevantReleases =
      await getPredbAllRelevantReleases();

    const moviePageReleases =
      allRelevantReleases.filter(
        (
          release,
        ) =>
          release.sourcePage ===
          "MOVIES",
      );

    const tvPageReleases =
      allRelevantReleases.filter(
        (
          release,
        ) =>
          release.sourcePage ===
          "TV",
      );

    const unknownReleases =
      allRelevantReleases.filter(
        (
          release,
        ) =>
          release.sourcePage ===
          "UNKNOWN",
      );

    const unknownMovieCandidates =
      unknownReleases.filter(
        (
          release,
        ) =>
          classifyPredbUnknownContent(
            release.releaseName,
          ) ===
          "MOVIE_CANDIDATE",
      );

    const unknownTvCandidates =
      unknownReleases.filter(
        (
          release,
        ) =>
          classifyPredbUnknownContent(
            release.releaseName,
          ) ===
          "TV_CANDIDATE",
      );

    const unknownIgnored =
      unknownReleases.filter(
        (
          release,
        ) =>
          classifyPredbUnknownContent(
            release.releaseName,
          ) ===
          "IGNORE",
      );

    const moviePipeline = [
      ...moviePageReleases,
      ...unknownMovieCandidates,
    ];

    const tvPipeline = [
      ...tvPageReleases,
      ...unknownTvCandidates,
    ];

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      requestStrategy: {
        moviesRequests:
          1,

        tvRequests:
          1,

        unknownRequests:
          1,

        note:
          "Each PreDB category is fetched once per test run.",
      },

      sources: {
        movies:
          "https://predb.me/?cats=movies",

        tv:
          "https://predb.me/?cats=tv",

        unknown:
          "https://predb.me/?cats=unknown",
      },

      totals: {
        moviesPage:
          moviePageReleases.length,

        tvPage:
          tvPageReleases.length,

        unknownRelevant:
          unknownReleases.length,

        moviePipeline:
          moviePipeline.length,

        tvPipeline:
          tvPipeline.length,

        allRelevantUniquePosts:
          allRelevantReleases.length,
      },

      signals: {
        moviesPage:
          countBySignal(
            moviePageReleases,
          ),

        tvPage:
          countBySignal(
            tvPageReleases,
          ),

        unknownRelevant:
          countBySignal(
            unknownReleases,
          ),

        moviePipeline:
          countBySignal(
            moviePipeline,
          ),

        tvPipeline:
          countBySignal(
            tvPipeline,
          ),

        allRelevant:
          countBySignal(
            allRelevantReleases,
          ),
      },

      sourcePages:
        countBySourcePage(
          allRelevantReleases,
        ),

      unknownContribution: {
        totalRelevant:
          unknownReleases.length,

        movieCandidates:
          unknownMovieCandidates.length,

        tvCandidates:
          unknownTvCandidates.length,

        ignoredRemaining:
          unknownIgnored.length,

        movieExamples:
          unknownMovieCandidates
            .slice(
              0,
              15,
            )
            .map(
              summarizeRelease,
            ),

        tvExamples:
          unknownTvCandidates
            .slice(
              0,
              15,
            )
            .map(
              summarizeRelease,
            ),
      },

      latestMovies:
        moviePipeline
          .slice(
            0,
            15,
          )
          .map(
            summarizeRelease,
          ),

      latestTv:
        tvPipeline
          .slice(
            0,
            15,
          )
          .map(
            summarizeRelease,
          ),

      latestUnknownRelevant:
        unknownReleases
          .slice(
            0,
            25,
          )
          .map(
            summarizeRelease,
          ),
    });
  } catch (error) {
    console.error(
      "PreDB source test failed:",
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
            : "Unknown PreDB source test error.",
      },
      {
        status:
          500,
      },
    );
  }
}