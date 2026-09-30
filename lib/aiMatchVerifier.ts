import {
  GoogleGenAI,
  Type,
} from "@google/genai";

export type AiMatchDecision =
  | "MATCH"
  | "REVIEW"
  | "NO_MATCH";

export type AiMatchCandidate = {
  tmdbId: number;

  title: string;

  originalTitle?: string | null;

  year: string | null;

  overview?: string | null;

  originalLanguage?: string | null;

  originCountries?: string[];

  genres?: string[];

  runtime?: number | null;

  imdbId?: string | null;

  releaseDate?: string | null;
};

export type AiMatchVerificationInput = {
  sourceTitle: string;

  normalizedTitle: string;

  year: string | null;

  description?: string | null;

  country?: string | null;

  genres?: string[];

  audioLanguage?: string | null;

  detectionType:
    | "CAM"
    | "WEB";

  quality?: string | null;

  candidates:
    AiMatchCandidate[];
};

export type AiMatchVerification = {
  decision:
    AiMatchDecision;

  selectedCandidate:
    AiMatchCandidate | null;

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

type GeminiMatchResponse = {
  decision:
    AiMatchDecision;

  selectedCandidateIndex:
    number;

  confidence:
    number;

  reason:
    string;

  matchedSignals:
    string[];
};

const MODEL =
  "gemini-3.5-flash-lite";

const VALID_DECISIONS:
  AiMatchDecision[] = [
    "MATCH",
    "REVIEW",
    "NO_MATCH",
  ];

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

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        value,
      ),
    ),
  );
}

function isValidDecision(
  value: unknown,
): value is AiMatchDecision {
  return (
    typeof value ===
      "string" &&
    VALID_DECISIONS.includes(
      value as AiMatchDecision,
    )
  );
}

function buildPrompt(
  input:
    AiMatchVerificationInput,
) {
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
          candidate.originalTitle ??
          null,

        year:
          candidate.year,

        overview:
          candidate.overview ??
          null,

        originalLanguage:
          candidate.originalLanguage ??
          null,

        originCountries:
          candidate.originCountries ??
          [],

        genres:
          candidate.genres ??
          [],

        runtime:
          candidate.runtime ??
          null,

        imdbId:
          candidate.imdbId ??
          null,

        releaseDate:
          candidate.releaseDate ??
          null,
      }),
    );

  const source = {
    title:
      input.sourceTitle,

    normalizedTitle:
      input.normalizedTitle,

    year:
      input.year,

    description:
      input.description ??
      null,

    country:
      input.country ??
      null,

    genres:
      input.genres ??
      [],

    audioLanguage:
      input.audioLanguage ??
      null,

    detectionType:
      input.detectionType,

    quality:
      input.quality ??
      null,
  };

  return `
You are the movie-identity verification layer for Watch Leaks.

Your ONLY task is to determine whether a movie reported by a source corresponds to one of the supplied TMDB movie candidates.

You are NOT deciding whether piracy occurred.
You are NOT deciding whether the source is trustworthy.
You are ONLY matching movie identity.

IMPORTANT RULES:

1. You may select ONLY one of the supplied candidate indexes.

2. Never invent a movie, candidate, TMDB ID, title, year, release date, country, genre, language, runtime, IMDb ID, or plot detail.

3. Do not use an unsupplied candidate.

4. Treat semantic plot similarity as a very strong identity signal.

5. Consider all available signals together:
   - title
   - alternate/original title
   - year
   - plot/overview
   - country
   - language
   - genres
   - runtime
   - release date
   - IMDb ID if supplied

6. Minor title formatting differences, punctuation differences, translated titles, localized titles, romanization differences, and alternate international titles should NOT automatically cause rejection.

7. A one-year date discrepancy can sometimes happen because festival, production, theatrical, and distribution years differ. Do not reject solely because of a one-year difference when stronger identity evidence agrees.

8. Same-title and same-year movies must NOT be treated as the same movie automatically. Use plot, country, genre, language, and other metadata to disambiguate them.

9. If one candidate is clearly the same movie, return MATCH.

10. Return REVIEW when:
    - more than one candidate remains reasonably plausible;
    - evidence is incomplete;
    - evidence conflicts;
    - you cannot establish identity safely.

11. Return NO_MATCH when the supplied candidates clearly do not represent the source movie.

12. Confidence means confidence in your DECISION, not merely title similarity.

13. For MATCH:
    selectedCandidateIndex must be the matching candidate index.

14. For REVIEW:
    selectedCandidateIndex should be the best candidate index if one candidate appears somewhat stronger.
    Use -1 if no candidate can reasonably be preferred.

15. For NO_MATCH:
    selectedCandidateIndex must be -1.

16. Be conservative. A false positive is worse than sending an item to human review.

SOURCE MOVIE:

${JSON.stringify(
  source,
  null,
  2,
)}

TMDB CANDIDATES:

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
    GeminiMatchResponse,
  candidates:
    AiMatchCandidate[],
): AiMatchVerification {
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
            (signal) =>
              signal.trim(),
          )
          .filter(
            Boolean,
          )
          .slice(
            0,
            10,
          )
      : [];

  const selectedIndex =
    Number(
      raw.selectedCandidateIndex,
    );

  const validCandidateIndex =
    Number.isInteger(
      selectedIndex,
    ) &&
    selectedIndex >= 0 &&
    selectedIndex <
      candidates.length;

  /*
   * Critical safety guard:
   *
   * Gemini is never allowed to invent
   * or inject a TMDB ID.
   *
   * It chooses only an index into the
   * candidate list OUR CODE supplied.
   */
  if (
    decision === "MATCH" &&
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
        "AI returned MATCH without selecting a valid supplied TMDB candidate.",

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

export async function verifyMovieMatchWithAI(
  input:
    AiMatchVerificationInput,
): Promise<AiMatchVerification> {
  /*
   * Don't waste an API request when
   * there are no candidates to compare.
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
        "No TMDB candidates were supplied to the AI verifier.",

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

  const response =
    await ai.models.generateContent({
      model:
        MODEL,

      contents:
        buildPrompt(
          input,
        ),

      config: {
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

              enum: [
                "MATCH",
                "REVIEW",
                "NO_MATCH",
              ],

              description:
                "Final identity decision.",
            },

            selectedCandidateIndex:
              {
                type:
                  Type.INTEGER,

                description:
                  "Zero-based index of the selected supplied candidate, or -1 when no candidate should be selected.",
              },

            confidence: {
              type:
                Type.INTEGER,

              description:
                "Confidence in the final decision from 0 through 100.",
            },

            reason: {
              type:
                Type.STRING,

              description:
                "Concise explanation of the identity decision based only on supplied evidence.",
            },

            matchedSignals: {
              type:
                Type.ARRAY,

              items: {
                type:
                  Type.STRING,
              },

              description:
                "Important supplied evidence that influenced the decision.",
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

  const text =
    response.text;

  if (
    !text ||
    !text.trim()
  ) {
    throw new Error(
      "Gemini returned an empty match-verification response.",
    );
  }

  let parsed:
    GeminiMatchResponse;

  try {
    parsed =
      JSON.parse(
        text,
      ) as GeminiMatchResponse;
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for the match-verification response.",
    );
  }

  return validateGeminiResponse(
    parsed,
    input.candidates,
  );
}