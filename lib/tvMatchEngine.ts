import {
  verifyTmdbTvEpisodeByDate,
} from "./tvEpisodeDateVerifier";

import {
  resolveTvSplitSeries,
} from "./tvSplitSeriesResolver";

export type TvMatchInput = {
  seriesTitle: string;

  titleCandidates: string[];

  apparentYear: number | null;

  seasonNumber: number | null;

  episodeNumber: number | null;

  episodeAirDate: string | null;

  /*
   * Optional for backward compatibility.
   *
   * PreDB callers should provide this so the
   * split-series fallback can compare TMDB
   * episode dates with the actual first-seen
   * source observation.
   */
  detectedAt?:
    string | null;
};

export type TvMatchStatus =
  | "MATCHED"
  | "REVIEW"
  | "UNMATCHED";

export type TvEpisodeCheck =
  | "CONFIRMED"
  | "NOT_FOUND"
  | "NOT_CHECKED";

export type TvCandidateOption = {
  tmdbId: number;

  title: string;

  originalTitle: string | null;

  firstAirDate: string | null;

  firstAirYear: number | null;

  originCountries: string[];

  posterPath: string | null;

  overview: string | null;

  exactTitle: boolean;

  titleSimilarity: number;

  yearDifference: number | null;

  seasonNumber: number | null;

  episodeNumber: number | null;

  episodeCheck: TvEpisodeCheck;

  episodeTitle: string | null;

  episodeAirDate: string | null;

  confidence: number;
};

export type TvMatchResult = {
  status: TvMatchStatus;

  tmdbId: number | null;

  tmdbTitle: string | null;

  tmdbYear: number | null;

  confidence: number | null;

  posterPath: string | null;

  firstAirDate: string | null;

  originCountries: string[];

  seasonNumber: number | null;

  episodeNumber: number | null;

  episodeTitle: string | null;

  episodeAirDate: string | null;

  sourceEpisodeAirDate: string | null;

  candidateOptions: TvCandidateOption[];

  details: string;
};

type TmdbTvSearchCandidate = {
  id: number;

  name: string;

  original_name?: string;

  first_air_date?: string;

  origin_country?: string[];

  poster_path?: string | null;

  overview?: string;

  popularity?: number;

  vote_count?: number;
};

type TmdbTvSearchResponse = {
  results?: TmdbTvSearchCandidate[];
};

type TmdbTvDetails = {
  id: number;

  name: string;

  original_name?: string;

  first_air_date?: string;

  origin_country?: string[];

  poster_path?: string | null;

  overview?: string;

  number_of_seasons?: number;

  genres?: Array<{
    id: number;

    name: string;
  }>;
};

type TmdbTvEpisode = {
  id: number;

  name: string;

  air_date?: string | null;

  episode_number: number;

  season_number: number;

  overview?: string;
};

