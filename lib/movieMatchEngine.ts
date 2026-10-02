import {
  verifyMovieMatchWithAI,
  type AiMatchCandidate,
} from "./aiMatchVerifier";

import {
  type MatchReviewCandidate,
  type MatchReviewReason,
} from "./matchReviews";

import {
  shouldExcludeMovieByCountry,
} from "./titleEligibility";

export type MovieDetectionType =
  | "CAM"
  | "WEB"
  | "BLURAY";

export type ReleaseRegion =
  | "US"
  | "CA";

export type MovieMatchInput = {
  sourceName: string;

  sourceTitle: string;

  normalizedTitle: string;

  year: string;

  detectionType:
    MovieDetectionType;

  quality: string;

  description?: string | null;

  country?: string | null;

  genres?: string[];

  audioLanguage?: string | null;
};

export type MovieMatch = {
  id: number;

  matchedTitle: string;

  matchedYear:
    string | null;

  confidence: number;

  posterPath:
    string | null;

  theatricalReleaseDate:
    string | null;

  theatricalReleaseRegion:
    ReleaseRegion | null;

  digitalReleaseDate:
    string | null;

  digitalReleaseRegion:
    ReleaseRegion | null;

  physicalReleaseDate:
    string | null;

  physicalReleaseRegion:
    ReleaseRegion | null;
};

export type MovieMatchResult = {
  match:
    MovieMatch | null;

  reviewReason:
    MatchReviewReason | null;

  candidateTmdbId:
    number | null;

  candidateTitle:
    string | null;

  candidateYear:
    string | null;

  confidence:
    number | null;

  candidateOptions?:
    MatchReviewCandidate[];

  details:
    string | null;
};

type TmdbSearchCandidate = {
  id: number;

  title: string;

  original_title?: string;

  overview?: string;

  poster_path:
    string | null;

  release_date?: string;

  original_language?: string;

  origin_country?: string[];
};

type TmdbSearchResponse = {
  results:
    TmdbSearchCandidate[];
};

type TmdbMovieDetails = {
  id: number;

  title: string;

  original_title?: string;

  release_date?: string;

  overview?: string;

  poster_path?: string | null;

  original_language?: string;

  origin_country?: string[];

  runtime?:
    number | null;

  imdb_id?:
    string | null;

  genres?: {
    id: number;

    name: string;
  }[];

  production_countries?: {
    iso_3166_1: string;

    name: string;
  }[];
};

type TmdbReleaseDatesResponse = {
  results: {
    iso_3166_1:
      string;

    release_dates: {
      release_date:
        string;

      type:
        number;
    }[];
  }[];
};

type ReleaseMatch = {
  date: string;

  region:
    ReleaseRegion;
};

type CandidateScore = {
  candidate:
    TmdbSearchCandidate;

  candidateYear:
    string | null;

  titleSimilarity:
    number;

  descriptionSimilarity:
    number;

  exactTitle:
    boolean;

  confidence:
    number;
};

type AiFallbackResult = {
  selectedCandidate:
    TmdbSearchCandidate | null;

  confidence:
    number | null;

  details:
    string | null;
};

const TITLE_MATCH_THRESHOLD =
  0.78;

const AMBIGUITY_GAP =
  6;

const DESCRIPTION_MATCH_THRESHOLD =
  0.82;

const DESCRIPTION_AMBIGUITY_GAP =
  0.2;

const AI_AUTO_MATCH_CONFIDENCE =
  95;

const AI_MAX_CANDIDATES =
  6;

function getTmdbToken() {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  return token;
}

