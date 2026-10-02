import {
  NextResponse,
} from "next/server";

import {
  getPredbMovieReleases,
} from "../../../data/predb";

import {
  dedupePredbReleases,
} from "../../../lib/predbDeduper";

import {
  matchMovieSource,
} from "../../../lib/movieMatchEngine";

export const dynamic =
  "force-dynamic";

export async function GET() {
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
    const rawReleases =
      await getPredbMovieReleases();

    const releases =
      dedupePredbReleases(
        rawReleases,
      );

    const results = [];

    let matched =
      0;

    let review =
      0;

    let skipped =
      0;

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

      if (
        matchResult.match
      ) {
        matched +=
          1;

        results.push({
          status:
            "MATCHED",

          release: {
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            quality:
              release.quality,

            releaseName:
              release.releaseName,

            preTime:
              release.publishedAt,

            postId:
              release.postId,

            sourceUrl:
              release.sourceUrl,
          },

          tmdb: {
            id:
              matchResult
                .match.id,

            title:
              matchResult
                .match
                .matchedTitle,

            year:
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
          },
        });

        continue;
      }

      if (
        matchResult.reviewReason
      ) {
        review +=
          1;

        results.push({
          status:
            "REVIEW",

          release: {
            title:
              release.normalizedTitle,

            year:
              release.year,

            signal:
              release.signal,

            quality:
              release.quality,

            releaseName:
              release.releaseName,

            preTime:
              release.publishedAt,

            postId:
              release.postId,
          },

          review: {
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
          },
        });

        continue;
      }

      skipped +=
        1;

      results.push({
        status:
          "SKIPPED",

        release: {
          title:
            release.normalizedTitle,

          year:
            release.year,

          signal:
            release.signal,

          quality:
            release.quality,

          releaseName:
            release.releaseName,

          preTime:
            release.publishedAt,

          postId:
            release.postId,
        },

        details:
          matchResult
            .details,
      });
    }

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      rawPosts:
        rawReleases.length,

      uniqueAvailabilityEvents:
        releases.length,

      duplicatesCollapsed:
        rawReleases.length -
        releases.length,

      summary: {
        matched,

        review,

        skipped,
      },

      results,
    });
  } catch (error) {
    console.error(
      "PreDB full pipeline test failed:",
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
            : "Unknown pipeline test error.",
      },
      {
        status:
          500,
      },
    );
  }
}