type CandidateEvaluation = {
  candidate: TmdbTvSearchCandidate;

  exactTitle: boolean;

  titleSimilarity: number;

  yearDifference: number | null;

  baseConfidence: number;

  confidence: number;

  episodeCheck: TvEpisodeCheck;

  episode: TmdbTvEpisode | null;
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
  value: string,
) {
  return String(
    value ?? "",
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

function tokenize(
  value: string,
) {
  return new Set(
    normalizeTitle(
      value,
    )
      .split(
        " ",
      )
      .filter(
        Boolean,
      ),
  );
}

function getTokenSimilarity(
  a: string,
  b: string,
) {
  const aTokens =
    tokenize(
      a,
    );

  const bTokens =
    tokenize(
      b,
    );

  if (
    aTokens.size === 0 ||
    bTokens.size === 0
  ) {
    return 0;
  }

  let intersection =
    0;

  for (
    const token of
    aTokens
  ) {
    if (
      bTokens.has(
        token,
      )
    ) {
      intersection +=
        1;
    }
  }

  const union =
    new Set([
      ...aTokens,
      ...bTokens,
    ]).size;

  if (
    union === 0
  ) {
    return 0;
  }

  return (
    intersection /
    union
  );
}

function getYearFromDate(
  value:
    string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /^(\d{4})-/,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  );
}

function getCandidateYear(
  candidate:
    TmdbTvSearchCandidate,
) {
  return getYearFromDate(
    candidate
      .first_air_date,
  );
}

function getYearDifference(
  expectedYear:
    number | null,

  candidateYear:
    number | null,
) {
  if (
    expectedYear === null ||
    candidateYear === null
  ) {
    return null;
  }

  return Math.abs(
    expectedYear -
      candidateYear,
  );
}

function uniqueTitleCandidates(
  input:
    TvMatchInput,
) {
  const seen =
    new Set<string>();

  const output:
    string[] =
    [];

  const candidates = [
    ...input
      .titleCandidates,

    input.seriesTitle,
  ];

  for (
    const candidate of
    candidates
  ) {
    const cleaned =
      candidate
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    if (!cleaned) {
      continue;
    }

    const key =
      normalizeTitle(
        cleaned,
      );

    if (
      !key ||
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    output.push(
      cleaned,
    );
  }

  return output;
}

function candidateNames(
  candidate:
    TmdbTvSearchCandidate,
) {
  return [
    candidate.name,

    candidate
      .original_name ??
      "",
  ].filter(
    Boolean,
  );
}

function calculateTitleSignals({
  candidate,

  input,
}: {
  candidate:
    TmdbTvSearchCandidate;

  input:
    TvMatchInput;
}) {
  const sourceTitles =
    uniqueTitleCandidates(
      input,
    );

  const tmdbTitles =
    candidateNames(
      candidate,
    );

  let exactTitle =
    false;

  let bestSimilarity =
    0;

  for (
    const sourceTitle of
    sourceTitles
  ) {
    const sourceNormalized =
      normalizeTitle(
        sourceTitle,
      );

    for (
      const tmdbTitle of
      tmdbTitles
    ) {
      const tmdbNormalized =
        normalizeTitle(
          tmdbTitle,
        );

      if (
        sourceNormalized &&
        sourceNormalized ===
          tmdbNormalized
      ) {
        exactTitle =
          true;

        bestSimilarity =
          1;

        continue;
      }

      bestSimilarity =
        Math.max(
          bestSimilarity,

          getTokenSimilarity(
            sourceTitle,
            tmdbTitle,
          ),
        );
    }
  }

  return {
    exactTitle,

    titleSimilarity:
      bestSimilarity,
  };
}

function calculateBaseConfidence({
  candidate,

  input,
}: {
  candidate:
    TmdbTvSearchCandidate;

  input:
    TvMatchInput;
}) {
  const {
    exactTitle,
    titleSimilarity,
  } =
    calculateTitleSignals({
      candidate,

      input,
    });

  const candidateYear =
    getCandidateYear(
      candidate,
    );

  const yearDifference =
    getYearDifference(
      input.apparentYear,

      candidateYear,
    );

  let confidence =
    exactTitle
      ? 78
      : Math.round(
          titleSimilarity *
            65,
        );

  if (
    input.apparentYear !==
    null
  ) {
    if (
      yearDifference === 0
    ) {
      confidence +=
        22;
    } else if (
      yearDifference === 1
    ) {
      confidence +=
        8;
    } else if (
      yearDifference !==
      null
    ) {
      confidence -=
        20;
    } else {
      confidence -=
        5;
    }
  }

  if (
    exactTitle &&
    candidate.vote_count &&
    candidate.vote_count >
      0
  ) {
    confidence +=
      1;
  }

  confidence =
    Math.max(
      0,

      Math.min(
        100,
        confidence,
      ),
    );

  return {
    exactTitle,

    titleSimilarity,

    yearDifference,

    confidence,
  };
}

async function searchTmdbTv({
  title,

  year,
}: {
  title: string;

  year: number | null;
}) {
  const token =
    getTmdbToken();

  const fetchSearch =
    async (
      useYear:
        boolean,
    ) => {
      const params =
        new URLSearchParams({
          query:
            title,

          include_adult:
            "false",

          language:
            "en-US",
        });

      if (
        useYear &&
        year !==
          null
      ) {
        params.set(
          "first_air_date_year",

          String(
            year,
          ),
        );
      }

      const response =
        await fetch(
          `https://api.themoviedb.org/3/search/tv?${params.toString()}`,
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
        !response.ok
      ) {
        throw new Error(
          `TMDB TV search failed with status ${response.status}.`,
        );
      }

      const data =
        await response.json() as
          TmdbTvSearchResponse;

      return (
        data.results ??
        []
      );
    };

  const results:
    TmdbTvSearchCandidate[] =
    [];

  if (
    year !==
    null
  ) {
    const yearResults =
      await fetchSearch(
        true,
      );

    results.push(
      ...yearResults.slice(
        0,
        10,
      ),
    );
  }

  const generalResults =
    await fetchSearch(
      false,
    );

  results.push(
    ...generalResults.slice(
      0,
      10,
    ),
  );

  const unique =
    new Map<
      number,
      TmdbTvSearchCandidate
    >();

  for (
    const candidate of
    results
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

  return [
    ...unique.values(),
  ];
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

  if (
    !response.ok
  ) {
    return null;
  }

  return await response.json() as
    TmdbTvDetails;
}

async function fetchTmdbEpisode({
  tmdbId,

  seasonNumber,

  episodeNumber,
}: {
  tmdbId:
    number;

  seasonNumber:
    number;

  episodeNumber:
    number;
}) {
  const token =
    getTmdbToken();

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US`,
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

  if (
    !response.ok
  ) {
    throw new Error(
      `TMDB TV episode lookup failed with status ${response.status}.`,
    );
  }

  return await response.json() as
    TmdbTvEpisode;
}

async function evaluateCandidate({
  candidate,

  input,

  checkEpisode,
}: {
  candidate:
    TmdbTvSearchCandidate;

  input:
    TvMatchInput;

  checkEpisode:
    boolean;
}): Promise<
  CandidateEvaluation
> {
  const base =
    calculateBaseConfidence({
      candidate,

      input,
    });

  let confidence =
    base.confidence;

  let episodeCheck:
    TvEpisodeCheck =
      "NOT_CHECKED";

  let episode:
    TmdbTvEpisode | null =
      null;

  if (
    checkEpisode &&
    input.seasonNumber !==
      null &&
    input.episodeNumber !==
      null
  ) {
    episode =
      await fetchTmdbEpisode({
        tmdbId:
          candidate.id,

        seasonNumber:
          input.seasonNumber,

        episodeNumber:
          input.episodeNumber,
      });

    if (episode) {
      episodeCheck =
        "CONFIRMED";

      confidence +=
        20;
    } else {
      episodeCheck =
        "NOT_FOUND";

      confidence -=
        25;
    }
  }

  confidence =
    Math.max(
      0,

      Math.min(
        100,
        confidence,
      ),
    );

  return {
    candidate,

    exactTitle:
      base.exactTitle,

    titleSimilarity:
      base.titleSimilarity,

    yearDifference:
      base.yearDifference,

    baseConfidence:
      base.confidence,

    confidence,

    episodeCheck,

    episode,
  };
}

function toCandidateOption(
  evaluation:
    CandidateEvaluation,

  input:
    TvMatchInput,
): TvCandidateOption {
  const candidate =
    evaluation.candidate;

  return {
    tmdbId:
      candidate.id,

    title:
      candidate.name,

    originalTitle:
      candidate
        .original_name ??
      null,

    firstAirDate:
      candidate
        .first_air_date ||
      null,

    firstAirYear:
      getCandidateYear(
        candidate,
      ),

    originCountries:
      candidate
        .origin_country ??
      [],

    posterPath:
      candidate
        .poster_path ??
      null,

    overview:
      candidate
        .overview ??
      null,

    exactTitle:
      evaluation
        .exactTitle,

    titleSimilarity:
      Math.round(
        evaluation
          .titleSimilarity *
          100,
      ) /
      100,

    yearDifference:
      evaluation
        .yearDifference,

    seasonNumber:
      input.seasonNumber,

    episodeNumber:
      input.episodeNumber,

    episodeCheck:
      evaluation
        .episodeCheck,

    episodeTitle:
      evaluation
        .episode
        ?.name ??
      null,

    episodeAirDate:
      evaluation
        .episode
        ?.air_date ??
      null,

    confidence:
      evaluation
        .confidence,
  };
}

function unmatchedResult({
  input,

  candidateOptions,

  details,
}: {
  input:
    TvMatchInput;

  candidateOptions:
    TvCandidateOption[];

  details:
    string;
}): TvMatchResult {
  return {
    status:
      "UNMATCHED",

    tmdbId:
      null,

    tmdbTitle:
      null,

    tmdbYear:
      null,

    confidence:
      null,

    posterPath:
      null,

    firstAirDate:
      null,

    originCountries:
      [],

    seasonNumber:
      input.seasonNumber,

    episodeNumber:
      input.episodeNumber,

    episodeTitle:
      null,

    episodeAirDate:
      null,

    sourceEpisodeAirDate:
      input.episodeAirDate,

    candidateOptions,

    details,
  };
}

function reviewResult({
  input,

  candidateOptions,

  details,
}: {
  input:
    TvMatchInput;

  candidateOptions:
    TvCandidateOption[];

  details:
    string;
}): TvMatchResult {
  const best =
    candidateOptions[0] ??
    null;

  return {
    status:
      "REVIEW",

    tmdbId:
      best?.tmdbId ??
      null,

    tmdbTitle:
      best?.title ??
      null,

    tmdbYear:
      best?.firstAirYear ??
      null,

    confidence:
      best?.confidence ??
      null,

    posterPath:
      best?.posterPath ??
      null,

    firstAirDate:
      best?.firstAirDate ??
      null,

    originCountries:
      best?.originCountries ??
      [],

    seasonNumber:
      input.seasonNumber,

    episodeNumber:
      input.episodeNumber,

    episodeTitle:
      best?.episodeTitle ??
      null,

    episodeAirDate:
      best?.episodeAirDate ??
      null,

    sourceEpisodeAirDate:
      input.episodeAirDate,

    candidateOptions,

    details,
  };
}

async function createMatchedResult({
  input,

  evaluation,

  confidence,
  seasonNumber,
  episodeNumber,
  episodeTitle,
  episodeAirDate,
  detailsText,
  candidateOptions,
}: {
  input:
    TvMatchInput;

  evaluation:
    CandidateEvaluation;

  confidence:
    number;

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeTitle:
    string | null;

  episodeAirDate:
    string | null;

  detailsText:
    string;

  candidateOptions:
    TvCandidateOption[];
}): Promise<
  TvMatchResult
> {
  const details =
    await fetchTmdbTvDetails(
      evaluation
        .candidate.id,
    );

  const matchedTitle =
    details?.name ??
    evaluation
      .candidate.name;

  const firstAirDate =
    details
      ?.first_air_date ??
    evaluation
      .candidate
      .first_air_date ??
    null;

  const firstAirYear =
    getYearFromDate(
      firstAirDate,
    ) ??
    getCandidateYear(
      evaluation
        .candidate,
    );

  return {
    status:
      "MATCHED",

    tmdbId:
      evaluation
        .candidate.id,

    tmdbTitle:
      matchedTitle,

    tmdbYear:
      firstAirYear,

    confidence,

    posterPath:
      details
        ?.poster_path ??
      evaluation
        .candidate
        .poster_path ??
      null,

    firstAirDate,

    originCountries:
      details
        ?.origin_country ??
      evaluation
        .candidate
        .origin_country ??
      [],

    seasonNumber,

    episodeNumber,

    episodeTitle,

    episodeAirDate,

    sourceEpisodeAirDate:
      input.episodeAirDate,

    candidateOptions,

    details:
      detailsText,
  };
}

async function resolveDateBasedCandidate({
  input,

  evaluations,

  candidateOptions,
}: {
  input:
    TvMatchInput;

  evaluations:
    CandidateEvaluation[];

  candidateOptions:
    TvCandidateOption[];
}): Promise<
  TvMatchResult | null
> {
  if (
    input.episodeAirDate ===
      null ||
    input.seasonNumber !==
      null ||
    input.episodeNumber !==
      null
  ) {
    return null;
  }

  const candidatesToVerify =
    evaluations
      .filter(
        (
          evaluation,
        ) =>
          evaluation
            .exactTitle ||
          evaluation
            .titleSimilarity >=
            0.25,
      )
      .slice(
        0,
        8,
      );

  if (
    candidatesToVerify.length ===
    0
  ) {
    return null;
  }

  const confirmations: Array<{
    evaluation:
      CandidateEvaluation;

    seasonNumber:
      number;

    episodeNumber:
      number;

    episodeTitle:
      string | null;

    episodeAirDate:
      string;

    details:
      string;
  }> =
    [];

  for (
    const evaluation of
    candidatesToVerify
  ) {
    try {
      const verification =
        await verifyTmdbTvEpisodeByDate({
          tmdbId:
            evaluation
              .candidate.id,

          targetDate:
            input
              .episodeAirDate,
        });

      if (
        verification.status !==
          "CONFIRMED" ||
        verification.seasonNumber ===
          null ||
        verification.episodeNumber ===
          null ||
        verification.episodeAirDate ===
          null
      ) {
        continue;
      }

      confirmations.push({
        evaluation,

        seasonNumber:
          verification
            .seasonNumber,

        episodeNumber:
          verification
            .episodeNumber,

        episodeTitle:
          verification
            .episodeTitle,

        episodeAirDate:
          verification
            .episodeAirDate,

        details:
          verification
            .details,
      });
    } catch (error) {
      console.error(
        `TV date verification failed for TMDB ${evaluation.candidate.id}:`,
        error,
      );
    }
  }

  if (
    confirmations.length ===
    1
  ) {
    const confirmed =
      confirmations[0];

    const confidence =
      Math.max(
        95,

        confirmed
          .evaluation
          .confidence,
      );

    return createMatchedResult({
      input,

      evaluation:
        confirmed
          .evaluation,

      confidence,

      seasonNumber:
        confirmed
          .seasonNumber,

      episodeNumber:
        confirmed
          .episodeNumber,

      episodeTitle:
        confirmed
          .episodeTitle,

      episodeAirDate:
        confirmed
          .episodeAirDate,

      candidateOptions,

      detailsText:
        `${confirmed.details} The exact episode air date resolved the otherwise ambiguous PreDB television title.`,
    });
  }

  if (
    confirmations.length >
    1
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        `${confirmations.length} plausible TMDB series contain an episode dated ${input.episodeAirDate}. Manual review is required.`,
    });
  }

  return null;
}

/*
 * Some source databases model an anthology or
 * franchise as one continuing series, while
 * TMDB splits each subject into a separate TV
 * record.
 *
 * Example structural shape:
 *
 * source:
 *   Parent Show S14E05
 *
 * TMDB:
 *   Parent Show: Subject
 *   S01E05
 *
 * The reusable split-series resolver verifies
 * this generically using:
 *
 * - strict parent-title prefix
 * - matching episode number
 * - episode air-date proximity
 * - separation from competing child series
 *
 * No individual show names or TMDB IDs are
 * hard-coded here.
 */
async function resolveSplitSeriesCandidate({
  input,

  candidateOptions,
}: {
  input:
    TvMatchInput;

  candidateOptions:
    TvCandidateOption[];
}): Promise<
  TvMatchResult | null
> {
  if (
    input.seasonNumber ===
      null ||
    input.episodeNumber ===
      null ||
    !input.detectedAt
  ) {
    return null;
  }

  let resolution;

  try {
    resolution =
      await resolveTvSplitSeries({
        sourceTitle:
          input.seriesTitle,

        sourceSeasonNumber:
          input.seasonNumber,

        sourceEpisodeNumber:
          input.episodeNumber,

        detectedAt:
          input.detectedAt,
      });
  } catch (error) {
    console.error(
      `TV split-series resolution failed for "${input.seriesTitle}":`,
      error,
    );

    return null;
  }

  if (
    resolution.status !==
      "RESOLVED" ||
    !resolution.selected
  ) {
    return null;
  }

  const selected =
    resolution.selected;

  const details =
    await fetchTmdbTvDetails(
      selected.tmdbId,
    );

  if (!details) {
    return null;
  }

  const firstAirDate =
    details
      .first_air_date ??
    selected
      .firstAirDate ??
    null;

  const firstAirYear =
    getYearFromDate(
      firstAirDate,
    );

  const similarity =
    getTokenSimilarity(
      input.seriesTitle,

      details.name,
    );

  const selectedOption:
    TvCandidateOption =
    {
      tmdbId:
        selected.tmdbId,

      title:
        details.name,

      originalTitle:
        details
          .original_name ??
        null,

      firstAirDate,

      firstAirYear,

      originCountries:
        details
          .origin_country ??
        [],

      posterPath:
        details
          .poster_path ??
        null,

      overview:
        details
          .overview ??
        null,

      exactTitle:
        normalizeTitle(
          input.seriesTitle,
        ) ===
        normalizeTitle(
          details.name,
        ),

      titleSimilarity:
        Math.round(
          similarity *
            100,
        ) /
        100,

      yearDifference:
        getYearDifference(
          input.apparentYear,

          firstAirYear,
        ),

      /*
       * Store the canonical TMDB child-series
       * season/episode identity.
       *
       * The source season can differ because
       * this fallback specifically handles
       * different season models.
       */
      seasonNumber:
        selected
          .seasonNumber,

      episodeNumber:
        selected
          .episodeNumber,

      episodeCheck:
        "CONFIRMED",

      episodeTitle:
        selected
          .episodeTitle,

      episodeAirDate:
        selected
          .episodeAirDate,

      confidence:
        95,
    };

  const combinedOptions = [
    selectedOption,

    ...candidateOptions.filter(
      (
        candidate,
      ) =>
        candidate.tmdbId !==
        selected.tmdbId,
    ),
  ].slice(
    0,
    6,
  );

  return {
    status:
      "MATCHED",

    tmdbId:
      selected.tmdbId,

    tmdbTitle:
      details.name,

    tmdbYear:
      firstAirYear,

    confidence:
      95,

    posterPath:
      details
        .poster_path ??
      null,

    firstAirDate,

    originCountries:
      details
        .origin_country ??
      [],

    seasonNumber:
      selected
        .seasonNumber,

    episodeNumber:
      selected
        .episodeNumber,

    episodeTitle:
      selected
        .episodeTitle,

    episodeAirDate:
      selected
        .episodeAirDate,

    sourceEpisodeAirDate:
      input.episodeAirDate,

    candidateOptions:
      combinedOptions,

    details:
      `${resolution.details} The source and TMDB use different season models, so the canonical TMDB child-series episode identity was retained.`,
  };
}

export async function matchTvSource(
  input:
    TvMatchInput,
): Promise<
  TvMatchResult
> {
  const titleCandidates =
    uniqueTitleCandidates(
      input,
    );

  if (
    titleCandidates.length ===
    0
  ) {
    return unmatchedResult({
      input,

      candidateOptions:
        [],

      details:
        "No usable television title was available for TMDB matching.",
    });
  }

  const candidateMap =
    new Map<
      number,
      TmdbTvSearchCandidate
    >();

  for (
    const title of
    titleCandidates
  ) {
    const results =
      await searchTmdbTv({
        title,

        year:
          input.apparentYear,
      });

    for (
      const candidate of
      results
    ) {
      if (
        !candidateMap.has(
          candidate.id,
        )
      ) {
        candidateMap.set(
          candidate.id,

          candidate,
        );
      }
    }
  }

  const candidates = [
    ...candidateMap.values(),
  ];

  if (
    candidates.length ===
    0
  ) {
    return unmatchedResult({
      input,

      candidateOptions:
        [],

      details:
        `TMDB returned no television candidates for "${input.seriesTitle}".`,
    });
  }

  const preliminary =
    candidates
      .map(
        (
          candidate,
        ) => {
          const score =
            calculateBaseConfidence({
              candidate,

              input,
            });

          return {
            candidate,

            ...score,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.confidence -
          a.confidence,
      );

  const candidatesToCheck =
    preliminary
      .filter(
        (
          item,
        ) =>
          item.confidence >=
          50,
      )
      .slice(
        0,
        5,
      );

  const checkedIds =
    new Set(
      candidatesToCheck.map(
        (
          item,
        ) =>
          item.candidate.id,
      ),
    );

  const evaluations:
    CandidateEvaluation[] =
    [];

  for (
    const item of
    preliminary.slice(
      0,
      10,
    )
  ) {
    const evaluation =
      await evaluateCandidate({
        candidate:
          item.candidate,

        input,

        checkEpisode:
          checkedIds.has(
            item.candidate.id,
          ),
      });

    evaluations.push(
      evaluation,
    );
  }

  evaluations.sort(
    (
      a,
      b,
    ) =>
      b.confidence -
      a.confidence,
  );

  const candidateOptions =
    evaluations
      .slice(
        0,
        6,
      )
      .map(
        (
          evaluation,
        ) =>
          toCandidateOption(
            evaluation,

            input,
          ),
      );

  const best =
    evaluations[0];

  if (!best) {
    return unmatchedResult({
      input,

      candidateOptions,

      details:
        `TMDB returned no usable television candidates for "${input.seriesTitle}".`,
    });
  }

  const second =
    evaluations[1] ??
    null;

  const confidenceGap =
    second
      ? best.confidence -
        second.confidence
      : 100;

  const strongExactTitles =
    evaluations.filter(
      (
        evaluation,
      ) =>
        evaluation.exactTitle &&
        evaluation.confidence >=
          75,
    );

  const lowConfidence =
    best.confidence <
    72;

  const weakTitle =
    !best.exactTitle &&
    best.titleSimilarity <
      0.8;

  const closeCandidates =
    Boolean(
      second &&
      confidenceGap <
        8,
    );

  const multipleExactDateCandidates =
    input.episodeAirDate !==
      null &&
    input.apparentYear ===
      null &&
    strongExactTitles.length >
      1 &&
    confidenceGap <
      15;

  const needsDateResolution =
    input.episodeAirDate !==
      null &&
    input.seasonNumber ===
      null &&
    input.episodeNumber ===
      null &&
    (
      lowConfidence ||
      weakTitle ||
      closeCandidates ||
      multipleExactDateCandidates
    );

  if (
    needsDateResolution
  ) {
    const dateResolved =
      await resolveDateBasedCandidate({
        input,

        evaluations,

        candidateOptions,
      });

    if (
      dateResolved
    ) {
      return dateResolved;
    }
  }

  /*
   * Before sending an SxxExx release to
   * manual review, try the generic
   * split-series resolver when:
   *
   * - the source contains SxxExx
   * - we know the actual PreDB timestamp
   * - normal TMDB matching did not already
   *   confirm the episode on a strong match
   *
   * This handles differing anthology/franchise
   * season models without weakening ordinary
   * episode matching.
   */
  const needsSplitSeriesResolution =
    input.seasonNumber !==
      null &&
    input.episodeNumber !==
      null &&
    Boolean(
      input.detectedAt,
    ) &&
    (
      best.confidence <
        72 ||
      best.episodeCheck !==
        "CONFIRMED" ||
      (
        !best.exactTitle &&
        best.titleSimilarity <
          0.8
      )
    );

  if (
    needsSplitSeriesResolution
  ) {
    const splitResolved =
      await resolveSplitSeriesCandidate({
        input,

        candidateOptions,
      });

    if (
      splitResolved
    ) {
      return splitResolved;
    }
  }

  if (
    best.confidence <
    72
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        `Best TMDB television candidate scored only ${best.confidence}/100.`,
    });
  }

  if (
    !best.exactTitle &&
    best.titleSimilarity <
      0.8
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        "The strongest TMDB candidate does not match the PreDB series title closely enough.",
    });
  }

  if (
    input.apparentYear !==
      null &&
    best.yearDifference !==
      null &&
    best.yearDifference >
      1
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        `The strongest TMDB candidate differs from the apparent PreDB series year ${input.apparentYear}.`,
    });
  }

  if (
    input.seasonNumber !==
      null &&
    input.episodeNumber !==
      null &&
    best.episodeCheck !==
      "CONFIRMED"
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        `TMDB did not confirm S${String(
          input.seasonNumber,
        ).padStart(
          2,
          "0",
        )}E${String(
          input.episodeNumber,
        ).padStart(
          2,
          "0",
        )} for the strongest series candidate.`,
    });
  }

  if (
    second &&
    confidenceGap <
      8
  ) {
    return reviewResult({
      input,

      candidateOptions,

      details:
        `Multiple TMDB television candidates remain similarly plausible. Confidence gap: ${confidenceGap}.`,
    });
  }

  if (
    input.episodeAirDate !==
      null &&
    input.apparentYear ===
      null
  ) {
    if (
      strongExactTitles.length >
      1 &&
      confidenceGap <
        15
    ) {
      return reviewResult({
        input,

        candidateOptions,

        details:
          "Multiple exact-title TMDB series remain plausible for this date-based television release.",
      });
    }
  }

  return createMatchedResult({
    input,

    evaluation:
      best,

    confidence:
      best.confidence,

    seasonNumber:
      input.seasonNumber,

    episodeNumber:
      input.episodeNumber,

    episodeTitle:
      best.episode
        ?.name ??
      null,

    episodeAirDate:
      best.episode
        ?.air_date ??
      input.episodeAirDate,

    candidateOptions,

    detailsText:
      best.episode
        ? `Matched "${input.seriesTitle}" to TMDB TV ${best.candidate.id} "${best.candidate.name}" and confirmed S${String(
            input.seasonNumber,
          ).padStart(
            2,
            "0",
          )}E${String(
            input.episodeNumber,
          ).padStart(
            2,
            "0",
          )}.`
        : `Matched "${input.seriesTitle}" to TMDB TV ${best.candidate.id} "${best.candidate.name}".`,
  });
}