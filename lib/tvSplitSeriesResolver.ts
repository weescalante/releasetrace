export type TvSplitSeriesResolutionStatus =
  | "RESOLVED"
  | "AMBIGUOUS"
  | "NOT_FOUND";

export type TvSplitSeriesEpisodeCandidate = {
  tmdbId:
    number;

  tmdbTitle:
    string;

  firstAirDate:
    string | null;

  seasonNumber:
    number;

  episodeNumber:
    number;

  episodeTitle:
    string | null;

  episodeAirDate:
    string;

  distanceDays:
    number;
};

export type TvSplitSeriesResolution = {
  status:
    TvSplitSeriesResolutionStatus;

  selected:
    TvSplitSeriesEpisodeCandidate | null;

  candidates:
    TvSplitSeriesEpisodeCandidate[];

  details:
    string;
};

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

  results?:
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

const SEARCH_PAGES =
  3;

const MAX_RELATED_SERIES =
  15;

const MAX_SEASONS_PER_SERIES =
  4;

/*
 * Conservative limits.
 *
 * A split-series match must have an episode
 * reasonably close to the actual PreDB
 * observation.
 *
 * It must also be substantially closer than
 * any competing child-series candidate.
 */
const MAX_DISTANCE_DAYS =
  45;

const MIN_DISTANCE_GAP_DAYS =
  14;

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
  return String(
    value ??
    "",
  )
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

/*
 * Split anthology / franchise relationship.
 *
 * Example shape:
 *
 * source:
 *   Icons Unearthed
 *
 * child:
 *   Icons Unearthed: Arnold Schwarzenegger
 *
 * This is deliberately strict.
 *
 * We do NOT treat an arbitrary partial title
 * overlap as a related child series.
 */
function isChildSeriesTitle({
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
    return false;
  }

  return candidate.startsWith(
    `${source} `,
  );
}

function toTimestamp(
  value:
    string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return Number.isNaN(
    timestamp,
  )
    ? null
    : timestamp;
}