function normalizeComparisonText(
  value: string,
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
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function getTextSimilarity(
  left: string,
  right: string,
) {
  const normalizedLeft =
    normalizeComparisonText(
      left,
    );

  const normalizedRight =
    normalizeComparisonText(
      right,
    );

  if (
    !normalizedLeft ||
    !normalizedRight
  ) {
    return 0;
  }

  if (
    normalizedLeft ===
    normalizedRight
  ) {
    return 1;
  }

  const leftTokens =
    new Set(
      normalizedLeft.split(
        " ",
      ),
    );

  const rightTokens =
    new Set(
      normalizedRight.split(
        " ",
      ),
    );

  const intersection =
    [...leftTokens].filter(
      (token) =>
        rightTokens.has(
          token,
        ),
    ).length;

  const union =
    new Set([
      ...leftTokens,
      ...rightTokens,
    ]).size;

  if (
    union ===
    0
  ) {
    return 0;
  }

  const tokenScore =
    intersection /
    union;

  const shorter =
    normalizedLeft.length <
    normalizedRight.length
      ? normalizedLeft
      : normalizedRight;

  const longer =
    normalizedLeft.length <
    normalizedRight.length
      ? normalizedRight
      : normalizedLeft;

  const containmentScore =
    longer.includes(
      shorter,
    )
      ? shorter.length /
        longer.length
      : 0;

  return Math.max(
    tokenScore,
    containmentScore,
  );
}

function isExactCandidateTitle(
  sourceTitle: string,

  candidate:
    TmdbSearchCandidate,
) {
  const source =
    normalizeComparisonText(
      sourceTitle,
    );

  const translated =
    normalizeComparisonText(
      candidate.title,
    );

  const original =
    candidate.original_title
      ? normalizeComparisonText(
          candidate.original_title,
        )
      : "";

  return (
    source ===
      translated ||
    (
      Boolean(
        original,
      ) &&
      source ===
        original
    )
  );
}

function getCandidateTitleSimilarity(
  sourceTitle: string,

  candidate:
    TmdbSearchCandidate,
) {
  const translatedScore =
    getTextSimilarity(
      sourceTitle,
      candidate.title,
    );

  const originalScore =
    candidate.original_title
      ? getTextSimilarity(
          sourceTitle,
          candidate.original_title,
        )
      : 0;

  return Math.max(
    translatedScore,
    originalScore,
  );
}

function getCandidateDescriptionSimilarity(
  sourceDescription:
    string,

  candidate:
    TmdbSearchCandidate,
) {
  if (
    !sourceDescription.trim() ||
    !candidate.overview?.trim()
  ) {
    return 0;
  }

  return getTextSimilarity(
    sourceDescription,
    candidate.overview,
  );
}

function getCandidateYear(
  candidate:
    TmdbSearchCandidate,
) {
  const date =
    candidate.release_date;

  if (
    !date ||
    !/^\d{4}/.test(
      date,
    )
  ) {
    return null;
  }

  return date.slice(
    0,
    4,
  );
}

function getYearDifference(
  sourceYear: string,

  candidateYear:
    string | null,
) {
  if (
    !/^\d{4}$/.test(
      sourceYear,
    ) ||
    !candidateYear ||
    !/^\d{4}$/.test(
      candidateYear,
    )
  ) {
    return null;
  }

  return Math.abs(
    Number(
      sourceYear,
    ) -
      Number(
        candidateYear,
      ),
  );
}

function isAiCandidateYearAcceptable(
  sourceYear: string,

  candidateYear:
    string | null,
) {
  if (
    !/^\d{4}$/.test(
      sourceYear,
    ) ||
    !candidateYear ||
    !/^\d{4}$/.test(
      candidateYear,
    )
  ) {
    return true;
  }

  return (
    Math.abs(
      Number(
        sourceYear,
      ) -
        Number(
          candidateYear,
        ),
    ) <=
    1
  );
}

function calculateCandidateScore(
  sourceTitle: string,

  sourceYear: string,

  sourceDescription:
    string,

  candidate:
    TmdbSearchCandidate,
): CandidateScore {
  const candidateYear =
    getCandidateYear(
      candidate,
    );

  const titleSimilarity =
    getCandidateTitleSimilarity(
      sourceTitle,
      candidate,
    );

  const descriptionSimilarity =
    getCandidateDescriptionSimilarity(
      sourceDescription,
      candidate,
    );

  const exactTitle =
    isExactCandidateTitle(
      sourceTitle,
      candidate,
    );

  const yearDifference =
    getYearDifference(
      sourceYear,
      candidateYear,
    );

  let yearScore =
    0.5;

  if (
    yearDifference ===
    0
  ) {
    yearScore =
      1;
  } else if (
    yearDifference ===
    1
  ) {
    yearScore =
      0.5;
  } else if (
    yearDifference !==
    null
  ) {
    yearScore =
      0;
  }

  let confidence =
    Math.round(
      (
        titleSimilarity *
          0.85 +
        yearScore *
          0.15
      ) *
        100,
    );

  if (
    exactTitle &&
    yearDifference ===
      0
  ) {
    confidence =
      100;
  }

  return {
    candidate,

    candidateYear,

    titleSimilarity,

    descriptionSimilarity,

    exactTitle,

    confidence,
  };
}

function dedupeCandidates(
  candidates:
    TmdbSearchCandidate[],
) {
  return Array.from(
    new Map(
      candidates.map(
        (
          candidate,
        ) => [
          candidate.id,
          candidate,
        ],
      ),
    ).values(),
  );
}

function combineDetails(
  first:
    string | null,

  second:
    string | null,
) {
  if (
    first &&
    second
  ) {
    return `${first} ${second}`;
  }

  return (
    first ??
    second ??
    null
  );
}

function firstReleaseForType(
  releaseData:
    TmdbReleaseDatesResponse,

  type: number,
): ReleaseMatch | null {
  const preferredRegions:
    ReleaseRegion[] = [
      "US",
      "CA",
    ];

  for (
    const regionCode of
    preferredRegions
  ) {
    const region =
      releaseData.results.find(
        (result) =>
          result.iso_3166_1 ===
          regionCode,
      );

    if (!region) {
      continue;
    }

    const matchingDates =
      region.release_dates
        .filter(
          (release) =>
            release.type ===
            type,
        )
        .map(
          (release) =>
            release.release_date,
        )
        .filter(
          Boolean,
        )
        .sort(
          (
            a,
            b,
          ) =>
            new Date(
              a,
            ).getTime() -
            new Date(
              b,
            ).getTime(),
        );

    if (
      matchingDates.length >
      0
    ) {
      return {
        date:
          matchingDates[0]
            .slice(
              0,
              10,
            ),

        region:
          regionCode,
      };
    }
  }

  return null;
}

async function searchTmdbCandidates(
  title: string,

  year:
    string | null,
): Promise<
  TmdbSearchCandidate[]
> {
  const token =
    getTmdbToken();

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
    year &&
    /^\d{4}$/.test(
      year,
    )
  ) {
    params.set(
      "primary_release_year",
      year,
    );
  }

  const response =
    await fetch(
      `https://api.themoviedb.org/3/search/movie?${params.toString()}`,
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
      `TMDB movie search failed with status ${response.status}.`,
    );
  }

  const data:
    TmdbSearchResponse =
    await response.json();

  return (
    data.results ??
    []
  );
}

