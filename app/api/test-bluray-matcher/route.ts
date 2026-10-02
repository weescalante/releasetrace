import {
  NextResponse,
} from "next/server";

import {
  getBluRayComReleaseWindow,
} from "../../../data/blurayCom";

import {
  matchBluRayComRelease,
} from "../../../lib/blurayComMatcher";

export const dynamic =
  "force-dynamic";

const TEST_MOVIES = [
  {
    label:
      "Batman standard Blu-ray",

    title:
      "Batman: Knightfall Part 1: Knightfall",

    year:
      "2026",

    quality:
      "1080p Blu-ray",
  },

  {
    label:
      "Batman UHD Blu-ray",

    title:
      "Batman: Knightfall Part 1: Knightfall",

    year:
      "2026",

    quality:
      "2160p UHD Blu-ray",
  },

  {
    label:
      "Harbinger",

    title:
      "Harbinger",

    year:
      "2026",

    quality:
      "1080p Blu-ray",
  },
];

export async function GET() {
  try {
    const index =
      await getBluRayComReleaseWindow({
        daysBefore:
          90,

        daysAfter:
          90,
      });

    const tests =
      TEST_MOVIES.map(
        (
          movie,
        ) => {
          const result =
            matchBluRayComRelease({
              input: {
                title:
                  movie.title,

                year:
                  movie.year,

                quality:
                  movie.quality,
              },

              releases:
                index.releases,
            });

          return {
            label:
              movie.label,

            input: {
              title:
                movie.title,

              year:
                movie.year,

              quality:
                movie.quality,
            },

            matched:
              result.matched,

            method:
              result.method,

            preferredFormat:
              result.preferredFormat,

            officialReleaseDate:
              result.officialReleaseDate,

            selectedRelease:
              result.selectedRelease
                ? {
                    productId:
                      result
                        .selectedRelease
                        .productId,

                    title:
                      result
                        .selectedRelease
                        .title,

                    year:
                      result
                        .selectedRelease
                        .movieYear,

                    format:
                      result
                        .selectedRelease
                        .format,

                    releaseDate:
                      result
                        .selectedRelease
                        .releaseDate,

                    releaseDateIso:
                      result
                        .selectedRelease
                        .releaseDateIso,

                    studio:
                      result
                        .selectedRelease
                        .studio,

                    sourceUrl:
                      result
                        .selectedRelease
                        .sourceUrl,
                  }
                : null,

            candidateCount:
              result
                .candidates
                .length,

            candidates:
              result
                .candidates
                .map(
                  (
                    candidate,
                  ) => ({
                    productId:
                      candidate.productId,

                    title:
                      candidate.title,

                    year:
                      candidate.movieYear,

                    format:
                      candidate.format,

                    releaseDate:
                      candidate.releaseDate,

                    releaseDateIso:
                      candidate.releaseDateIso,

                    studio:
                      candidate.studio,

                    sourceUrl:
                      candidate.sourceUrl,
                  }),
                ),

            details:
              result.details,
          };
        },
      );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      source:
        index.source,

      fetchedAt:
        index.fetchedAt,

      releaseWindow:
        index.window,

      monthsFetched:
        index.months,

      totalBluRayComRecords:
        index.total,

      tests,
    });
  } catch (error) {
    console.error(
      "Blu-ray.com matcher test failed:",
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
            : "Unknown Blu-ray.com matcher test error.",
      },
      {
        status:
          500,
      },
    );
  }
}