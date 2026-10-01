import type {
  MatchReviewCandidate,
} from "./matchReviews";

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

  overview?: string;

  poster_path:
    string | null;

  release_date?: string;

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
    iso_3166_1:
      string;

    name:
      string;
  }[];
};

export type MatchReviewCandidateSource = {
  normalizedTitle:
    string;

  year:
    string | null;

  sourceDescription?:
    string | null;

  candidateTmdbId?:
    number | null;
};

const TITLE_MATCH_THRESHOLD =
  0.72;

const MAX_CANDIDATES =
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

  const tokenScore =
    union > 0
      ? intersection /
        union
      : 0;

  const shorter =
    normalizedLeft.length <=
    normalizedRight.length
      ? normalizedLeft
      : normalizedRight;

  const longer =
    normalizedLeft.length <=
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

function getCandidateYear(
  candidate:
    TmdbSearchCandidate,
) {
  if (
    !candidate.release_date ||
    !/^\d{4}/.test(
      candidate.release_date,
    )
  ) {
    return null;
  }

  return candidate
    .release_date
    .slice(
      0,
      4,
    );
}

function isExactTitle(
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

function getTitleSimilarity(
  sourceTitle: string,

  candidate:
    TmdbSearchCandidate,
) {
  const translated =
    getTextSimilarity(
      sourceTitle,
      candidate.title,
    );

  const original =
    candidate.original_title
      ? getTextSimilarity(
          sourceTitle,
          candidate.original_title,
        )
      : 0;

  return Math.max(
    translated,
    original,
  );
}

function getDescriptionSimilarity(
  sourceDescription:
    string | null | undefined,

  candidate:
    TmdbSearchCandidate,
) {
  if (
    !sourceDescription?.trim() ||
    !candidate.overview?.trim()
  ) {
    return 0;
  }

  return getTextSimilarity(
    sourceDescription,
    candidate.overview,
  );
}

function getYearDifference(
  sourceYear:
    string | null,

  candidateYear:
    string | null,
) {
  if (
    !sourceYear ||
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

async function searchTmdb({
  title,

  year,
}: {
  title:
    string;

  year:
    string | null;
}) {
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

  if (!response.ok) {
    throw new Error(
      `TMDB candidate search failed with status ${response.status}.`,
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

async function getTmdbDetails(
  tmdbId: number,
): Promise<
  TmdbMovieDetails | null
> {
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

  if (!response.ok) {
    console.error(
      `TMDB candidate detail lookup failed for ${tmdbId} with status ${response.status}.`,
    );

    return null;
  }

  return response.json();
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

function calculateConfidence({
  sourceTitle,

  sourceYear,

  sourceDescription,

  candidate,
}: {
  sourceTitle:
    string;

  sourceYear:
    string | null;

  sourceDescription?:
    string | null;

  candidate:
    TmdbSearchCandidate;
}) {
  const titleSimilarity =
    getTitleSimilarity(
      sourceTitle,

      candidate,
    );

  const candidateYear =
    getCandidateYear(
      candidate,
    );

  const yearDifference =
    getYearDifference(
      sourceYear,

      candidateYear,
    );

  const descriptionSimilarity =
    getDescriptionSimilarity(
      sourceDescription,

      candidate,
    );

  let yearScore =
    0.4;

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
      0.55;
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
          0.7 +
        yearScore *
          0.2 +
        descriptionSimilarity *
          0.1
      ) *
        100,
    );

  if (
    isExactTitle(
      sourceTitle,

      candidate,
    ) &&
    yearDifference ===
      0
  ) {
    confidence =
      100;
  }

  return {
    titleSimilarity,

    descriptionSimilarity,

    candidateYear,

    yearDifference,

    exactTitle:
      isExactTitle(
        sourceTitle,

        candidate,
      ),

    confidence,
  };
}

function getMatchedSignals({
  exactTitle,

  titleSimilarity,

  candidateYear,

  sourceYear,

  descriptionSimilarity,
}: {
  exactTitle:
    boolean;

  titleSimilarity:
    number;

  candidateYear:
    string | null;

  sourceYear:
    string | null;

  descriptionSimilarity:
    number;
}) {
  const signals:
    string[] =
    [];

  if (exactTitle) {
    signals.push(
      "Exact title",
    );
  } else {
    signals.push(
      `Title ${Math.round(
        titleSimilarity *
          100,
      )}%`,
    );
  }

  if (
    sourceYear &&
    candidateYear ===
      sourceYear
  ) {
    signals.push(
      "Exact year",
    );
  } else if (
    candidateYear
  ) {
    signals.push(
      `TMDB year ${candidateYear}`,
    );
  }

  if (
    descriptionSimilarity >
    0
  ) {
    signals.push(
      `Plot ${Math.round(
        descriptionSimilarity *
          100,
      )}%`,
    );
  }

  return signals;
}

export async function getLiveMatchReviewCandidates(
  review:
    MatchReviewCandidateSource,
): Promise<
  MatchReviewCandidate[]
> {
  const sourceYear =
    review.year &&
    /^\d{4}$/.test(
      review.year,
    )
      ? review.year
      : null;

  /*
   * Search TMDB twice:
   *
   * 1. using CinemaCity's reported year
   * 2. broadly without a year
   *
   * The broad search is important because
   * TMDB's release-year metadata may differ
   * from the source by festival/distribution
   * timing.
   */
  const yearResults =
    await searchTmdb({
      title:
        review.normalizedTitle,

      year:
        sourceYear,
    });

  const broadResults =
    sourceYear
      ? await searchTmdb({
          title:
            review.normalizedTitle,

          year:
            null,
        })
      : [];

  const candidates =
    dedupeCandidates([
      ...yearResults,
      ...broadResults,
    ]);

  const scored =
    candidates
      .map(
        (
          candidate,
        ) => {
          const score =
            calculateConfidence({
              sourceTitle:
                review.normalizedTitle,

              sourceYear,

              sourceDescription:
                review.sourceDescription,

              candidate,
            });

          return {
            candidate,

            ...score,
          };
        },
      )
      .filter(
        (
          score,
        ) => {
          /*
           * Always preserve the legacy
           * candidate currently attached to
           * the review, even if its score is
           * weaker under today's matcher.
           */
          if (
            review.candidateTmdbId &&
            score.candidate.id ===
              review.candidateTmdbId
          ) {
            return true;
          }

          /*
           * Otherwise require reasonable
           * title similarity.
           */
          return (
            score.titleSimilarity >=
            TITLE_MATCH_THRESHOLD
          );
        },
      )
      .sort(
        (
          a,
          b,
        ) => {
          /*
           * Exact source year first.
           */
          if (sourceYear) {
            const aExactYear =
              a.candidateYear ===
              sourceYear;

            const bExactYear =
              b.candidateYear ===
              sourceYear;

            if (
              aExactYear !==
              bExactYear
            ) {
              return aExactYear
                ? -1
                : 1;
            }
          }

          /*
           * Exact title next.
           */
          if (
            a.exactTitle !==
            b.exactTitle
          ) {
            return a.exactTitle
              ? -1
              : 1;
          }

          /*
           * Then strongest overall match.
           */
          return (
            b.confidence -
            a.confidence
          );
        },
      )
      .slice(
        0,
        MAX_CANDIDATES,
      );

  const enrichedCandidates:
    MatchReviewCandidate[] =
    [];

  for (
    const score of
    scored
  ) {
    const details =
      await getTmdbDetails(
        score.candidate.id,
      );

    const releaseDate =
      details?.release_date ??
      score.candidate
        .release_date ??
      null;

    const year =
      releaseDate &&
      /^\d{4}/.test(
        releaseDate,
      )
        ? releaseDate.slice(
            0,
            4,
          )
        : score.candidateYear;

    const productionCountries =
      details
        ?.production_countries
        ?.map(
          (
            country,
          ) =>
            country.iso_3166_1,
        )
        .filter(
          Boolean,
        ) ??
      [];

    const originCountries =
      details
        ?.origin_country
        ?.length
        ? details
            .origin_country
        : productionCountries.length >
            0
          ? productionCountries
          : score.candidate
              .origin_country ??
            [];

    enrichedCandidates.push({
      tmdbId:
        score.candidate.id,

      title:
        details?.title ??
        score.candidate.title,

      originalTitle:
        details
          ?.original_title ??
        score.candidate
          .original_title ??
        null,

      year,

      releaseDate,

      overview:
        details?.overview ??
        score.candidate
          .overview ??
        null,

      /*
       * This is the field your current
       * Admin candidate cards were missing
       * on those legacy reviews.
       */
      posterPath:
        details
          ?.poster_path ??
        score.candidate
          .poster_path ??
        null,

      genres:
        details
          ?.genres
          ?.map(
            (
              genre,
            ) =>
              genre.name,
          ) ??
        [],

      originalLanguage:
        details
          ?.original_language ??
        score.candidate
          .original_language ??
        null,

      originCountries,

      runtime:
        details?.runtime ??
        null,

      imdbId:
        details?.imdb_id ??
        null,

      confidence:
        score.confidence,

      matchedSignals:
        getMatchedSignals({
          exactTitle:
            score.exactTitle,

          titleSimilarity:
            score.titleSimilarity,

          candidateYear:
            year,

          sourceYear,

          descriptionSimilarity:
            score.descriptionSimilarity,
        }),
    });
  }

  return enrichedCandidates;
}