async function fetchTmdbMovieDetails(
  tmdbId: number,
): Promise<
  TmdbMovieDetails | null
> {
  try {
    const token =
      getTmdbToken();

    const response =
      await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
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
      TmdbMovieDetails;
  } catch (error) {
    console.error(
      `TMDB detail lookup failed for ${tmdbId}:`,
      error,
    );

    return null;
  }
}

async function buildAiCandidate(
  candidate:
    TmdbSearchCandidate,
): Promise<
  AiMatchCandidate
> {
  const details =
    await fetchTmdbMovieDetails(
      candidate.id,
    );

  const productionCountries =
    details
      ?.production_countries
      ?.map(
        (country) =>
          country.iso_3166_1,
      )
      .filter(
        Boolean,
      ) ??
    [];

  const originCountries =
    Array.from(
      new Set([
        ...(
          details
            ?.origin_country ??
          []
        ),

        ...productionCountries,

        ...(
          candidate
            .origin_country ??
          []
        ),
      ]),
    );

  const releaseDate =
    details
      ?.release_date ??
    candidate
      .release_date ??
    null;

  return {
    tmdbId:
      candidate.id,

    title:
      details?.title ??
      candidate.title,

    originalTitle:
      details
        ?.original_title ??
      candidate
        .original_title ??
      null,

    year:
      releaseDate &&
      /^\d{4}/.test(
        releaseDate,
      )
        ? releaseDate.slice(
            0,
            4,
          )
        : null,

    overview:
      details?.overview ??
      candidate.overview ??
      null,

    originalLanguage:
      details
        ?.original_language ??
      candidate
        .original_language ??
      null,

    originCountries,

    genres:
      details
        ?.genres
        ?.map(
          (genre) =>
            genre.name,
        ) ??
      [],

    runtime:
      details?.runtime ??
      null,

    imdbId:
      details?.imdb_id ??
      null,

    releaseDate,
  };
}

