import {
  GoogleGenAI,
  Type,
} from "@google/genai";

export type AiTvMatchDecision =
  | "MATCH"
  | "REVIEW"
  | "NO_MATCH";

export type AiTvMatchCandidate = {
  tmdbId: number;

  title: string;

  originalTitle?:
    string | null;

  firstAirDate?:
    string | null;

  firstAirYear?:
    number | null;

  originCountries?:
    string[];

  overview?:
    string | null;

  /*
   * These are observations our own matcher
   * may already know about the candidate.
   *
   * Gemini is NOT allowed to invent any of
   * these values.
   */
  seasonNumber?:
    number | null;

  episodeNumber?:
    number | null;

  episodeCheck?:
    string | null;

  episodeTitle?:
    string | null;

  episodeAirDate?:
    string | null;

  deterministicConfidence?:
    number | null;
};

export type AiTvMatchVerificationInput = {
  /*
   * Full source release name when available.
   *
   * Example:
   *
   * Big.Brother.US.S28E41.1080p.WEB.h264-EDITH
   */
  sourceReleaseName?:
    string | null;

  /*
   * Series title extracted by our parser.
   *
   * Example:
   *
   * Big Brother US
   */
  seriesTitle: string;

  /*
   * Any parser-generated title candidates.
   */
  titleCandidates:
    string[];

  apparentYear:
    number | null;

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeAirDate:
    string | null;

  candidates:
    AiTvMatchCandidate[];
};

export type AiTvMatchVerification = {
  decision:
    AiTvMatchDecision;

  selectedCandidate:
    AiTvMatchCandidate | null;

  selectedCandidateIndex:
    number;

  confidence:
    number;

  reason:
    string;

  matchedSignals:
    string[];

  model:
    string;

  usedAi:
    boolean;
};

type GeminiTvMatchResponse = {
  decision:
    AiTvMatchDecision;

  selectedCandidateIndex:
    number;

  confidence:
    number;

  reason:
    string;

  matchedSignals:
    string[];
};

/*
 * Keep TV identity verification on the
 * same Gemini model currently used by the
 * movie verifier.
 */
const MODEL =
  "gemini-3.5-flash-lite";

const VALID_DECISIONS:
  AiTvMatchDecision[] = [
    "MATCH",
    "REVIEW",
    "NO_MATCH",
  ];

const AI_MATCH_CACHE_TTL_MS =
  15 * 60 * 1000;

const AI_MATCH_CACHE_MAX_ENTRIES =
  200;

const AI_REQUEST_MAX_ATTEMPTS =
  3;

type CachedAiTvMatch = {
  selectedTmdbId: number;

  confidence: number;

  reason: string;

  matchedSignals: string[];

  cachedAt: number;
};

const aiMatchCache =
  new Map<
    string,
    CachedAiTvMatch
  >();

function normalizeCacheText(
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
      /\s+/g,
      " ",
    )
    .trim();
}

function buildAiMatchCacheKey(
  input:
    AiTvMatchVerificationInput,
) {
  const titles = [
    input.seriesTitle,

    ...input.titleCandidates,
  ]
    .map(
      normalizeCacheText,
    )
    .filter(Boolean)
    .sort();

  const candidateIds =
    input.candidates
      .map(
        (
          candidate,
        ) =>
          candidate.tmdbId,
      )
      .sort(
        (
          a,
          b,
        ) =>
          a - b,
      );

  return JSON.stringify({
    titles,

    apparentYear:
      input.apparentYear,

    candidateIds,
  });
}

function getCachedAiMatch(
  input:
    AiTvMatchVerificationInput,
): AiTvMatchVerification | null {
  const key =
    buildAiMatchCacheKey(
      input,
    );

  const cached =
    aiMatchCache.get(
      key,
    );

  if (!cached) {
    return null;
  }

  if (
    Date.now() -
      cached.cachedAt >
    AI_MATCH_CACHE_TTL_MS
  ) {
    aiMatchCache.delete(
      key,
    );

    return null;
  }

  const selectedCandidateIndex =
    input.candidates.findIndex(
      (
        candidate,
      ) =>
        candidate.tmdbId ===
        cached.selectedTmdbId,
    );

  if (
    selectedCandidateIndex <
    0
  ) {
    aiMatchCache.delete(
      key,
    );

    return null;
  }

  return {
    decision:
      "MATCH",

    selectedCandidate:
      input.candidates[
        selectedCandidateIndex
      ],

    selectedCandidateIndex,

    confidence:
      cached.confidence,

    reason:
      `${cached.reason} Reused a recent verified semantic identity decision for this same parsed series and supplied TMDB candidate set.`,

    matchedSignals:
      cached.matchedSignals,

    model:
      MODEL,

    usedAi:
      true,
  };
}

