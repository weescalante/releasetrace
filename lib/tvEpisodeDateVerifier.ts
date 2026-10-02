export type TvEpisodeDateVerificationStatus =
  | "CONFIRMED"
  | "NOT_FOUND"
  | "UNAVAILABLE";

export type TvEpisodeDateMatch = {
  tmdbId:
    number;

  seriesTitle:
    string | null;

  targetDate:
    string;

  status:
    TvEpisodeDateVerificationStatus;

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeTitle:
    string | null;

  episodeAirDate:
    string | null;

  checkedSeasons:
    number[];

  details:
    string;
};

type TmdbSeasonSummary = {
  id:
    number;

  name:
    string;

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

  first_air_date?:
    string | null;

  last_air_date?:
    string | null;

  in_production?:
    boolean;

  seasons?:
    TmdbSeasonSummary[];
};

type TmdbSeasonEpisode = {
  id:
    number;

  name:
    string;

  episode_number:
    number;

  season_number:
    number;

  air_date?:
    string | null;
};

type TmdbSeasonDetails = {
  id:
    number;

  name:
    string;

  season_number:
    number;

  episodes?:
    TmdbSeasonEpisode[];
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

function isValidIsoDate(
  value: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const time =
    Date.parse(
      `${value}T00:00:00Z`,
    );

  return !Number.isNaN(
    time,
  );
}

function dateToUtcTime(
  value:
    string | null | undefined,
) {
  if (
    !value ||
    !isValidIsoDate(
      value,
    )
  ) {
    return null;
  }

  const time =
    Date.parse(
      `${value}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      time,
    )
  ) {
    return null;
  }

  return time;
}

async function fetchTmdbTvDetails(
  tmdbId:
    number,
) {
  const token =
    getTmdbToken();

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`,
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
      `TMDB TV details request failed with status ${response.status}.`,
    );
  }

  return await response.json() as
    TmdbTvDetails;
}

