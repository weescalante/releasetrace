import {
  classifyPredbUnknownContent,
  parsePredbTvHtml,
  parsePredbUnknownHtml,
} from "../../../../data/predb";

import {
  ingestPredbTv,
} from "../../../../data/predbTvIngestion";

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
    typeof parsePredbTvHtml
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

    const tvHtml =
      payload.tvHtml;

    const unknownHtml =
      payload.unknownHtml;

    if (
      typeof tvHtml !==
        "string" ||
      tvHtml.trim()
        .length ===
        0
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "tvHtml is required.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      tvHtml.length >
      MAX_HTML_LENGTH
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "tvHtml exceeds the allowed size.",
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
     * GitHub Actions fetches the PreDB TV page
     * because PreDB blocks Vercel's outbound
     * network with HTTP 403.
     *
     * Vercel still owns parsing, matching,
     * TMDB verification, Gemini fallback,
     * and Turso persistence.
     */
    const tvReleases =
      parsePredbTvHtml(
        tvHtml,
      ).filter(
        isRelevantRelease,
      );

    /*
     * The Unknown page remains supplemental.
     *
     * GitHub may omit it if PreDB refuses that
     * page independently. TV ingestion must
     * still continue using the primary TV page.
     */
    const unknownTvCandidates =
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
                "TV_CANDIDATE",
            )
        : [];

    /*
     * Match the same high-level behavior as
     * getPredbTvReleases():
     *
     * primary TV releases
     * + supplemental Unknown TV candidates
     * + post-ID deduplication
     * + newest-first ordering.
     */
    const rawReleases =
      mergeByPostId([
        tvReleases,
        unknownTvCandidates,
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
            "No relevant PreDB TV releases were parsed from the supplied HTML.",

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
      `PreDB TV POST received ${tvReleases.length} primary releases and ${unknownTvCandidates.length} supplemental TV candidates.`,
    );

    const result =
      await ingestPredbTv({
        write:
          true,

        rawReleases,
      });

    if (
      !result.success
    ) {
      console.error(
        "PreDB TV ingestion completed with errors or invalid identities.",
        result.summary,
      );

      return Response.json(
        {
          success:
            false,

          message:
            "PreDB TV ingestion completed with errors.",

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
        "PreDB TV ingestion completed.",

      checkedAt:
        new Date()
          .toISOString(),

      source: {
        primaryTvReleases:
          tvReleases.length,

        supplementalUnknownTvCandidates:
          unknownTvCandidates.length,

        suppliedReleases:
          rawReleases.length,
      },

      summary:
        result.summary,
    });
  } catch (error) {
    console.error(
      "PreDB TV ingestion failed:",
      error,
    );

    return Response.json(
      {
        success:
          false,

        message:
          "PreDB TV ingestion failed.",

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