function rememberAiMatch({
  input,

  verification,
}: {
  input:
    AiTvMatchVerificationInput;

  verification:
    AiTvMatchVerification;
}) {
  if (
    verification.decision !==
      "MATCH" ||
    !verification.selectedCandidate
  ) {
    return;
  }

  const key =
    buildAiMatchCacheKey(
      input,
    );

  aiMatchCache.set(
    key,
    {
      selectedTmdbId:
        verification
          .selectedCandidate
          .tmdbId,

      confidence:
        verification.confidence,

      reason:
        verification.reason,

      matchedSignals:
        verification.matchedSignals,

      cachedAt:
        Date.now(),
    },
  );

  while (
    aiMatchCache.size >
    AI_MATCH_CACHE_MAX_ENTRIES
  ) {
    const oldestKey =
      aiMatchCache
        .keys()
        .next()
        .value as
        | string
        | undefined;

    if (!oldestKey) {
      break;
    }

    aiMatchCache.delete(
      oldestKey,
    );
  }
}

function getErrorStatus(
  error:
    unknown,
) {
  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return null;
  }

  const candidate =
    error as {
      status?: unknown;

      code?: unknown;

      response?: {
        status?: unknown;
      };
    };

  const possibleValues = [
    candidate.status,

    candidate.code,

    candidate.response
      ?.status,
  ];

  for (
    const value of
    possibleValues
  ) {
    const numeric =
      typeof value ===
        "number"
        ? value
        : typeof value ===
            "string" &&
          /^\d+$/.test(
            value,
          )
          ? Number(
              value,
            )
          : null;

    if (
      numeric !==
      null
    ) {
      return numeric;
    }
  }

  return null;
}

function getErrorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message ===
      "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  return String(
    error,
  );
}

function isTransientAiError(
  error:
    unknown,
) {
  const status =
    getErrorStatus(
      error,
    );

  if (
    status !==
      null &&
    [
      408,
      429,
      500,
      502,
      503,
      504,
    ].includes(
      status,
    )
  ) {
    return true;
  }

  const message =
    getErrorMessage(
      error,
    )
      .toLowerCase();

  return [
    "429",
    "resource_exhausted",
    "rate limit",
    "too many requests",
    "temporarily unavailable",
    "service unavailable",
    "deadline exceeded",
    "timeout",
    "timed out",
    "econnreset",
    "fetch failed",
    "network",
  ].some(
    (
      signal,
    ) =>
      message.includes(
        signal,
      ),
  );
}

async function wait(
  milliseconds:
    number,
) {
  await new Promise<void>(
    (
      resolve,
    ) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function generateTvMatchResponse({
  ai,

  prompt,

  seriesTitle,
}: {
  ai:
    GoogleGenAI;

  prompt:
    string;

  seriesTitle:
    string;
}) {
  let lastError:
    unknown =
      null;

  for (
    let attempt =
      1;
    attempt <=
    AI_REQUEST_MAX_ATTEMPTS;
    attempt +=
      1
  ) {
    try {
      return await ai
        .models
        .generateContent({
          model:
            MODEL,

          contents:
            prompt,

          config: {
            /*
             * Identity verification should be
             * conservative and repeatable.
             */
            temperature:
              0.1,

            maxOutputTokens:
              700,

            responseMimeType:
              "application/json",

            responseSchema: {
              type:
                Type.OBJECT,

              properties: {
                decision: {
                  type:
                    Type.STRING,

                  enum:
                    [
                      "MATCH",
                      "REVIEW",
                      "NO_MATCH",
                    ],
                },

                selectedCandidateIndex: {
                  type:
                    Type.INTEGER,
                },

                confidence: {
                  type:
                    Type.NUMBER,
                },

                reason: {
                  type:
                    Type.STRING,
                },

                matchedSignals: {
                  type:
                    Type.ARRAY,

                  items: {
                    type:
                      Type.STRING,
                  },
                },
              },

              required: [
                "decision",
                "selectedCandidateIndex",
                "confidence",
                "reason",
                "matchedSignals",
              ],
            },
          },
        });
    } catch (error) {
      lastError =
        error;

      const retryable =
        isTransientAiError(
          error,
        );

      if (
        !retryable ||
        attempt >=
          AI_REQUEST_MAX_ATTEMPTS
      ) {
        throw error;
      }

      const delay =
        attempt ===
          1
          ? 750
          : 1500;

      console.warn(
        `TV AI identity verification attempt ${attempt}/${AI_REQUEST_MAX_ATTEMPTS} failed transiently for "${seriesTitle}". Retrying in ${delay}ms. Error: ${getErrorMessage(
          error,
        )}`,
      );

      await wait(
        delay,
      );
    }
  }

  throw (
    lastError instanceof
    Error
      ? lastError
      : new Error(
          "Gemini television match verification failed after retries.",
        )
  );
}

function clampConfidence(
  value: number,
) {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  /*
   * Gemini occasionally expresses confidence
   * as a 0-1 probability even though Watch Leaks
   * stores AI confidence on a 0-100 scale.
   *
   * Normalize that response shape defensively.
   */
  const normalizedValue =
    value > 0 &&
    value <= 1
      ? value * 100
      : value;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        normalizedValue,
      ),
    ),
  );
}