function getDistanceDays({
  airDate,

  detectedAt,
}: {
  airDate:
    string;

  detectedAt:
    string;
}) {
  const airTimestamp =
    toTimestamp(
      `${airDate}T00:00:00Z`,
    );

  const detectedTimestamp =
    toTimestamp(
      detectedAt,
    );

  if (
    airTimestamp ===
      null ||
    detectedTimestamp ===
      null
  ) {
    return null;
  }

  return (
    Math.abs(
      detectedTimestamp -
        airTimestamp,
    ) /
    86_400_000
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

async function searchRelatedChildSeries(
  sourceTitle:
    string,
) {
  const unique =
    new Map<
      number,
      TmdbSearchResult
    >();

  for (
    let page =
      1;
    page <=
      SEARCH_PAGES;
    page +=
      1
  ) {
    const params =
      new URLSearchParams({
        query:
          sourceTitle,

        include_adult:
          "false",

        language:
          "en-US",

        page:
          String(
            page,
          ),
      });

    const search =
      await tmdbFetch<
        TmdbSearchResponse
      >(
        `/search/tv?${params.toString()}`,
      );

    for (
      const candidate of
      search.results ??
      []
    ) {
      if (
        unique.has(
          candidate.id,
        )
      ) {
        continue;
      }

      const related =
        isChildSeriesTitle({
          sourceTitle,

          candidateTitle:
            candidate.name,
        }) ||
        isChildSeriesTitle({
          sourceTitle,

          candidateTitle:
            candidate
              .original_name ??
            "",
        });

      if (!related) {
        continue;
      }

      unique.set(
        candidate.id,
        candidate,
      );

      if (
        unique.size >=
        MAX_RELATED_SERIES
      ) {
        return [
          ...unique.values(),
        ];
      }
    }

    if (
      page >=
      search.total_pages
    ) {
      break;
    }
  }

  return [
    ...unique.values(),
  ];
}

function rankSeasons({
  seasons,

  detectedAt,
  episodeNumber,
}: {
  seasons:
    TmdbSeasonSummary[];

  detectedAt:
    string;

  episodeNumber:
    number;
}) {
  const detectedTimestamp =
    toTimestamp(
      detectedAt,
    );

  const usable =
    seasons.filter(
      (
        season,
      ) =>
        season.season_number >
          0 &&
        season.episode_count >=
          episodeNumber,
    );

  const scored =
    usable.map(
      (
        season,
      ) => {
        const airTimestamp =
          season.air_date
            ? toTimestamp(
                `${season.air_date}T00:00:00Z`,
              )
            : null;

        const distance =
          detectedTimestamp !==
            null &&
          airTimestamp !==
            null
            ? Math.abs(
                detectedTimestamp -
                  airTimestamp,
              )
            : Number.MAX_SAFE_INTEGER;

        return {
          season,

          distance,
        };
      },
    );

  scored.sort(
    (
      a,
      b,
    ) => {
      if (
        a.distance !==
        b.distance
      ) {
        return (
          a.distance -
          b.distance
        );
      }

      return (
        b.season
          .season_number -
        a.season
          .season_number
      );
    },
  );

  return scored
    .slice(
      0,
      MAX_SEASONS_PER_SERIES,
    )
    .map(
      (
        item,
      ) =>
        item.season,
    );
}

async function inspectChildSeries({
  candidate,

  sourceEpisodeNumber,

  detectedAt,
}: {
  candidate:
    TmdbSearchResult;

  sourceEpisodeNumber:
    number;

  detectedAt:
    string;
}) {
  const details =
    await tmdbFetch<
      TmdbTvDetails
    >(
      `/tv/${candidate.id}?language=en-US`,
    );

  const seasons =
    rankSeasons({
      seasons:
        details.seasons ??
        [],

      detectedAt,

      episodeNumber:
        sourceEpisodeNumber,
    });

  const results:
    TvSplitSeriesEpisodeCandidate[] =
    [];

  for (
    const season of
    seasons
  ) {
    try {
      const episode =
        await tmdbFetch<
          TmdbEpisode
        >(
          `/tv/${candidate.id}/season/${season.season_number}/episode/${sourceEpisodeNumber}?language=en-US`,
        );

      const airDate =
        episode.air_date ??
        null;

      if (!airDate) {
        continue;
      }

      const distanceDays =
        getDistanceDays({
          airDate,

          detectedAt,
        });

      if (
        distanceDays ===
        null
      ) {
        continue;
      }

      results.push({
        tmdbId:
          candidate.id,

        tmdbTitle:
          details.name,

        firstAirDate:
          details
            .first_air_date ??
          candidate
            .first_air_date ??
          null,

        seasonNumber:
          episode
            .season_number,

        episodeNumber:
          episode
            .episode_number,

        episodeTitle:
          episode.name ??
          null,

        episodeAirDate:
          airDate,

        distanceDays:
          Math.round(
            distanceDays *
              100,
          ) /
          100,
      });
    } catch {
      /*
       * One child series lacking the requested
       * episode is expected and should not
       * abort the entire resolver.
       */
    }
  }

  return results;
}

/*
 * Generic fallback for sources whose season
 * model represents a franchise/anthology as
 * one long-running show while TMDB represents
 * each subject as a separate child series.
 *
 * No show names, TMDB IDs, years, or season
 * mappings are hard-coded here.
 */
export async function resolveTvSplitSeries({
  sourceTitle,

  sourceSeasonNumber,

  sourceEpisodeNumber,

  detectedAt,
}: {
  sourceTitle:
    string;

  sourceSeasonNumber:
    number;

  sourceEpisodeNumber:
    number;

  detectedAt:
    string;
}): Promise<
  TvSplitSeriesResolution
> {
  if (
    !sourceTitle.trim()
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        [],

      details:
        "No usable source series title was supplied.",
    };
  }

  if (
    !Number.isInteger(
      sourceSeasonNumber,
    ) ||
    sourceSeasonNumber <=
      0 ||
    !Number.isInteger(
      sourceEpisodeNumber,
    ) ||
    sourceEpisodeNumber <=
      0
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        [],

      details:
        "A valid source season and episode number are required.",
    };
  }

  if (
    toTimestamp(
      detectedAt,
    ) ===
    null
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        [],

      details:
        "A valid source detection timestamp is required.",
    };
  }

  const relatedSeries =
    await searchRelatedChildSeries(
      sourceTitle,
    );

  if (
    relatedSeries.length ===
    0
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        [],

      details:
        `TMDB returned no strict child-series candidates for "${sourceTitle}".`,
    };
  }

  const episodeCandidates:
    TvSplitSeriesEpisodeCandidate[] =
    [];

  for (
    const candidate of
    relatedSeries
  ) {
    const candidateEpisodes =
      await inspectChildSeries({
        candidate,

        sourceEpisodeNumber,

        detectedAt,
      });

    episodeCandidates.push(
      ...candidateEpisodes,
    );
  }

  episodeCandidates.sort(
    (
      a,
      b,
    ) =>
      a.distanceDays -
      b.distanceDays,
  );

  if (
    episodeCandidates.length ===
    0
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        [],

      details:
        `Related TMDB child series were found for "${sourceTitle}", but none contained episode ${sourceEpisodeNumber} with a usable air date.`,
    };
  }

  const best =
    episodeCandidates[0];

  const second =
    episodeCandidates[1] ??
    null;

  if (
    best.distanceDays >
    MAX_DISTANCE_DAYS
  ) {
    return {
      status:
        "NOT_FOUND",

      selected:
        null,

      candidates:
        episodeCandidates.slice(
          0,
          10,
        ),

      details:
        `The closest related TMDB child-series episode was ${best.distanceDays} days from the PreDB detection, outside the ${MAX_DISTANCE_DAYS}-day safety window.`,
    };
  }

  if (second) {
    const gap =
      second.distanceDays -
      best.distanceDays;

    if (
      gap <
      MIN_DISTANCE_GAP_DAYS
    ) {
      return {
        status:
          "AMBIGUOUS",

        selected:
          null,

        candidates:
          episodeCandidates.slice(
            0,
            10,
          ),

        details:
          `Multiple related TMDB child-series episodes are too close together. Best distance: ${best.distanceDays} days; second-best: ${second.distanceDays} days.`,
      };
    }
  }

  return {
    status:
      "RESOLVED",

    selected:
      best,

    candidates:
      episodeCandidates.slice(
        0,
        10,
      ),

    details:
      `Resolved source season ${sourceSeasonNumber} episode ${sourceEpisodeNumber} to TMDB TV ${best.tmdbId} "${best.tmdbTitle}" S${String(
        best.seasonNumber,
      ).padStart(
        2,
        "0",
      )}E${String(
        best.episodeNumber,
      ).padStart(
        2,
        "0",
      )}. Episode air-date distance from the PreDB observation: ${best.distanceDays} days.`,
  };
}