import {
  classifyPredbUnknownContent,
  parsePredbMoviesHtml,
  parsePredbUnknownHtml,
} from "../../../../data/predb";

import {
  ingestPredbMovies,
} from "../../../../data/predbIngestion";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const MAX_HTML_LENGTH =
  1_000_000;

type PredbRelease =
  ReturnType<
    typeof parsePredbMoviesHtml
  >[number];

function isRelevantRelease(
  release:
    PredbRelease,
) {
  return (
    release.signal ===
      "WEB" ||
    release.signal ===
      "BLURAY"
  );
}

function sortNewestFirst(
  releases:
    PredbRelease[],
) {
  return [
    ...releases,
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        new Date(
          a.publishedAt,
        ).getTime();

      const bTime =
        new Date(
          b.publishedAt,
        ).getTime();

      if (
        Number.isNaN(
          aTime,
        ) &&
        Number.isNaN(
          bTime,
        )
      ) {
        return 0;
      }

      if (
        Number.isNaN(
          aTime,
        )
      ) {
        return 1;
      }

      if (
        Number.isNaN(
          bTime,
        )
      ) {
        return -1;
      }

      return (
        bTime -
        aTime
      );
    },
  );
}

function mergeByPostId(
  groups:
    PredbRelease[][],
) {
  const merged =
    new Map<
      string,
      PredbRelease
    >();

  for (
    const group of
    groups
  ) {
    for (
      const release of
      group
    ) {
      if (
        !merged.has(
          release.postId,
        )
      ) {
        merged.set(
          release.postId,
          release,
        );
      }
    }
  }

  return sortNewestFirst(
    [
      ...merged.values(),
    ],
  );
}

function unauthorized() {
  return Response.json(
    {
      success:
        false,

      message:
        "Unauthorized.",
    },
    {
      status:
        401,
    },
  );
}

export async function POST(
  request:
    Request,
) {
  const cronSecret =
    process.env
      .CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is missing.",
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Server configuration error.",
      },
      {
        status:
          500,
      },
    );
  }

  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return unauthorized();
  }

  try {
    let body:
      unknown;

    try {
      body =
        await request.json();
    } catch {
      return Response.json(
        {
          success:
            false,

          message:
            "Request body must be valid JSON.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(
        body,
      )
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Request body must be a JSON object.",
        },
        {
          status:
            400,
        },
      );
    }

    const payload =
      body as Record<
        string,
        unknown
      >;

    const moviesHtml =
      payload.moviesHtml;

    const unknownHtml =
      payload.unknownHtml;

    if (
      typeof moviesHtml !==
        "string" ||
      moviesHtml.trim()
        .length ===
        0
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "moviesHtml is required.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      moviesHtml.length >
      MAX_HTML_LENGTH
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "moviesHtml exceeds the allowed size.",
        },
        {
          status:
            413,
        },
      );
    }

    if (
      unknownHtml !==
        undefined &&
      unknownHtml !==
        null &&
      typeof unknownHtml !==
        "string"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "unknownHtml must be a string when supplied.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      typeof unknownHtml ===
        "string" &&
      unknownHtml.length >
        MAX_HTML_LENGTH
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "unknownHtml exceeds the allowed size.",
        },
        {
          status:
            413,
        },
      );
    }

    /*
     * GitHub Actions fetches the primary
     * PreDB Movies page because PreDB may
     * reject Vercel's outbound requests.
     *
     * Vercel still owns parsing, TMDB
     * matching, release-window validation,
     * Blu-ray.com resolution, review
     * handling and Turso persistence.
     */
    const movieReleases =
      parsePredbMoviesHtml(
        moviesHtml,
      ).filter(
        isRelevantRelease,
      );

    /*
     * The Unknown page is supplemental.
     *
     * GitHub may omit it if that category
     * is unavailable. Primary movie
     * ingestion must still continue.
     */
    const unknownMovieCandidates =
      typeof unknownHtml ===
        "string" &&
      unknownHtml.trim()
        .length >
        0
        ? parsePredbUnknownHtml(
            unknownHtml,
          )
            .filter(
              isRelevantRelease,
            )
            .filter(
              (
                release,
              ) =>
                classifyPredbUnknownContent(
                  release.releaseName,
                ) ===
                "MOVIE_CANDIDATE",
            )
        : [];

    /*
     * Match getPredbMovieReleases():
     *
     * primary Movies releases
     * + supplemental Unknown movie candidates
     * + post-ID deduplication
     * + newest-first ordering.
     */
    const rawReleases =
      mergeByPostId([
        movieReleases,
        unknownMovieCandidates,
      ]);

    if (
      rawReleases.length ===
      0
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "No relevant PreDB movie releases were parsed from the supplied HTML.",

          checkedAt:
            new Date()
              .toISOString(),
        },
        {
          status:
            422,
        },
      );
    }

    console.log(
      `PreDB Movies POST received ${movieReleases.length} primary releases and ${unknownMovieCandidates.length} supplemental movie candidates.`,
    );

    const result =
      await ingestPredbMovies({
        write:
          true,

        rawReleases,
      });

    if (
      !result.success
    ) {
      console.error(
        "PreDB movie/Blu-ray ingestion completed with errors.",
        result.summary,
      );

      return Response.json(
        {
          success:
            false,

          message:
            "PreDB movie/Blu-ray ingestion completed with errors.",

          checkedAt:
            new Date()
              .toISOString(),

          summary:
            result.summary,
        },
        {
          status:
            500,
        },
      );
    }

    return Response.json({
      success:
        true,

      message:
        "PreDB movie/Blu-ray ingestion completed.",

      checkedAt:
        new Date()
          .toISOString(),

      source: {
        primaryMovieReleases:
          movieReleases.length,

        supplementalUnknownMovieCandidates:
          unknownMovieCandidates.length,

        suppliedReleases:
          rawReleases.length,
      },

      summary:
        result.summary,
    });
  } catch (error) {
    console.error(
      "PreDB movie/Blu-ray ingestion failed:",
      error,
    );

    return Response.json(
      {
        success:
          false,

        message:
          "PreDB movie/Blu-ray ingestion failed.",

        checkedAt:
          new Date()
            .toISOString(),
      },
      {
        status:
          500,
      },
    );
  }
}