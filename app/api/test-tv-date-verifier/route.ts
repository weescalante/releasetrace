import {
  NextResponse,
} from "next/server";

import {
  verifyTmdbTvEpisodeByDate,
} from "../../../lib/tvEpisodeDateVerifier";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

type VerificationTest = {
  label:
    string;

  targetDate:
    string;

  candidates: Array<{
    tmdbId:
      number;

    title:
      string;
  }>;
};

const TESTS:
  VerificationTest[] =
  [
    {
      label:
        "The Price Is Right",

      targetDate:
        "2026-09-30",

      candidates: [
        {
          tmdbId:
            2051,

          title:
            "The Price Is Right (1972 US)",
        },
        {
          tmdbId:
            64269,

          title:
            "The Price Is Right (1956 US)",
        },
        {
          tmdbId:
            2056,

          title:
            "The Price Is Right (UK)",
        },
        {
          tmdbId:
            45036,

          title:
            "The Price Is Right (Australia)",
        },
        {
          tmdbId:
            35378,

          title:
            "The Price Is Right (Philippines)",
        },
        {
          tmdbId:
            10816,

          title:
            "The Price Is Right (Australia revival)",
        },
      ],
    },

    {
      label:
        "Seth Meyers",

      targetDate:
        "2026-09-30",

      candidates: [
        {
          tmdbId:
            61818,

          title:
            "Late Night with Seth Meyers",
        },
        {
          tmdbId:
            259599,

          title:
            "Late Night with Seth Meyers: Corrections",
        },
      ],
    },

    {
      label:
        "Jimmy Fallon",

      targetDate:
        "2026-09-30",

      candidates: [
        {
          tmdbId:
            8621,

          title:
            "Late Night with Jimmy Fallon",
        },
        {
          tmdbId:
            297674,

          title:
            "On Brand with Jimmy Fallon",
        },
        {
          tmdbId:
            59941,

          title:
            "The Tonight Show Starring Jimmy Fallon",
        },
      ],
    },

    {
      label:
        "Watch What Happens Live",

      targetDate:
        "2026-09-30",

      candidates: [
        {
          tmdbId:
            22980,

          title:
            "Watch What Happens Live with Andy Cohen",
        },
      ],
    },
  ];

export async function GET() {
  try {
    const results =
      [];

    for (
      const test of
      TESTS
    ) {
      const candidates =
        [];

      for (
        const candidate of
        test.candidates
      ) {
        try {
          const verification =
            await verifyTmdbTvEpisodeByDate({
              tmdbId:
                candidate.tmdbId,

              targetDate:
                test.targetDate,
            });

          candidates.push({
            suppliedTitle:
              candidate.title,

            tmdbId:
              candidate.tmdbId,

            verification,
          });
        } catch (error) {
          candidates.push({
            suppliedTitle:
              candidate.title,

            tmdbId:
              candidate.tmdbId,

            verification:
              null,

            error:
              error instanceof
              Error
                ? error.message
                : "Unknown verification error.",
          });
        }
      }

      const confirmed =
        candidates.filter(
          (
            candidate,
          ) =>
            candidate
              .verification
              ?.status ===
            "CONFIRMED",
        );

      results.push({
        label:
          test.label,

        targetDate:
          test.targetDate,

        confirmedCount:
          confirmed.length,

        confirmed,

        candidates,
      });
    }

    const totalConfirmed =
      results.reduce(
        (
          total,
          result,
        ) =>
          total +
          result.confirmedCount,
        0,
      );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      purpose:
        "Test TMDB date-based TV episode verification before production integration.",

      summary: {
        testGroups:
          results.length,

        totalCandidates:
          TESTS.reduce(
            (
              total,
              test,
            ) =>
              total +
              test.candidates.length,
            0,
          ),

        totalConfirmed,
      },

      results,
    });
  } catch (error) {
    console.error(
      "TV date verifier test failed:",
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
            : "Unknown TV date verifier test error.",
      },
      {
        status:
          500,
      },
    );
  }
}