function buildCandidateMatchedSignals(
  score:
    CandidateScore,

  sourceYear: string,
) {
  const signals:
    string[] =
    [];

  if (
    score.exactTitle
  ) {
    signals.push(
      "Exact title",
    );
  } else {
    signals.push(
      `Title ${Math.round(
        score.titleSimilarity *
          100,
      )}%`,
    );
  }

  if (
    /^\d{4}$/.test(
      sourceYear,
    ) &&
    score.candidateYear ===
      sourceYear
  ) {
    signals.push(
      "Exact year",
    );
  } else if (
    score.candidateYear
  ) {
    signals.push(
      `TMDB year ${score.candidateYear}`,
    );
  }

  if (
    score.descriptionSimilarity >
    0
  ) {
    signals.push(
      `Plot ${Math.round(
        score.descriptionSimilarity *
          100,
      )}%`,
    );
  }

  return signals;
}

async function buildReviewCandidate(
  score:
    CandidateScore,

  sourceYear: string,
): Promise<
  MatchReviewCandidate
> {
  const richCandidate =
    await buildAiCandidate(
      score.candidate,
    );

  return {
    tmdbId:
      richCandidate.tmdbId,

    title:
      richCandidate.title,

    originalTitle:
      richCandidate
        .originalTitle,

    year:
      richCandidate.year ??
      score.candidateYear,

    releaseDate:
      richCandidate
        .releaseDate,

    overview:
      richCandidate.overview,

    posterPath:
      score.candidate
        .poster_path ??
      null,

    genres:
      richCandidate.genres,

    originalLanguage:
      richCandidate
        .originalLanguage,

    originCountries:
      richCandidate
        .originCountries,

    runtime:
      richCandidate.runtime,

    imdbId:
      richCandidate.imdbId,

    confidence:
      score.confidence,

    matchedSignals:
      buildCandidateMatchedSignals(
        score,

        sourceYear,
      ),
  };
}

async function buildReviewCandidates(
  scoredCandidates:
    CandidateScore[],

  sourceYear: string,
) {
  const plausibleCandidates =
    scoredCandidates.filter(
      (score) =>
        score.titleSimilarity >=
        TITLE_MATCH_THRESHOLD,
    );

  const candidatePool =
    plausibleCandidates.length >
    0
      ? plausibleCandidates
      : scoredCandidates;

  const limitedCandidates =
    candidatePool.slice(
      0,
      AI_MAX_CANDIDATES,
    );

  const options:
    MatchReviewCandidate[] =
    [];

  for (
    const score of
    limitedCandidates
  ) {
    const option =
      await buildReviewCandidate(
        score,

        sourceYear,
      );

    if (
      shouldExcludeMovieByCountry({
        originCountries:
          option.originCountries,
      })
    ) {
      continue;
    }

    options.push(
      option,
    );
  }

  return options;
}

function buildCandidateDetails(
  score:
    CandidateScore,
) {
  const title =
    score.candidate.title;

  const year =
    score.candidateYear ??
    "year unavailable";

  const description =
    score.descriptionSimilarity >
    0
      ? `, description ${Math.round(
          score.descriptionSimilarity *
            100,
        )}%`
      : "";

  return `"${title}" (${year}), confidence ${score.confidence}%${description}`;
}

function buildAmbiguousResult(
  best:
    CandidateScore,

  second:
    CandidateScore | null,

  details: string,
): MovieMatchResult {
  return {
    match:
      null,

    reviewReason:
      "AMBIGUOUS",

    candidateTmdbId:
      best.candidate.id,

    candidateTitle:
      best.candidate.title,

    candidateYear:
      best.candidateYear,

    confidence:
      best.confidence,

    details:
      second
        ? `${details} Best: ${buildCandidateDetails(
            best,
          )}. Second: ${buildCandidateDetails(
            second,
          )}.`
        : `${details} Best: ${buildCandidateDetails(
            best,
          )}.`,
  };
}

function chooseByDescription(
  candidates:
    CandidateScore[],
) {
  const sorted =
    [...candidates].sort(
      (
        a,
        b,
      ) =>
        b.descriptionSimilarity -
        a.descriptionSimilarity,
    );

  const best =
    sorted[0];

  const second =
    sorted[1];

  if (!best) {
    return null;
  }

  if (
    best.descriptionSimilarity <
    DESCRIPTION_MATCH_THRESHOLD
  ) {
    return null;
  }

  if (
    second &&
    best.descriptionSimilarity -
      second.descriptionSimilarity <
      DESCRIPTION_AMBIGUITY_GAP
  ) {
    return null;
  }

  return best;
}