function isValidDecision(
  value: unknown,
): value is AiTvMatchDecision {
  return (
    typeof value ===
      "string" &&
    VALID_DECISIONS.includes(
      value as
        AiTvMatchDecision,
    )
  );
}

function buildPrompt(
  input:
    AiTvMatchVerificationInput,
) {
  const source = {
    releaseName:
      input
        .sourceReleaseName ??
      null,

    seriesTitle:
      input.seriesTitle,

    titleCandidates:
      input.titleCandidates,

    apparentYear:
      input.apparentYear,

    seasonNumber:
      input.seasonNumber,

    episodeNumber:
      input.episodeNumber,

    episodeAirDate:
      input.episodeAirDate,
  };

  const candidates =
    input.candidates.map(
      (
        candidate,
        index,
      ) => ({
        index,

        tmdbId:
          candidate.tmdbId,

        title:
          candidate.title,

        originalTitle:
          candidate
            .originalTitle ??
          null,

        firstAirDate:
          candidate
            .firstAirDate ??
          null,

        firstAirYear:
          candidate
            .firstAirYear ??
          null,

        originCountries:
          candidate
            .originCountries ??
          [],

        overview:
          candidate.overview ??
          null,

        seasonNumber:
          candidate
            .seasonNumber ??
          null,

        episodeNumber:
          candidate
            .episodeNumber ??
          null,

        episodeCheck:
          candidate
            .episodeCheck ??
          null,

        episodeTitle:
          candidate
            .episodeTitle ??
          null,

        episodeAirDate:
          candidate
            .episodeAirDate ??
          null,

        deterministicConfidence:
          candidate
            .deterministicConfidence ??
          null,
      }),
    );

  return `
You are the television-series identity verification layer for Watch Leaks.

Your ONLY task is to determine whether the television series reported by the source corresponds to one of the supplied TMDB television candidates.

You are NOT deciding whether piracy occurred.

You are NOT deciding whether the source is trustworthy.

You are NOT deciding whether an episode actually exists on TMDB.

You are ONLY resolving television-series identity.

IMPORTANT RULES:

1. You may select ONLY one of the supplied candidate indexes.

2. Never invent a television series, candidate, TMDB ID, title, first-air year, country, episode, season, episode title, air date, plot detail, or other metadata.

3. Do not use or invent an unsupplied TMDB candidate.

4. Understand scene-release naming conventions and semantic title variations.

Examples of legitimate title variation may include:

- punctuation differences;
- spacing differences;
- abbreviations;
- translated titles;
- localized titles;
- romanized titles;
- alternate international titles;
- network or regional naming;
- country/version qualifiers such as US, UK, AU, CA or similar labels.

However, a regional suffix must NOT automatically be removed or ignored.

For example, "Show Name US" may refer to the American version of a franchise, but only select a candidate when the supplied evidence makes that identity sufficiently clear.

5. Consider all available evidence together:

- source release name;
- parsed series title;
- parser title candidates;
- apparent year;
- season number;
- episode number;
- source episode air date;
- TMDB candidate title;
- original title;
- first air date/year;
- origin country;
- overview;
- any episode evidence already supplied by our deterministic matcher.

6. Season and episode numbers can be strong contextual clues, but they are NOT proof by themselves.

The application will independently verify the chosen candidate against TMDB after your decision.

7. A source and TMDB may occasionally use different naming conventions for the same series.

Do not reject a candidate solely because one title contains an obvious regional/version qualifier and the other does not.

8. Different television adaptations or regional editions with similar names must NOT automatically be treated as the same series.

Use the other supplied evidence to distinguish them.

9. Do not assume that identical titles necessarily represent the same series.

10. If one supplied candidate is clearly the same television series, return MATCH.

11. Return REVIEW when:

- more than one candidate remains reasonably plausible;
- evidence is incomplete;
- evidence conflicts;
- a regional/version distinction cannot be resolved safely;
- you cannot establish series identity confidently.

12. Return NO_MATCH when the supplied candidates clearly do not represent the source television series.

13. Confidence means confidence in your DECISION, not merely title similarity. Return confidence on a 0-100 scale, where 0 means no confidence and 100 means complete confidence. Never use a 0-1 confidence scale.

14. For MATCH:

selectedCandidateIndex must be the matching supplied candidate index.

15. For REVIEW:

selectedCandidateIndex should be the strongest candidate index if one candidate appears meaningfully stronger.

Use -1 when no supplied candidate can reasonably be preferred.

16. For NO_MATCH:

selectedCandidateIndex must be -1.

17. Be conservative.

A false-positive television identity is worse than sending an item to human review.

18. You are an identity reasoning layer only.

Even when you return MATCH, Watch Leaks will still independently verify season/episode evidence using TMDB before accepting the detection.

SOURCE TELEVISION RELEASE:

${JSON.stringify(
  source,
  null,
  2,
)}

TMDB TELEVISION CANDIDATES:

${JSON.stringify(
  candidates,
  null,
  2,
)}

Return only the requested structured result.
`.trim();
}

