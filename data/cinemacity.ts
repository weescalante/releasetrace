import { XMLParser } from "fast-xml-parser";

import {
  saveCloudDetection,
} from "../lib/cloudDatabase";

import {
  verifyMovieMatchWithAI,
  type AiMatchCandidate,
} from "../lib/aiMatchVerifier";

import {
  recordFeedFailure,
  recordFeedSuccess,
} from "../lib/feedStatus";

import {
  approveRelatedMatchReviews,
  saveMatchReview,
  type MatchReviewCandidate,
  type MatchReviewReason,
} from "../lib/matchReviews";

import {
  shouldExcludeMovieByCountry,
} from "../lib/titleEligibility";

export type Signal =
  | "CAM"
  | "WEB"
  | "OTHER";

export type ReleaseRegion =
  | "US"
  | "CA";

export type CinemaCityMovie = {
  title: string;
  normalizedTitle: string;

  tmdbId: number | null;
  posterPath: string | null;

  theatricalReleaseDate: string | null;
  theatricalReleaseRegion: ReleaseRegion | null;

  digitalReleaseDate: string | null;
  digitalReleaseRegion: ReleaseRegion | null;

  physicalReleaseDate: string | null;
  physicalReleaseRegion: ReleaseRegion | null;

  tmdbReleaseDate: string | null;
  tmdbReleaseRegion: ReleaseRegion | null;

  quality: string;
  signal: Signal;

  year: string;
  country: string;
  publishedAt: string;

  // Internal only.
  sourceUrl: string;
};

type TmdbSearchCandidate = {
  id: number;

  title: string;
  original_title?: string;

  overview?: string;

  poster_path: string | null;

  release_date?: string;

  original_language?: string;

  origin_country?: string[];
};

type TmdbSearchResponse = {
  results: TmdbSearchCandidate[];
};

type TmdbMovieDetails = {
  id: number;

  title: string;

  original_title?: string;

  release_date?: string;

  overview?: string;

  original_language?: string;

  origin_country?: string[];

  runtime?: number | null;

  imdb_id?: string | null;

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
    iso_3166_1: string;

    release_dates: {
      release_date: string;
      type: number;
    }[];
  }[];
};

type ReleaseMatch = {
  date: string;
  region: ReleaseRegion;
};

type TmdbMatch = {
  id: number;

  matchedTitle: string;
  matchedYear: string | null;

  confidence: number;

  posterPath: string | null;

  theatricalReleaseDate: string | null;
  theatricalReleaseRegion: ReleaseRegion | null;

  digitalReleaseDate: string | null;
  digitalReleaseRegion: ReleaseRegion | null;

  physicalReleaseDate: string | null;
  physicalReleaseRegion: ReleaseRegion | null;
};

type TmdbCandidateScore = {
  candidate: TmdbSearchCandidate;

  candidateYear: string | null;

  titleSimilarity: number;
  descriptionSimilarity: number;

  exactTitle: boolean;

  confidence: number;
};

type TmdbLookupResult = {
  match: TmdbMatch | null;

  reviewReason: MatchReviewReason | null;

  candidateTmdbId: number | null;

  candidateTitle: string | null;

  candidateYear: string | null;

  confidence: number | null;

  candidateOptions?:
    MatchReviewCandidate[];

  details: string | null;
};

type RawFeedItem = {
  title?: unknown;

  quality?: unknown;

  year?: unknown;

  country?: unknown;

  pubDate?: unknown;

  link?: unknown;

  description?: unknown;

  genre?: unknown;

  audioLanguage?: unknown;

  subtitleLanguage?: unknown;
};

type SourceMatchEvidence = {
  sourceTitle: string;

  normalizedTitle: string;

  year: string;

  description: string;

  country: string;

  genres: string;

  audioLanguage: string;

  signal:
    | "CAM"
    | "WEB";

  quality: string;
};

type AiFallbackResult = {
  selectedCandidate:
    TmdbSearchCandidate | null;

  confidence:
    number | null;

  details:
    string | null;
};

const FEED_SOURCE =
  "CinemaCity";

const TITLE_MATCH_THRESHOLD =
  0.78;

const AMBIGUITY_GAP =
  6;

/*
 * Description remains our deterministic
 * semantic tie-breaker.
 *
 * Gemini is invoked only after this normal
 * matching layer cannot safely decide.
 */
const DESCRIPTION_MATCH_THRESHOLD =
  0.82;

const DESCRIPTION_AMBIGUITY_GAP =
  0.2;