function chooseCandidate(
  sourceName: string,

  title: string,

  year: string,

  candidates:
    CandidateScore[],
): {
  chosen:
    CandidateScore | null;

  review:
    MovieMatchResult | null;
} {
  const plausible =
    candidates.filter(
      (candidate) =>
        candidate.titleSimilarity >=
        TITLE_MATCH_THRESHOLD,
    );

  if (
    plausible.length ===
    0
  ) {
    const best =
      candidates[0];

    if (!best) {
      return {
        chosen:
          null,

        review: {
          match:
            null,

          reviewReason:
            "UNMATCHED",

          candidateTmdbId:
            null,

          candidateTitle:
            null,

          candidateYear:
            null,

          confidence:
            null,

          candidateOptions:
            [],

          details:
            `TMDB returned no movie candidates for "${title}"${
              /^\d{4}$/.test(
                year,
              )
                ? ` (${year})`
                : ""
            }.`,
        },
      };
    }

    return {
      chosen:
        null,

      review: {
        match:
          null,

        reviewReason:
          "TITLE_MISMATCH",

        candidateTmdbId:
          best.candidate.id,

        candidateTitle:
          best.candidate.title,

        candidateYear:
          best.candidateYear,

        confidence:
          best.confidence,

        details:
          `Best TMDB candidate does not match the ${sourceName} title closely enough: ${buildCandidateDetails(
            best,
          )}.`,
      },
    };
  }

  const hasValidYear =
    /^\d{4}$/.test(
      year,
    );

  if (
    hasValidYear
  ) {
    const exactTitleExactYear =
      plausible.filter(
        (candidate) =>
          candidate.exactTitle &&
          candidate.candidateYear ===
            year,
      );

    if (
      exactTitleExactYear.length ===
      1
    ) {
      return {
        chosen:
          exactTitleExactYear[0],

        review:
          null,
      };
    }

    if (
      exactTitleExactYear.length >
      1
    ) {
      const descriptionWinner =
        chooseByDescription(
          exactTitleExactYear,
        );

      if (
        descriptionWinner
      ) {
        return {
          chosen:
            descriptionWinner,

          review:
            null,
        };
      }

      const sorted =
        [...exactTitleExactYear]
          .sort(
            (
              a,
              b,
            ) =>
              b.descriptionSimilarity -
                a.descriptionSimilarity ||
              b.confidence -
                a.confidence,
          );

      return {
        chosen:
          null,

        review:
          buildAmbiguousResult(
            sorted[0],

            sorted[1] ??
              null,

            `Multiple exact-title TMDB records share ${sourceName}'s reported year ${year}.`,
          ),
      };
    }

    const sameYear =
      plausible
        .filter(
          (candidate) =>
            candidate.candidateYear ===
            year,
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.confidence -
            a.confidence,
        );

    if (
      sameYear.length ===
      1
    ) {
      return {
        chosen:
          sameYear[0],

        review:
          null,
      };
    }

    if (
      sameYear.length >
      1
    ) {
      const descriptionWinner =
        chooseByDescription(
          sameYear,
        );

      if (
        descriptionWinner
      ) {
        return {
          chosen:
            descriptionWinner,

          review:
            null,
        };
      }

      const best =
        sameYear[0];

      const second =
        sameYear[1];

      if (
        best.confidence -
          second.confidence >
        AMBIGUITY_GAP
      ) {
        return {
          chosen:
            best,

          review:
            null,
        };
      }

      return {
        chosen:
          null,

        review:
          buildAmbiguousResult(
            best,

            second,

            `Multiple plausible TMDB candidates share ${sourceName}'s reported year ${year}.`,
          ),
      };
    }

    const adjacentExactTitle =
      plausible
        .filter(
          (
            candidate,
          ) => {
            if (
              !candidate.exactTitle
            ) {
              return false;
            }

            return (
              getYearDifference(
                year,

                candidate.candidateYear,
              ) ===
              1
            );
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

    if (
      adjacentExactTitle.length ===
      1
    ) {
      return {
        chosen:
          adjacentExactTitle[0],

        review:
          null,
      };
    }

    if (
      adjacentExactTitle.length >
      1
    ) {
      const best =
        adjacentExactTitle[0];

      const second =
        adjacentExactTitle[1];

      return {
        chosen:
          null,

        review:
          buildAmbiguousResult(
            best,

            second,

            `Multiple exact-title TMDB candidates fall within one year of ${sourceName}'s reported year ${year}.`,
          ),
      };
    }

    const best =
      plausible[0];

    const difference =
      getYearDifference(
        year,

        best.candidateYear,
      );

    return {
      chosen:
        null,

      review:
        buildAmbiguousResult(
          best,

          plausible[1] ??
            null,

          difference ===
          null
            ? `The title looks plausible, but TMDB does not provide enough year information to verify it against ${sourceName}'s reported year ${year}.`
            : `The closest TMDB candidate differs from ${sourceName}'s reported year ${year} by ${difference} years.`,
        ),
    };
  }

  const exactTitles =
    plausible.filter(
      (candidate) =>
        candidate.exactTitle,
    );

  if (
    exactTitles.length ===
    1
  ) {
    return {
      chosen:
        exactTitles[0],

      review:
        null,
    };
  }

  if (
    exactTitles.length >
    1
  ) {
    const descriptionWinner =
      chooseByDescription(
        exactTitles,
      );

    if (
      descriptionWinner
    ) {
      return {
        chosen:
          descriptionWinner,

        review:
          null,
      };
    }
  }

  const sorted =
    [...plausible].sort(
      (
        a,
        b,
      ) =>
        b.confidence -
        a.confidence,
    );

  const best =
    sorted[0];

  const second =
    sorted[1];

  if (
    !second ||
    best.confidence -
      second.confidence >
      AMBIGUITY_GAP
  ) {
    return {
      chosen:
        best,

      review:
        null,
    };
  }

  return {
    chosen:
      null,

    review:
      buildAmbiguousResult(
        best,

        second,

        `${sourceName} did not provide a reliable year and multiple TMDB candidates remain plausible.`,
      ),
  };
}

async function tryAiFallback(
  input:
    MovieMatchInput,

  candidates:
    TmdbSearchCandidate[],
): Promise<
  AiFallbackResult
> {
  /*
   * The existing AI verifier currently
   * handles CAM/WEB identity evidence.
   *
   * Blu-ray ambiguities safely continue
   * to Admin Review for now rather than
   * forcing an AI decision.
   */
  if (
    input.detectionType ===
    "BLURAY" ||
    !process.env
      .GEMINI_API_KEY ||
    candidates.length ===
      0
  ) {
    return {
      selectedCandidate:
        null,

      confidence:
        null,

      details:
        null,
    };
  }

  try {
    const limitedCandidates =
      candidates.slice(
        0,
        AI_MAX_CANDIDATES,
      );

    const eligibleCandidates: {
      source:
        TmdbSearchCandidate;

      ai:
        AiMatchCandidate;
    }[] = [];

    for (
      const candidate of
      limitedCandidates
    ) {
      const aiCandidate =
        await buildAiCandidate(
          candidate,
        );

      if (
        shouldExcludeMovieByCountry({
          originCountries:
            aiCandidate
              .originCountries,
        })
      ) {
        continue;
      }

      eligibleCandidates.push({
        source:
          candidate,

        ai:
          aiCandidate,
      });
    }

    if (
      eligibleCandidates.length ===
      0
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          null,

        details:
          "All plausible TMDB candidates were excluded by country eligibility.",
      };
    }

    const aiResult =
      await verifyMovieMatchWithAI({
        sourceTitle:
          input.sourceTitle,

        normalizedTitle:
          input.normalizedTitle,

        year:
          /^\d{4}$/.test(
            input.year,
          )
            ? input.year
            : null,

        description:
          input.description?.trim()
            ? input.description
            : null,

        country:
          input.country?.trim()
            ? input.country
            : null,

        genres:
          input.genres ??
          [],

        audioLanguage:
          input.audioLanguage?.trim()
            ? input.audioLanguage
            : null,

        detectionType:
          input.detectionType,

        quality:
          input.quality ||
          null,

        candidates:
          eligibleCandidates.map(
            (candidate) =>
              candidate.ai,
          ),
      });

    const diagnostic =
      `Gemini ${aiResult.decision} at ${aiResult.confidence}% confidence: ${aiResult.reason}`;

    if (
      aiResult.decision !==
      "MATCH"
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          diagnostic,
      };
    }

    if (
      aiResult.confidence <
      AI_AUTO_MATCH_CONFIDENCE
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          `${diagnostic} Automatic match requires at least ${AI_AUTO_MATCH_CONFIDENCE}% confidence.`,
      };
    }

    const selectedTmdbId =
      aiResult
        .selectedCandidate
        ?.tmdbId;

    if (
      !selectedTmdbId
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          `${diagnostic} Gemini did not select a valid supplied candidate.`,
      };
    }

    const selectedCandidate =
      eligibleCandidates.find(
        (candidate) =>
          candidate.source.id ===
          selectedTmdbId,
      )?.source;

    if (
      !selectedCandidate
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          `${diagnostic} The selected TMDB ID was not present in the supplied candidate set.`,
      };
    }

    if (
      !isAiCandidateYearAcceptable(
        input.year,

        getCandidateYear(
          selectedCandidate,
        ),
      )
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          `${diagnostic} Automatic match was blocked because the selected candidate year differs too far from ${input.sourceName}'s reported year.`,
      };
    }

    return {
      selectedCandidate,

      confidence:
        aiResult.confidence,

      details:
        diagnostic,
    };
  } catch (error) {
    console.error(
      "Gemini movie verification failed:",
      error,
    );

    return {
      selectedCandidate:
        null,

      confidence:
        null,

      details:
        error instanceof Error
          ? `Gemini verification was unavailable: ${error.message}`
          : "Gemini verification was unavailable.",
    };
  }
}