function validateGeminiResponse(
  raw:
    GeminiTvMatchResponse,
  candidates:
    AiTvMatchCandidate[],
): AiTvMatchVerification {
  const decision =
    isValidDecision(
      raw.decision,
    )
      ? raw.decision
      : "REVIEW";

  const confidence =
    clampConfidence(
      Number(
        raw.confidence,
      ),
    );

  const reason =
    typeof raw.reason ===
      "string"
      ? raw.reason.trim()
      : "AI verifier returned an invalid explanation.";

  const matchedSignals =
    Array.isArray(
      raw.matchedSignals,
    )
      ? raw.matchedSignals
          .filter(
            (
              signal,
            ): signal is string =>
              typeof signal ===
                "string",
          )
          .map(
            (
              signal,
            ) =>
              signal.trim(),
          )
          .filter(Boolean)
          .slice(
            0,
            12,
          )
      : [];

  const selectedIndex =
    Number.isInteger(
      raw.selectedCandidateIndex,
    )
      ? raw.selectedCandidateIndex
      : -1;

  const validCandidateIndex =
    selectedIndex >=
      0 &&
    selectedIndex <
      candidates.length;

  /*
   * Critical safety guard.
   *
   * Gemini cannot invent or inject a
   * TMDB television ID.
   *
   * It may select only an index belonging
   * to the candidate set OUR CODE supplied.
   */
  if (
    decision ===
      "MATCH" &&
    !validCandidateIndex
  ) {
    return {
      decision:
        "REVIEW",

      selectedCandidate:
        null,

      selectedCandidateIndex:
        -1,

      confidence:
        0,

      reason:
        "AI returned MATCH without selecting a valid supplied TMDB television candidate.",

      matchedSignals,

      model:
        MODEL,

      usedAi:
        true,
    };
  }

  if (
    decision ===
    "NO_MATCH"
  ) {
    return {
      decision,

      selectedCandidate:
        null,

      selectedCandidateIndex:
        -1,

      confidence,

      reason,

      matchedSignals,

      model:
        MODEL,

      usedAi:
        true,
    };
  }

  if (
    decision ===
      "REVIEW" &&
    !validCandidateIndex
  ) {
    return {
      decision,

      selectedCandidate:
        null,

      selectedCandidateIndex:
        -1,

      confidence,

      reason,

      matchedSignals,

      model:
        MODEL,

      usedAi:
        true,
    };
  }

  return {
    decision,

    selectedCandidate:
      candidates[
        selectedIndex
      ] ?? null,

    selectedCandidateIndex:
      selectedIndex,

    confidence,

    reason,

    matchedSignals,

    model:
      MODEL,

    usedAi:
      true,
  };
}

export async function verifyTvMatchWithAI(
  input:
    AiTvMatchVerificationInput,
): Promise<AiTvMatchVerification> {
  /*
   * Do not waste a Gemini request if our
   * own TMDB search produced nothing.
   */
  if (
    input.candidates.length ===
    0
  ) {
    return {
      decision:
        "NO_MATCH",

      selectedCandidate:
        null,

      selectedCandidateIndex:
        -1,

      confidence:
        100,

      reason:
        "No TMDB television candidates were supplied to the AI verifier.",

      matchedSignals:
        [],

      model:
        MODEL,

      usedAi:
        false,
    };
  }

  const apiKey =
    process.env
      .GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured.",
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  const cached =
    getCachedAiMatch(
      input,
    );

  if (cached) {
    return cached;
  }

  const response =
    await generateTvMatchResponse({
      ai,

      prompt:
        buildPrompt(
          input,
        ),

      seriesTitle:
        input.seriesTitle,
    });

  const text =
    response.text;

  if (
    !text ||
    !text.trim()
  ) {
    throw new Error(
      "Gemini returned an empty television match-verification response.",
    );
  }

  let parsed:
    GeminiTvMatchResponse;

  try {
    parsed =
      JSON.parse(
        text,
      ) as
        GeminiTvMatchResponse;
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for the television match-verification response.",
    );
  }

  const verification =
    validateGeminiResponse(
      parsed,
      input.candidates,
    );

  rememberAiMatch({
    input,

    verification,
  });

  return verification;
}