/*
 * Gemini must be extremely confident before
 * it is allowed to automatically choose a
 * TMDB identity.
 *
 * Anything below this goes to Admin Review.
 */
const AI_AUTO_MATCH_CONFIDENCE =
  95;

/*
 * Limit how many TMDB records we send to
 * Gemini.
 *
 * This:
 *
 * - keeps requests small
 * - keeps free-tier usage low
 * - prevents irrelevant long candidate lists
 */
const AI_MAX_CANDIDATES =
  6;

function decodeHtmlEntities(
  value: string,
) {
  return value
    .replace(
      /&#039;/g,
      "'",
    )
    .replace(
      /&#39;/g,
      "'",
    )
    .replace(
      /&quot;/g,
      '"',
    )
    .replace(
      /&amp;/g,
      "&",
    )
    .replace(
      /&lt;/g,
      "<",
    )
    .replace(
      /&gt;/g,
      ">",
    );
}

export function normalizeTitle(
  title: string,
): string {
  const primaryTitle =
    title
      .split("/")[0]
      .trim();

  return primaryTitle
    .replace(
      /\s*\(\d{4}\)\s*$/,
      "",
    )
    .trim();
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
  /*
   * If either side has no reliable year,
   * we cannot apply this particular guard.
   */
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

  const difference =
    Math.abs(
      Number(
        sourceYear,
      ) -
        Number(
          candidateYear,
        ),
    );

  /*
   * Festival / first-release / wider
   * distribution metadata may differ by one
   * year.
   *
   * Gemini cannot automatically override a
   * larger year discrepancy.
   */
  return (
    difference <=
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
): TmdbCandidateScore {
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

function splitCommaList(
  value: string,
) {
  return value
    .split(",")
    .map(
      (item) =>
        item.trim(),
    )
    .filter(
      Boolean,
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

function isPotentiallyRelevantReviewYear(
  year: string,

  publishedAt: string,
) {
  if (
    !/^\d{4}$/.test(
      year,
    )
  ) {
    return true;
  }

  const parsedPublishedAt =
    new Date(
      publishedAt,
    );

  const referenceDate =
    Number.isNaN(
      parsedPublishedAt
        .getTime(),
    )
      ? new Date()
      : parsedPublishedAt;

  const earliest =
    new Date(
      referenceDate,
    );

  earliest.setUTCDate(
    earliest.getUTCDate() -
      120,
  );

  const latest =
    new Date(
      referenceDate,
    );

  latest.setUTCDate(
    latest.getUTCDate() +
      30,
  );

  const sourceYear =
    Number(
      year,
    );

  return (
    sourceYear >=
      earliest
        .getUTCFullYear() &&
    sourceYear <=
      latest
        .getUTCFullYear()
  );
}

export function classifyQuality(
  quality: string,
): Signal {
  const normalizedQuality =
    quality.toUpperCase();

  if (
    normalizedQuality.includes(
      "CAM",
    ) ||
    normalizedQuality.includes(
      "TS",
    ) ||
    normalizedQuality.includes(
      "TELESYNC",
    )
  ) {
    return "CAM";
  }

  if (
    normalizedQuality.includes(
      "WEB",
    ) ||
    normalizedQuality.includes(
      "WEBDL",
    ) ||
    normalizedQuality.includes(
      "WEB-DL",
    ) ||
    normalizedQuality.includes(
      "WEBRIP",
    )
  ) {
    return "WEB";
  }

  return "OTHER";
}

export function isRecentRelease(
  releaseDate:
    string | null,
): boolean {
  if (
    !releaseDate
  ) {
    return false;
  }

  const release =
    new Date(
      releaseDate,
    );

  const today =
    new Date();

  const daysDifference =
    (
      today.getTime() -
      release.getTime()
    ) /
    (
      1000 *
      60 *
      60 *
      24
    );

  return (
    daysDifference >=
      -30 &&
    daysDifference <=
      120
  );
}

function getTmdbToken() {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (
    !token
  ) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  return token;
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

    if (
      !region
    ) {
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
  score: TmdbCandidateScore,

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

async function buildMatchReviewCandidateOption(
  score: TmdbCandidateScore,

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

async function buildMatchReviewCandidateOptions(
  scoredCandidates:
    TmdbCandidateScore[],

  sourceYear: string,
): Promise<
  MatchReviewCandidate[]
> {
  /*
   * For AMBIGUOUS reviews, show only
   * candidates that passed the normal
   * title-similarity threshold.
   *
   * TITLE_MISMATCH reviews may have no
   * candidate above that threshold, so in
   * that case preserve the best TMDB search
   * results for human inspection.
   */
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
      await buildMatchReviewCandidateOption(
        score,

        sourceYear,
      );

    if (
      shouldExcludeMovieByCountry({
        originCountries:
          option
            .originCountries,
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

async function tryAiMatchFallback({
  evidence,

  candidates,
}: {
  evidence:
    SourceMatchEvidence;

  candidates:
    TmdbSearchCandidate[];
}): Promise<
  AiFallbackResult
> {
  /*
   * AI is optional.
   *
   * If the API key is not configured,
   * ingestion falls back to the normal
   * Match Review workflow instead of
   * failing.
   */
  if (
    !process.env
      .GEMINI_API_KEY
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

  if (
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

    /*
     * Retrieve richer TMDB metadata only
     * for candidates that actually require
     * AI disambiguation.
     *
     * Country eligibility is checked here
     * before Gemini sees the candidate.
     *
     * That prevents an India-origin or
     * India-production TMDB record from
     * being selected automatically.
     */
    const eligibleCandidates: {
      source:
        TmdbSearchCandidate;

      ai:
        AiMatchCandidate;
    }[] =
      [];

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

    const aiCandidates =
      eligibleCandidates.map(
        (
          candidate,
        ) =>
          candidate.ai,
      );

    if (
      aiCandidates.length ===
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
          evidence.sourceTitle,

        normalizedTitle:
          evidence
            .normalizedTitle,

        year:
          /^\d{4}$/.test(
            evidence.year,
          )
            ? evidence.year
            : null,

        description:
          evidence
            .description
            .trim()
            ? evidence.description
            : null,

        country:
          evidence.country ===
          "Unknown"
            ? null
            : evidence.country,

        genres:
          splitCommaList(
            evidence.genres,
          ),

        audioLanguage:
          evidence
            .audioLanguage
            .trim()
            ? evidence
                .audioLanguage
            : null,

        detectionType:
          evidence.signal,

        quality:
          evidence.quality ===
          "Unknown"
            ? null
            : evidence.quality,

        candidates:
          aiCandidates,
      });

    const diagnostic =
      `Gemini ${aiResult.decision} at ${aiResult.confidence}% confidence: ${aiResult.reason}`;

    /*
     * Gemini is advisory unless ALL
     * automatic-match conditions pass.
     */
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

    if (
      !aiResult
        .selectedCandidate
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

    /*
     * Safety guard #1:
     *
     * Gemini may select only a TMDB ID that
     * our own TMDB search actually supplied.
     */
    const selectedCandidate =
      eligibleCandidates.find(
        (
          candidate,
        ) =>
          candidate.source.id ===
          aiResult
            .selectedCandidate
            ?.tmdbId,
      )
        ?.source;

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

    /*
     * Safety guard #2:
     *
     * A large source/TMDB year discrepancy
     * cannot be automatically overridden by
     * AI.
     */
    const selectedCandidateYear =
      getCandidateYear(
        selectedCandidate,
      );

    if (
      !isAiCandidateYearAcceptable(
        evidence.year,

        selectedCandidateYear,
      )
    ) {
      return {
        selectedCandidate:
          null,

        confidence:
          aiResult.confidence,

        details:
          `${diagnostic} Automatic match was blocked because the selected candidate year differs too far from the CinemaCity year.`,
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
    /*
     * Gemini failure must NEVER take down
     * CinemaCity ingestion.
     *
     * The item simply falls back to manual
     * review.
     */
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
        error instanceof
        Error
          ? `Gemini verification was unavailable: ${error.message}`
          : "Gemini verification was unavailable.",
    };
  }
}

function buildCandidateDetails(
  score:
    TmdbCandidateScore,
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
          score
            .descriptionSimilarity *
            100,
        )}%`
      : "";

  return `"${title}" (${year}), confidence ${score.confidence}%${description}`;
}

function buildAmbiguousResult(
  best:
    TmdbCandidateScore,

  second:
    TmdbCandidateScore | null,

  details:
    string,
): TmdbLookupResult {
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

/*
 * Description is still allowed to solve
 * an ambiguity before AI is called.
 */
function chooseByDescription(
  candidates:
    TmdbCandidateScore[],
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

  if (
    !best
  ) {
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
  title: string,

  year: string,

  candidates:
    TmdbCandidateScore[],
): {
  chosen:
    TmdbCandidateScore | null;

  review:
    TmdbLookupResult | null;
} {
  const plausible =
    candidates.filter(
      (candidate) =>
        candidate
          .titleSimilarity >=
        TITLE_MATCH_THRESHOLD,
    );

  if (
    plausible.length ===
    0
  ) {
    const best =
      candidates[0];

    if (
      !best
    ) {
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
          `Best TMDB candidate does not match the CinemaCity title closely enough: ${buildCandidateDetails(
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
    /*
     * PRIORITY 1:
     *
     * Exact title + exact year.
     */
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

            `Multiple exact-title TMDB records share the CinemaCity year ${year}, and the available description does not distinguish them strongly enough.`,
          ),
      };
    }

    /*
     * PRIORITY 2:
     *
     * Same-year candidates.
     */
    const sameYear =
      plausible
        .filter(
          (candidate) =>
            candidate
              .candidateYear ===
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

            `Multiple plausible TMDB candidates share the reported year ${year}.`,
          ),
      };
    }

    /*
     * PRIORITY 3:
     *
     * Exact title but adjacent year.
     */
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

            const difference =
              getYearDifference(
                year,

                candidate
                  .candidateYear,
              );

            return (
              difference ===
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
      const descriptionWinner =
        chooseByDescription(
          adjacentExactTitle,
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
        adjacentExactTitle[0];

      const second =
        adjacentExactTitle[1];

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

            `Multiple exact-title TMDB candidates fall within one year of CinemaCity's reported year ${year}.`,
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
            ? `The title looks plausible, but TMDB does not provide enough year information to verify it against CinemaCity year ${year}.`
            : `The closest TMDB candidate differs from CinemaCity year ${year} by ${difference} years.`,
        ),
    };
  }

  /*
   * No reliable CinemaCity year.
   */
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

        "CinemaCity did not provide a reliable year and multiple TMDB candidates remain plausible.",
      ),
  };
}

async function fetchReleaseDatesForCandidate(
  candidate:
    TmdbSearchCandidate,

  confidence:
    number,
): Promise<
  TmdbLookupResult
> {
  const token =
    getTmdbToken();

  /*
   * Final eligibility guard before a
   * verified TMDB identity can become
   * a Watch Leaks detection.
   *
   * Search results normally expose
   * origin_country, but movie details
   * also expose production countries.
   *
   * We check both so India-origin or
   * India-production films cannot slip
   * through when source metadata is
   * incomplete.
   */
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

      details:
        `TMDB movie ${candidate.id} was excluded by country eligibility.`,
    };
  }

  const releaseResponse =
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

  if (
    !releaseResponse.ok
  ) {
    console.error(
      `TMDB release-date lookup failed for ${candidate.title} with status ${releaseResponse.status}.`,
    );

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

      details:
        `TMDB release-date request failed with status ${releaseResponse.status}.`,
    };
  }

  const releaseData:
    TmdbReleaseDatesResponse =
    await releaseResponse.json();

  /*
   * TMDB release types:
   *
   * 2 = Theatrical (Limited)
   * 3 = Theatrical
   * 4 = Digital
   * 5 = Physical
   */
  const theatricalRelease =
    firstReleaseForType(
      releaseData,
      3,
    ) ??
    firstReleaseForType(
      releaseData,
      2,
    );

  const digitalRelease =
    firstReleaseForType(
      releaseData,
      4,
    );

  const physicalRelease =
    firstReleaseForType(
      releaseData,
      5,
    );

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
      null,
  };
}

async function findTmdbMovie({
  sourceTitle,

  normalizedTitle,

  year,

  description,

  country,

  genres,

  audioLanguage,

  signal,

  quality,
}: SourceMatchEvidence): Promise<
  TmdbLookupResult
> {
  try {
    const validYear =
      /^\d{4}$/.test(
        year,
      )
        ? year
        : null;

    /*
     * First search with the reported year.
     */
    const yearCandidates =
      await searchTmdbCandidates(
        normalizedTitle,

        validYear,
      );

    /*
     * Also search broadly.
     *
     * This allows:
     *
     * - alternate release years
     * - translated/localized metadata
     * - broader candidate discovery
     */
    const broadCandidates =
      validYear
        ? await searchTmdbCandidates(
            normalizedTitle,

            null,
          )
        : [];

    const discoveredCandidates =
      dedupeCandidates([
        ...yearCandidates,
        ...broadCandidates,
      ]);

    /*
     * TMDB search results normally expose
     * origin_country.
     *
     * Remove clearly excluded candidates
     * before deterministic matching,
     * Gemini, or Match Review.
     */
    const candidates =
      discoveredCandidates.filter(
        (
          candidate,
        ) =>
          !shouldExcludeMovieByCountry({
            originCountries:
              candidate
                .origin_country ??
              null,
          }),
      );

    /*
     * If TMDB found candidates but every
     * one of them is excluded, this is not
     * an unmatched-title problem and should
     * not create Admin Review noise.
     */
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

    const scoredCandidates =
      candidates
        .map(
          (
            candidate,
          ) =>
            calculateCandidateScore(
              normalizedTitle,

              year,

              description,

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

    /*
     * Step 1:
     *
     * Let deterministic matching decide
     * first.
     */
    const selection =
      chooseCandidate(
        normalizedTitle,

        year,

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

    /*
     * Step 2:
     *
     * If deterministic matching cannot
     * safely decide, Gemini gets one chance
     * to resolve the identity.
     */
    if (
      selection.review
    ) {
      const aiFallback =
        await tryAiMatchFallback({
          evidence: {
            sourceTitle,

            normalizedTitle,

            year,

            description,

            country,

            genres,

            audioLanguage,

            signal,

            quality,
          },

          candidates:
            scoredCandidates.map(
              (score) =>
                score.candidate,
            ),
        });

      /*
       * High-confidence Gemini match:
       *
       * continue through the exact same
       * release-date/detection pipeline as
       * a deterministic match.
       */
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
        /*
         * Gemini did not meet our automatic
         * threshold.
         *
         * Keep the item in Match Review and
         * attach Gemini's reasoning to the
         * diagnostic.
         *
         * Preserve the plausible TMDB
         * candidates as well so Admin can
         * present the exact human choice.
         */
        const candidateOptions =
          await buildMatchReviewCandidateOptions(
            scoredCandidates,

            year,
          );

        /*
         * Rich TMDB details may reveal that
         * every remaining candidate is from
         * an excluded country.
         *
         * In that case, suppress the review
         * entirely instead of asking Admin
         * to inspect a title we do not want
         * in Watch Leaks.
         */
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

        details:
          `No verified TMDB movie identity was selected for "${normalizedTitle}".`,
      };
    }

    /*
     * Step 3:
     *
     * AI never creates release metadata.
     *
     * Release dates still come directly
     * from TMDB.
     */
    return await fetchReleaseDatesForCandidate(
      selectedCandidate,

      selectedConfidence ??
        100,
    );
  } catch (error) {
    console.error(
      "TMDB movie lookup failed:",
      error,
    );

    /*
     * Network/configuration failures are
     * not title-match failures.
     */
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

      details:
        error instanceof
        Error
          ? error.message
          : "Unknown TMDB lookup error.",
    };
  }
}

function getRelevantRelease(
  signal: Signal,

  tmdbMatch:
    TmdbMatch | null,
): ReleaseMatch | null {
  if (
    !tmdbMatch
  ) {
    return null;
  }

  if (
    signal ===
      "CAM" &&
    tmdbMatch
      .theatricalReleaseDate &&
    tmdbMatch
      .theatricalReleaseRegion
  ) {
    return {
      date:
        tmdbMatch
          .theatricalReleaseDate,

      region:
        tmdbMatch
          .theatricalReleaseRegion,
    };
  }

  if (
    signal ===
      "WEB" &&
    tmdbMatch
      .digitalReleaseDate &&
    tmdbMatch
      .digitalReleaseRegion
  ) {
    return {
      date:
        tmdbMatch
          .digitalReleaseDate,

      region:
        tmdbMatch
          .digitalReleaseRegion,
    };
  }

  return null;
}

function getLatestFeedItem(
  items:
    RawFeedItem[],
) {
  let latestTimestamp =
    Number.NEGATIVE_INFINITY;

  let latestTitle:
    string | null =
    null;

  let latestPublishedAt:
    string | null =
    null;

  items.forEach(
    (item) => {
      const publishedAt =
        String(
          item.pubDate ??
            "",
        ).trim();

      if (
        !publishedAt
      ) {
        return;
      }

      const parsedDate =
        new Date(
          publishedAt,
        );

      const timestamp =
        parsedDate
          .getTime();

      if (
        Number.isNaN(
          timestamp,
        )
      ) {
        return;
      }

      if (
        timestamp >
        latestTimestamp
      ) {
        latestTimestamp =
          timestamp;

        latestPublishedAt =
          parsedDate
            .toISOString();

        latestTitle =
          decodeHtmlEntities(
            String(
              item.title ??
                "Unknown title",
            ),
          );
      }
    },
  );

  return {
    title:
      latestTitle,

    publishedAt:
      latestPublishedAt,
  };
}

async function recordSuccessSafely({
  checkedAt,

  latestItemPublishedAt,

  latestItemTitle,

  itemCount,
}: {
  checkedAt: string;

  latestItemPublishedAt:
    string | null;

  latestItemTitle:
    string | null;

  itemCount: number;
}) {
  try {
    await recordFeedSuccess({
      source:
        FEED_SOURCE,

      checkedAt,

      latestItemPublishedAt,

      latestItemTitle,

      itemCount,
    });
  } catch (error) {
    console.error(
      "CinemaCity feed status could not be saved:",
      error,
    );
  }
}

async function recordFailureSafely({
  checkedAt,

  error,
}: {
  checkedAt:
    string;

  error:
    string;
}) {
  try {
    await recordFeedFailure({
      source:
        FEED_SOURCE,

      checkedAt,

      error,
    });
  } catch (
    statusError
  ) {
    console.error(
      "CinemaCity feed failure status could not be saved:",
      statusError,
    );
  }
}

async function saveReviewSafely({
  sourceUrl,

  sourceTitle,

  normalizedTitle,

  year,

  quality,

  signal,

  publishedAt,

  sourceDescription,

  sourceCountry,

  sourceGenres,

  sourceAudioLanguage,

  sourceSubtitleLanguage,

  reason,

  candidateTmdbId,

  candidateTitle,

  candidateYear,

  confidence,

  candidateOptions,

  details,
}: {
  sourceUrl: string;

  sourceTitle: string;

  normalizedTitle: string;

  year: string;

  quality: string;

  signal:
    | "CAM"
    | "WEB";

  publishedAt: string;

  sourceDescription: string;

  sourceCountry: string;

  sourceGenres: string;

  sourceAudioLanguage: string;

  sourceSubtitleLanguage: string;

  reason:
    MatchReviewReason;

  candidateTmdbId:
    number | null;

  candidateTitle:
    string | null;

  candidateYear:
    string | null;

  confidence:
    number | null;

  candidateOptions:
    MatchReviewCandidate[];

  details:
    string | null;
}) {
  try {
    await saveMatchReview({
      source:
        FEED_SOURCE,

      sourceUrl,

      sourceTitle,

      normalizedTitle,

      year:
        year ===
        "Unknown"
          ? null
          : year,

      quality:
        quality ===
        "Unknown"
          ? null
          : quality,

      detectionType:
        signal,

      publishedAt:
        publishedAt ===
        "Unknown"
          ? null
          : publishedAt,

      sourceDescription:
        sourceDescription.trim()
          ? sourceDescription
          : null,

      sourceCountry:
        sourceCountry ===
        "Unknown"
          ? null
          : sourceCountry,

      sourceGenres:
        sourceGenres.trim()
          ? sourceGenres
          : null,

      sourceAudioLanguage:
        sourceAudioLanguage.trim()
          ? sourceAudioLanguage
          : null,

      sourceSubtitleLanguage:
        sourceSubtitleLanguage.trim()
          ? sourceSubtitleLanguage
          : null,

      reason,

      candidateTmdbId,

      candidateTitle,

      candidateYear,

      confidence,

      candidateOptions,

      details,
    });
  } catch (error) {
    console.error(
      "CinemaCity match review could not be saved:",
      error,
    );
  }
}

function createEmptyMovie({
  title,

  normalizedTitle,

  quality,

  signal,

  year,

  country,

  publishedAt,

  sourceUrl,
}: {
  title: string;

  normalizedTitle: string;

  quality: string;

  signal: Signal;

  year: string;

  country: string;

  publishedAt: string;

  sourceUrl: string;
}): CinemaCityMovie {
  return {
    title,

    normalizedTitle,

    tmdbId:
      null,

    posterPath:
      null,

    theatricalReleaseDate:
      null,

    theatricalReleaseRegion:
      null,

    digitalReleaseDate:
      null,

    digitalReleaseRegion:
      null,

    physicalReleaseDate:
      null,

    physicalReleaseRegion:
      null,

    tmdbReleaseDate:
      null,

    tmdbReleaseRegion:
      null,

    quality,

    signal,

    year,

    country,

    publishedAt,

    sourceUrl,
  };
}

export async function getCinemaCityMovies(): Promise<
  CinemaCityMovie[]
> {
  const feedUrl =
    "https://cinemacity.cc/movies/rss.xml";

  let feedLoaded =
    false;

  try {
    const response =
      await fetch(
        feedUrl,
        {
          headers: {
            "User-Agent":
              "WatchLeaks/1.0",
          },

          cache:
            "no-store",
        },
      );

    if (
      !response.ok
    ) {
      const checkedAt =
        new Date()
          .toISOString();

      await recordFailureSafely({
        checkedAt,

        error:
          `RSS request failed with status ${response.status}.`,
      });

      return [];
    }

    const feedText =
      await response.text();

    const parser =
      new XMLParser();

    const parsedFeed =
      parser.parse(
        feedText,
      );

    const rawItems =
      parsedFeed
        ?.rss
        ?.channel
        ?.item ??
      [];

    const items:
      RawFeedItem[] =
      Array.isArray(
        rawItems,
      )
        ? rawItems
        : [
            rawItems,
          ];

    feedLoaded =
      true;

    const latestFeedItem =
      getLatestFeedItem(
        items,
      );

    await recordSuccessSafely({
      checkedAt:
        new Date()
          .toISOString(),

      latestItemPublishedAt:
        latestFeedItem
          .publishedAt,

      latestItemTitle:
        latestFeedItem
          .title,

      itemCount:
        items.length,
    });

    const movies =
      await Promise.all(
        items.map(
          async (
            item,
          ) => {
            /*
             * Decode entities before title
             * matching.
             *
             * Example:
             *
             * &#039;
             *
             * becomes:
             *
             * '
             */
            const title =
              decodeHtmlEntities(
                String(
                  item.title ??
                    "Unknown title",
                ),
              );

            const normalizedTitle =
              normalizeTitle(
                title,
              );

            const quality =
              String(
                item.quality ??
                  "Unknown",
              );

            const year =
              String(
                item.year ??
                  "Unknown",
              );

            const country =
              decodeHtmlEntities(
                String(
                  item.country ??
                    "Unknown",
                ),
              );

            const publishedAt =
              String(
                item.pubDate ??
                  "Unknown",
              );

            const sourceUrl =
              String(
                item.link ??
                  "",
              );

            const description =
              decodeHtmlEntities(
                String(
                  item.description ??
                    "",
                ),
              ).trim();

            const genres =
              decodeHtmlEntities(
                String(
                  item.genre ??
                    "",
                ),
              ).trim();

            const audioLanguage =
              decodeHtmlEntities(
                String(
                  item.audioLanguage ??
                    "",
                ),
              ).trim();

            const subtitleLanguage =
              decodeHtmlEntities(
                String(
                  item.subtitleLanguage ??
                    "",
                ),
              ).trim();

            const signal =
              classifyQuality(
                quality,
              );

            const emptyMovie =
              createEmptyMovie({
                title,

                normalizedTitle,

                quality,

                signal,

                year,

                country,

                publishedAt,

                sourceUrl,
              });

            /*
             * Not a CAM or WEB event.
             */
            if (
              signal ===
              "OTHER"
            ) {
              return emptyMovie;
            }

            /*
             * Country eligibility:
             *
             * CinemaCity already supplies
             * country metadata for many
             * entries.
             *
             * Reject excluded source titles
             * immediately so we do not spend
             * TMDB/Gemini work on them and
             * they never enter Match Review.
             */
            if (
              shouldExcludeMovieByCountry({
                sourceCountry:
                  country,
              })
            ) {
              return emptyMovie;
            }

            /*
             * Ignore obviously historical
             * entries that cannot be relevant
             * to the current Watch Leaks
             * operational window.
             */
            if (
              !isPotentiallyRelevantReviewYear(
                year,

                publishedAt,
              )
            ) {
              return emptyMovie;
            }

            const lookup =
              await findTmdbMovie({
                sourceTitle:
                  title,

                normalizedTitle,

                year,

                description,

                country,

                genres,

                audioLanguage,

                signal,

                quality,
              });

            /*
             * If deterministic matching AND
             * Gemini could not safely verify
             * the identity, send it to Admin.
             */
            if (
              lookup.reviewReason
            ) {
              await saveReviewSafely({
                sourceUrl,

                sourceTitle:
                  title,

                normalizedTitle,

                year,

                quality,

                signal,

                publishedAt,

                sourceDescription:
                  description,

                sourceCountry:
                  country,

                sourceGenres:
                  genres,

                sourceAudioLanguage:
                  audioLanguage,

                sourceSubtitleLanguage:
                  subtitleLanguage,

                reason:
                  lookup
                    .reviewReason,

                candidateTmdbId:
                  lookup
                    .candidateTmdbId,

                candidateTitle:
                  lookup
                    .candidateTitle,

                candidateYear:
                  lookup
                    .candidateYear,

                confidence:
                  lookup
                    .confidence,

                candidateOptions:
                  lookup
                    .candidateOptions ??
                  [],

                details:
                  lookup.details,
              });
            }

            const tmdbMatch =
              lookup.match;

            const relevantRelease =
              getRelevantRelease(
                signal,

                tmdbMatch,
              );

            const movie:
              CinemaCityMovie =
              {
                title,

                normalizedTitle,

                tmdbId:
                  tmdbMatch
                    ?.id ??
                  null,

                posterPath:
                  tmdbMatch
                    ?.posterPath ??
                  null,

                theatricalReleaseDate:
                  tmdbMatch
                    ?.theatricalReleaseDate ??
                  null,

                theatricalReleaseRegion:
                  tmdbMatch
                    ?.theatricalReleaseRegion ??
                  null,

                digitalReleaseDate:
                  tmdbMatch
                    ?.digitalReleaseDate ??
                  null,

                digitalReleaseRegion:
                  tmdbMatch
                    ?.digitalReleaseRegion ??
                  null,

                physicalReleaseDate:
                  tmdbMatch
                    ?.physicalReleaseDate ??
                  null,

                physicalReleaseRegion:
                  tmdbMatch
                    ?.physicalReleaseRegion ??
                  null,

                tmdbReleaseDate:
                  relevantRelease
                    ?.date ??
                  null,

                tmdbReleaseRegion:
                  relevantRelease
                    ?.region ??
                  null,

                quality,

                signal,

                year,

                country,

                publishedAt,

                sourceUrl,
              };

            /*
             * Still unresolved:
             *
             * do not create a detection.
             */
            if (
              !tmdbMatch
            ) {
              return movie;
            }

            /*
             * IMPORTANT:
             *
             * Detection truth and official
             * release metadata are separate.
             *
             * A verified CAM/WEB observation
             * remains a detection even if
             * TMDB does not currently expose
             * the official release milestone
             * required for latency.
             */
            await saveCloudDetection({
              tmdbId:
                movie.tmdbId,

              title:
                movie
                  .normalizedTitle,

              year:
                movie.year,

              detectionType:
                movie.signal,

              quality:
                movie.quality,

              detectedAt:
                movie
                  .publishedAt,

              theatricalReleaseDate:
                movie
                  .theatricalReleaseDate,

              theatricalReleaseRegion:
                movie
                  .theatricalReleaseRegion,

              digitalReleaseDate:
                movie
                  .digitalReleaseDate,

              digitalReleaseRegion:
                movie
                  .digitalReleaseRegion,

              physicalReleaseDate:
                movie
                  .physicalReleaseDate,

              physicalReleaseRegion:
                movie
                  .physicalReleaseRegion,

              posterPath:
                movie.posterPath,

              source:
                FEED_SOURCE,

              sourceUrl:
                movie.sourceUrl,
            });

            /*
             * Whether deterministic matching
             * or Gemini verified the identity,
             * a successfully stored detection
             * supersedes related pending
             * reviews.
             */
            await approveRelatedMatchReviews({
              source:
                FEED_SOURCE,

              sourceUrl:
                movie.sourceUrl,

              normalizedTitle:
                movie
                  .normalizedTitle,

              year:
                movie.year ===
                "Unknown"
                  ? null
                  : movie.year,

              detectionType:
                signal,
            });

            return movie;
          },
        ),
      );

    return movies.filter(
      (
        movie,
      ) => {
        if (
          movie.signal ===
          "OTHER"
        ) {
          return false;
        }

        return isRecentRelease(
          movie
            .tmdbReleaseDate,
        );
      },
    );
  } catch (error) {
    console.error(
      "CinemaCity ingestion failed:",
      error,
    );

    /*
     * Only mark CinemaCity RSS itself as
     * failed if fetching/parsing the RSS
     * never succeeded.
     *
     * TMDB, Gemini or database problems must
     * not incorrectly make the feed health
     * indicator say CinemaCity is down.
     */
    if (
      !feedLoaded
    ) {
      const message =
        error instanceof
        Error
          ? error.message
          : "Unknown CinemaCity RSS error.";

      await recordFailureSafely({
        checkedAt:
          new Date()
            .toISOString(),

        error:
          message,
      });
    }

    return [];
  }
}