async function enrichSelectedCandidate(
  candidate:
    TmdbSearchCandidate,

  confidence:
    number,
): Promise<
  MovieMatchResult
> {
  const movieDetails =
    await fetchTmdbMovieDetails(
      candidate.id,
    );

  if (
    shouldExcludeMovieByCountry({
      originCountries:
        movieDetails
          ?.origin_country ??
        candidate
          .origin_country ??
        null,

      productionCountries:
        movieDetails
          ?.production_countries ??
        null,
    })
  ) {
    return {
      match:
        null,

      reviewReason:
        null,

      candidateTmdbId:
        candidate.id,

      candidateTitle:
        candidate.title,

      candidateYear:
        getCandidateYear(
          candidate,
        ),

      confidence,

      candidateOptions:
        [],

      details:
        `TMDB movie ${candidate.id} was excluded by country eligibility.`,
    };
  }

  const token =
    getTmdbToken();

  const response =
    await fetch(
      `https://api.themoviedb.org/3/movie/${candidate.id}/release_dates`,
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

  let releaseData:
    TmdbReleaseDatesResponse | null =
    null;

  if (
    response.ok
  ) {
    releaseData =
      await response.json();
  } else {
    console.error(
      `TMDB release-date lookup failed for ${candidate.title} with status ${response.status}.`,
    );
  }

  const theatricalRelease =
    releaseData
      ? (
          firstReleaseForType(
            releaseData,
            3,
          ) ??
          firstReleaseForType(
            releaseData,
            2,
          )
        )
      : null;

  const digitalRelease =
    releaseData
      ? firstReleaseForType(
          releaseData,
          4,
        )
      : null;

  const physicalRelease =
    releaseData
      ? firstReleaseForType(
          releaseData,
          5,
        )
      : null;

  return {
    match: {
      id:
        candidate.id,

      matchedTitle:
        candidate.title,

      matchedYear:
        getCandidateYear(
          candidate,
        ),

      confidence,

      posterPath:
        movieDetails
          ?.poster_path ??
        candidate
          .poster_path ??
        null,

      theatricalReleaseDate:
        theatricalRelease
          ?.date ??
        null,

      theatricalReleaseRegion:
        theatricalRelease
          ?.region ??
        null,

      digitalReleaseDate:
        digitalRelease
          ?.date ??
        null,

      digitalReleaseRegion:
        digitalRelease
          ?.region ??
        null,

      physicalReleaseDate:
        physicalRelease
          ?.date ??
        null,

      physicalReleaseRegion:
        physicalRelease
          ?.region ??
        null,
    },

    reviewReason:
      null,

    candidateTmdbId:
      candidate.id,

    candidateTitle:
      candidate.title,

    candidateYear:
      getCandidateYear(
        candidate,
      ),

    confidence,

    details:
      response.ok
        ? null
        : `TMDB identity was verified, but release-date metadata could not be refreshed because TMDB returned status ${response.status}.`,
  };
}

export async function matchMovieSource(
  input:
    MovieMatchInput,
): Promise<
  MovieMatchResult
> {
  try {
    const validYear =
      /^\d{4}$/.test(
        input.year,
      )
        ? input.year
        : null;

    const yearCandidates =
      await searchTmdbCandidates(
        input.normalizedTitle,

        validYear,
      );

    const broadCandidates =
      validYear
        ? await searchTmdbCandidates(
            input.normalizedTitle,

            null,
          )
        : [];

    const discoveredCandidates =
      dedupeCandidates([
        ...yearCandidates,
        ...broadCandidates,
      ]);

    const candidates =
      discoveredCandidates.filter(
        (candidate) =>
          !shouldExcludeMovieByCountry({
            originCountries:
              candidate
                .origin_country ??
              null,
          }),
      );

    if (
      discoveredCandidates.length >
        0 &&
      candidates.length ===
        0
    ) {
      return {
        match:
          null,

        reviewReason:
          null,

        candidateTmdbId:
          null,

        candidateTitle:
          null,

        candidateYear:
          null,

        confidence:
          null,

        candidateOptions:
          [],

        details:
          "All TMDB candidates were excluded by country eligibility.",
      };
    }

    const sourceDescription =
      input.description ??
      "";

    const scoredCandidates =
      candidates
        .map(
          (candidate) =>
            calculateCandidateScore(
              input.normalizedTitle,

              input.year,

              sourceDescription,

              candidate,
            ),
        )
        .sort(
          (
            a,
            b,
          ) => {
            if (
              validYear
            ) {
              const aExactYear =
                a.candidateYear ===
                validYear;

              const bExactYear =
                b.candidateYear ===
                validYear;

              if (
                aExactYear !==
                bExactYear
              ) {
                return aExactYear
                  ? -1
                  : 1;
              }
            }

            if (
              a.exactTitle !==
              b.exactTitle
            ) {
              return a.exactTitle
                ? -1
                : 1;
            }

            return (
              b.confidence -
              a.confidence
            );
          },
        );

    const selection =
      chooseCandidate(
        input.sourceName,

        input.normalizedTitle,

        input.year,

        scoredCandidates,
      );

    let selectedCandidate =
      selection.chosen
        ?.candidate ??
      null;

    let selectedConfidence =
      selection.chosen
        ?.confidence ??
      null;

    if (
      selection.review
    ) {
      const aiFallback =
        await tryAiFallback(
          input,

          scoredCandidates.map(
            (score) =>
              score.candidate,
          ),
        );

      if (
        aiFallback
          .selectedCandidate
      ) {
        selectedCandidate =
          aiFallback
            .selectedCandidate;

        selectedConfidence =
          aiFallback
            .confidence ??
          100;
      } else {
        const candidateOptions =
          await buildReviewCandidates(
            scoredCandidates,

            input.year,
          );

        if (
          candidateOptions.length ===
            0 &&
          scoredCandidates.length >
            0
        ) {
          return {
            match:
              null,

            reviewReason:
              null,

            candidateTmdbId:
              null,

            candidateTitle:
              null,

            candidateYear:
              null,

            confidence:
              null,

            candidateOptions:
              [],

            details:
              "All plausible TMDB candidates were excluded by country eligibility.",
          };
        }

        const primaryCandidate =
          candidateOptions[0];

        return {
          ...selection.review,

          candidateTmdbId:
            primaryCandidate
              ?.tmdbId ??
            selection
              .review
              .candidateTmdbId,

          candidateTitle:
            primaryCandidate
              ?.title ??
            selection
              .review
              .candidateTitle,

          candidateYear:
            primaryCandidate
              ?.year ??
            selection
              .review
              .candidateYear,

          confidence:
            primaryCandidate
              ?.confidence ??
            selection
              .review
              .confidence,

          candidateOptions,

          details:
            combineDetails(
              selection
                .review
                .details,

              aiFallback
                .details,
            ),
        };
      }
    }

    if (
      !selectedCandidate
    ) {
      return {
        match:
          null,

        reviewReason:
          "UNMATCHED",

        candidateTmdbId:
          null,

        candidateTitle:
          null,

        candidateYear:
          null,

        confidence:
          null,

        candidateOptions:
          [],

        details:
          `No verified TMDB movie identity was selected for "${input.normalizedTitle}".`,
      };
    }

    return await enrichSelectedCandidate(
      selectedCandidate,

      selectedConfidence ??
        100,
    );
  } catch (error) {
    console.error(
      "Shared TMDB movie lookup failed:",
      error,
    );

    return {
      match:
        null,

      reviewReason:
        null,

      candidateTmdbId:
        null,

      candidateTitle:
        null,

      candidateYear:
        null,

      confidence:
        null,

      candidateOptions:
        [],

      details:
        error instanceof Error
          ? error.message
          : "Unknown TMDB lookup error.",
    };
  }
}