async function fetchTmdbSeason({
  tmdbId,

  seasonNumber,
}: {
  tmdbId:
    number;

  seasonNumber:
    number;
}) {
  const token =
    getTmdbToken();

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?language=en-US`,
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

  if (
    response.status ===
    404
  ) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `TMDB season ${seasonNumber} request failed with status ${response.status}.`,
    );
  }

  return await response.json() as
    TmdbSeasonDetails;
}

function rankCandidateSeasons({
  seasons,

  targetDate,
  maxSeasons,
}: {
  seasons:
    TmdbSeasonSummary[];

  targetDate:
    string;

  maxSeasons:
    number;
}) {
  const targetTime =
    dateToUtcTime(
      targetDate,
    );

  if (
    targetTime ===
    null
  ) {
    return [];
  }

  const usable =
    seasons.filter(
      (
        season,
      ) =>
        season.season_number >
          0 &&
        season.episode_count >
          0,
    );

  const ranked =
    usable.map(
      (
        season,
      ) => {
        const airTime =
          dateToUtcTime(
            season.air_date,
          );

        /*
         * A season with a real TMDB air date
         * gets ranked by distance from the
         * target episode date.
         *
         * Seasons with no air date are still
         * retained, but ranked after dated
         * seasons.
         */
        const distance =
          airTime ===
          null
            ? Number.MAX_SAFE_INTEGER
            : Math.abs(
                targetTime -
                  airTime,
              );

        return {
          season,

          distance,

          hasAirDate:
            airTime !==
            null,
        };
      },
    );

  ranked.sort(
    (
      a,
      b,
    ) => {
      if (
        a.hasAirDate &&
        !b.hasAirDate
      ) {
        return -1;
      }

      if (
        !a.hasAirDate &&
        b.hasAirDate
      ) {
        return 1;
      }

      if (
        a.distance !==
        b.distance
      ) {
        return (
          a.distance -
          b.distance
        );
      }

      /*
       * If neither season has a useful date,
       * newer season numbers are more likely
       * to contain a current episode.
       */
      return (
        b.season
          .season_number -
        a.season
          .season_number
      );
    },
  );

  /*
   * Usually the nearest one or two seasons
   * are sufficient. We allow several because
   * TMDB season metadata is not perfectly
   * consistent for long-running programmes.
   */
  const selected =
    ranked
      .slice(
        0,
        Math.max(
          1,
          maxSeasons,
        ),
      )
      .map(
        (
          entry,
        ) =>
          entry.season,
      );

  /*
   * Also include the numerically newest
   * season if it was not already selected.
   *
   * This helps long-running daily/talk/game
   * shows where a season air_date may be
   * absent or incomplete.
   */
  const newestSeason =
    [...usable].sort(
      (
        a,
        b,
      ) =>
        b.season_number -
        a.season_number,
    )[0];

  if (
    newestSeason &&
    !selected.some(
      (
        season,
      ) =>
        season.season_number ===
        newestSeason.season_number,
    )
  ) {
    selected.push(
      newestSeason,
    );
  }

  /*
   * Add immediate neighboring seasons around
   * the strongest candidate.
   *
   * An episode near a season boundary can
   * otherwise be missed.
   */
  const primary =
    selected[0];

  if (primary) {
    for (
      const neighborNumber of [
        primary.season_number -
          1,

        primary.season_number +
          1,
      ]
    ) {
      if (
        neighborNumber <=
        0
      ) {
        continue;
      }

      const neighbor =
        usable.find(
          (
            season,
          ) =>
            season.season_number ===
            neighborNumber,
        );

      if (
        neighbor &&
        !selected.some(
          (
            season,
          ) =>
            season.season_number ===
            neighbor.season_number,
        )
      ) {
        selected.push(
          neighbor,
        );
      }
    }
  }

  return selected;
}

export async function verifyTmdbTvEpisodeByDate({
  tmdbId,

  targetDate,

  maxSeasons =
    4,
}: {
  tmdbId:
    number;

  targetDate:
    string;

  maxSeasons?:
    number;
}): Promise<
  TvEpisodeDateMatch
> {
  if (
    !Number.isInteger(
      tmdbId,
    ) ||
    tmdbId <=
      0
  ) {
    throw new Error(
      "A valid TMDB TV ID is required.",
    );
  }

  if (
    !isValidIsoDate(
      targetDate,
    )
  ) {
    throw new Error(
      `Invalid episode air date: ${targetDate}`,
    );
  }

  const details =
    await fetchTmdbTvDetails(
      tmdbId,
    );

  const seasons =
    details.seasons ??
    [];

  if (
    seasons.length ===
    0
  ) {
    return {
      tmdbId,

      seriesTitle:
        details.name ??
        null,

      targetDate,

      status:
        "UNAVAILABLE",

      seasonNumber:
        null,

      episodeNumber:
        null,

      episodeTitle:
        null,

      episodeAirDate:
        null,

      checkedSeasons:
        [],

      details:
        `TMDB TV ${tmdbId} "${details.name}" has no season metadata available.`,
    };
  }

  const candidateSeasons =
    rankCandidateSeasons({
      seasons,

      targetDate,

      maxSeasons,
    });

  if (
    candidateSeasons.length ===
    0
  ) {
    return {
      tmdbId,

      seriesTitle:
        details.name ??
        null,

      targetDate,

      status:
        "UNAVAILABLE",

      seasonNumber:
        null,

      episodeNumber:
        null,

      episodeTitle:
        null,

      episodeAirDate:
        null,

      checkedSeasons:
        [],

      details:
        `No usable TMDB seasons were available for TV ${tmdbId} "${details.name}".`,
    };
  }

  const checkedSeasons:
    number[] =
    [];

  let successfulSeasonRequests =
    0;

  for (
    const season of
    candidateSeasons
  ) {
    let seasonDetails:
      TmdbSeasonDetails | null =
      null;

    try {
      seasonDetails =
        await fetchTmdbSeason({
          tmdbId,

          seasonNumber:
            season.season_number,
        });
    } catch (error) {
      console.error(
        `TMDB date verifier could not inspect TV ${tmdbId} season ${season.season_number}:`,
        error,
      );

      continue;
    }

    if (!seasonDetails) {
      continue;
    }

    successfulSeasonRequests +=
      1;

    checkedSeasons.push(
      season.season_number,
    );

    const episodes =
      seasonDetails
        .episodes ??
      [];

    const matchingEpisode =
      episodes.find(
        (
          episode,
        ) =>
          episode.air_date ===
          targetDate,
      );

    if (
      matchingEpisode
    ) {
      return {
        tmdbId,

        seriesTitle:
          details.name ??
          null,

        targetDate,

        status:
          "CONFIRMED",

        seasonNumber:
          matchingEpisode
            .season_number,

        episodeNumber:
          matchingEpisode
            .episode_number,

        episodeTitle:
          matchingEpisode
            .name ??
          null,

        episodeAirDate:
          matchingEpisode
            .air_date ??
          null,

        checkedSeasons,

        details:
          `TMDB confirmed "${details.name}" aired S${String(
            matchingEpisode
              .season_number,
          ).padStart(
            2,
            "0",
          )}E${String(
            matchingEpisode
              .episode_number,
          ).padStart(
            2,
            "0",
          )} on ${targetDate}.`,
      };
    }
  }

  if (
    successfulSeasonRequests ===
    0
  ) {
    return {
      tmdbId,

      seriesTitle:
        details.name ??
        null,

      targetDate,

      status:
        "UNAVAILABLE",

      seasonNumber:
        null,

      episodeNumber:
        null,

      episodeTitle:
        null,

      episodeAirDate:
        null,

      checkedSeasons,

      details:
        `TMDB season data could not be inspected for TV ${tmdbId} "${details.name}".`,
    };
  }

  return {
    tmdbId,

    seriesTitle:
      details.name ??
      null,

    targetDate,

    status:
      "NOT_FOUND",

    seasonNumber:
      null,

    episodeNumber:
      null,

    episodeTitle:
      null,

    episodeAirDate:
      null,

    checkedSeasons,

    details:
      `No episode dated ${targetDate} was found in the inspected TMDB seasons for "${details.name}".`,
  };
}