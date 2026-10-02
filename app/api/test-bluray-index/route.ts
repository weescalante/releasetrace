import {
  NextResponse,
} from "next/server";

import {
  getBluRayComReleaseWindow,
  normalizeBluRayTitle,
} from "../../../data/blurayCom";

export const dynamic =
  "force-dynamic";

type TestMovie = {
  title: string;

  year: string;
};

const TEST_MOVIES:
  TestMovie[] = [
    {
      title:
        "Batman Knightfall Part 1 Knightfall",

      year:
        "2026",
    },

    {
      title:
        "Harbinger",

      year:
        "2026",
    },
  ];

function findCandidates({
  title,
  year,
  releases,
}: {
  title: string;

  year: string;

  releases:
    Awaited<
      ReturnType<
        typeof getBluRayComReleaseWindow
      >
    >["releases"];
}) {
  const normalizedTitle =
    normalizeBluRayTitle(
      title,
    );

  return releases.filter(
    (
      release,
    ) => {
      const titleMatches =
        release
          .normalizedTitle
          .includes(
            normalizedTitle,
          ) ||
        normalizedTitle.includes(
          release.normalizedTitle,
        );

      if (
        !titleMatches
      ) {
        return false;
      }

      /*
       * Prefer the same movie year.
       *
       * If Blu-ray.com has no year value,
       * don't automatically reject the
       * candidate.
       */
      if (
        release.movieYear &&
        release.movieYear !==
          year
      ) {
        return false;
      }

      return true;
    },
  );
}

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
          const candidates =
            findCandidates({
              title:
                movie.title,

              year:
                movie.year,

              releases:
                index.releases,
            });

          const releaseDates =
            [
              ...new Set(
                candidates
                  .map(
                    (
                      candidate,
                    ) =>
                      candidate
                        .releaseDateIso,
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      Boolean(
                        value,
                      ),
                  ),
              ),
            ].sort();

          return {
            input: {
              title:
                movie.title,

              normalizedTitle:
                normalizeBluRayTitle(
                  movie.title,
                ),

              year:
                movie.year,
            },

            candidateCount:
              candidates.length,

            officialReleaseDates:
              releaseDates,

            candidates:
              candidates.map(
                (
                  candidate,
                ) => ({
                  productId:
                    candidate.productId,

                  title:
                    candidate.title,

                  normalizedTitle:
                    candidate.normalizedTitle,

                  movieYear:
                    candidate.movieYear,

                  releaseDate:
                    candidate.releaseDate,

                  releaseDateIso:
                    candidate.releaseDateIso,

                  format:
                    candidate.format,

                  studio:
                    candidate.studio,

                  sourceUrl:
                    candidate.sourceUrl,
                }),
              ),
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

      window:
        index.window,

      monthsFetched:
        index.months,

      totalReleaseRecords:
        index.total,

      tests,
    });
  } catch (error) {
    console.error(
      "Blu-ray.com index test failed:",
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
            : "Unknown Blu-ray.com index test error.",
      },
      {
        status:
          500,
      },
    );
  }
}