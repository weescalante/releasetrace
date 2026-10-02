import {
  NextResponse,
} from "next/server";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const SOURCE_TITLE =
  "Icons Unearthed";

const SOURCE_SEASON =
  14;

const SOURCE_EPISODE =
  5;

const SOURCE_DETECTED_AT =
  "2026-10-02T04:31:35.000Z";

type TmdbSearchResult = {
  id:
    number;

  name:
    string;

  original_name?:
    string;

  first_air_date?:
    string | null;
};

type TmdbSearchResponse = {
  page:
    number;

  total_pages:
    number;

  results:
    TmdbSearchResult[];
};

type TmdbSeasonSummary = {
  season_number:
    number;

  episode_count:
    number;

  air_date?:
    string | null;
};

type TmdbTvDetails = {
  id:
    number;

  name:
    string;

  original_name?:
    string;

  first_air_date?:
    string | null;

  seasons?:
    TmdbSeasonSummary[];
};

type TmdbEpisode = {
  id:
    number;

  name:
    string;

  season_number:
    number;

  episode_number:
    number;

  air_date?:
    string | null;
};

function getTmdbToken() {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN
      ?.trim();

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is not configured.",
    );
  }

  return token;
}

function normalizeTitle(
  value:
    string,
) {
  return value
    .normalize(
      "NFKD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /&/g,
      " and ",
    )
    .replace(
      /['’]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function isRelatedTitle({
  sourceTitle,

  candidateTitle,
}: {
  sourceTitle:
    string;

  candidateTitle:
    string;
}) {
  const source =
    normalizeTitle(
      sourceTitle,
    );

  const candidate =
    normalizeTitle(
      candidateTitle,
    );

  if (
    !source ||
    !candidate
  ) {
    return false;
  }

  if (
    candidate ===
    source
  ) {
    return true;
  }

  return candidate.startsWith(
    `${source} `,
  );
}

function getAirDateDistanceDays({
  airDate,

  detectedAt,
}: {
  airDate:
    string | null;

  detectedAt:
    string;
}) {
  if (!airDate) {
    return null;
  }

  const airTime =
    new Date(
      `${airDate}T00:00:00Z`,
    ).getTime();

  const detectedTime =
    new Date(
      detectedAt,
    ).getTime();

  if (
    Number.isNaN(
      airTime,
    ) ||
    Number.isNaN(
      detectedTime,
    )
  ) {
    return null;
  }

  return (
    Math.round(
      (
        (
          detectedTime -
          airTime
        ) /
        86_400_000
      ) *
        100,
    ) /
    100
  );
}

async function tmdbFetch<T>(
  path:
    string,
): Promise<T> {
  const token =
    getTmdbToken();

  const response =
    await fetch(
      `https://api.themoviedb.org/3${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          accept:
            "application/json",
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `TMDB request failed with status ${response.status}: ${path}`,
    );
  }

  return await response.json() as
    T;
}

async function searchCandidates() {
  const unique =
    new Map<
      number,
      TmdbSearchResult
    >();

  /*
   * Search several result pages because a
   * split anthology may have many similarly
   * named TMDB child series.
   */
  for (
    let page =
      1;
    page <=
      3;
    page +=
      1
  ) {
    const params =
      new URLSearchParams({
        query:
          SOURCE_TITLE,

        include_adult:
          "false",

        language:
          "en-US",

        page:
          String(
            page,
          ),
      });

    const result =
      await tmdbFetch<
        TmdbSearchResponse
      >(
        `/search/tv?${params.toString()}`,
      );

    for (
      const candidate of
      result.results
    ) {
      if (
        !unique.has(
          candidate.id,
        )
      ) {
        unique.set(
          candidate.id,
          candidate,
        );
      }
    }

    if (
      page >=
      result.total_pages
    ) {
      break;
    }
  }

  return [
    ...unique.values(),
  ].filter(
    (
      candidate,
    ) =>
      isRelatedTitle({
        sourceTitle:
          SOURCE_TITLE,

        candidateTitle:
          candidate.name,
      }) ||
      isRelatedTitle({
        sourceTitle:
          SOURCE_TITLE,

        candidateTitle:
          candidate
            .original_name ??
          "",
      }),
  );
}

export async function GET() {
  try {
    const candidates =
      await searchCandidates();

    const episodeCandidates:
      Array<{
        tmdbId:
          number;

        tmdbTitle:
          string;

        tmdbFirstAirDate:
          string | null;

        tmdbSeasonNumber:
          number;

        sourceSeasonNumber:
          number;

        episodeNumber:
          number;

        episodeTitle:
          string;

        episodeAirDate:
          string | null;

        detectedAt:
          string;

        distanceDays:
          number | null;
      }> =
      [];

    for (
      const candidate of
      candidates
    ) {
      const details =
        await tmdbFetch<
          TmdbTvDetails
        >(
          `/tv/${candidate.id}?language=en-US`,
        );

      const seasons =
        details
          .seasons ??
        [];

      for (
        const season of
        seasons
      ) {
        if (
          season.season_number <=
            0 ||
          season.episode_count <
            SOURCE_EPISODE
        ) {
          continue;
        }

        try {
          const episode =
            await tmdbFetch<
              TmdbEpisode
            >(
              `/tv/${candidate.id}/season/${season.season_number}/episode/${SOURCE_EPISODE}?language=en-US`,
            );

          episodeCandidates.push({
            tmdbId:
              candidate.id,

            tmdbTitle:
              details.name,

            tmdbFirstAirDate:
              details
                .first_air_date ??
              null,

            tmdbSeasonNumber:
              episode
                .season_number,

            sourceSeasonNumber:
              SOURCE_SEASON,

            episodeNumber:
              episode
                .episode_number,

            episodeTitle:
              episode.name,

            episodeAirDate:
              episode
                .air_date ??
              null,

            detectedAt:
              SOURCE_DETECTED_AT,

            distanceDays:
              getAirDateDistanceDays({
                airDate:
                  episode
                    .air_date ??
                  null,

                detectedAt:
                  SOURCE_DETECTED_AT,
              }),
          });
        } catch {
          /*
           * Missing episode data for one
           * candidate is not a test failure.
           */
        }
      }
    }

    episodeCandidates.sort(
      (
        a,
        b,
      ) => {
        if (
          a.distanceDays ===
          null &&
          b.distanceDays ===
          null
        ) {
          return 0;
        }

        if (
          a.distanceDays ===
          null
        ) {
          return 1;
        }

        if (
          b.distanceDays ===
          null
        ) {
          return -1;
        }

        return (
          Math.abs(
            a.distanceDays,
          ) -
          Math.abs(
            b.distanceDays,
          )
        );
      },
    );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      test: {
        sourceTitle:
          SOURCE_TITLE,

        sourceSeasonNumber:
          SOURCE_SEASON,

        sourceEpisodeNumber:
          SOURCE_EPISODE,

        sourceDetectedAt:
          SOURCE_DETECTED_AT,
      },

      summary: {
        relatedTmdbSeries:
          candidates.length,

        episodeCandidates:
          episodeCandidates.length,
      },

      closestEpisodeCandidates:
        episodeCandidates.slice(
          0,
          15,
        ),
    });
  } catch (error) {
    console.error(
      "Split-series TV diagnostic failed:",
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
            : "Unknown split-series diagnostic error.",
      },
      {
        status:
          500,
      },
    );
  }
}