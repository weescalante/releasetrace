import {
  normalizeBluRayTitle,
  type BluRayComFormat,
  type BluRayComRelease,
} from "../data/blurayCom";

export type BluRayComMatchInput = {
  title: string;

  year:
    string | null;

  quality:
    string | null;
};

export type BluRayComMatchMethod =
  | "EXACT_TITLE_YEAR_FORMAT"
  | "EXACT_TITLE_YEAR"
  | "TITLE_VARIATION_YEAR_FORMAT"
  | "TITLE_VARIATION_YEAR"
  | "NO_MATCH";

export type BluRayComMatchResult = {
  matched: boolean;

  method:
    BluRayComMatchMethod;

  inputTitle:
    string;

  normalizedInputTitle:
    string;

  inputYear:
    string | null;

  preferredFormat:
    BluRayComFormat | null;

  officialReleaseDate:
    string | null;

  selectedRelease:
    BluRayComRelease | null;

  candidates:
    BluRayComRelease[];

  details:
    string;
};

function normalizeYear(
  value:
    string | null |
    undefined,
) {
  const normalized =
    String(
      value ?? "",
    ).trim();

  if (
    !/^\d{4}$/.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

function inferPreferredFormat(
  quality:
    string | null,
): BluRayComFormat | null {
  if (!quality) {
    return null;
  }

  const normalized =
    quality.toLowerCase();

  /*
   * PreDB quality examples:
   *
   * 2160p UHD Blu-ray
   * COMPLETE UHD BLURAY
   * 4K Blu-ray
   *
   * These should prefer Blu-ray.com's
   * 4K/UHD edition.
   */
  if (
    normalized.includes(
      "2160",
    ) ||
    normalized.includes(
      "uhd",
    ) ||
    normalized.includes(
      "4k",
    )
  ) {
    return "4K_BLURAY";
  }

  /*
   * Standard Blu-ray-derived releases:
   *
   * 1080p Blu-ray
   * 720p Blu-ray
   * Blu-ray
   * BDRip
   * BRRip
   */
  if (
    normalized.includes(
      "blu",
    ) ||
    normalized.includes(
      "bdrip",
    ) ||
    normalized.includes(
      "brrip",
    )
  ) {
    return "BLURAY";
  }

  return null;
}

function collapseTrailingDuplicateWord(
  value: string,
) {
  const words =
    value
      .split(
        " ",
      )
      .filter(
        Boolean,
      );

  if (
    words.length <
    2
  ) {
    return value;
  }

  /*
   * PreDB sometimes repeats part of a title
   * immediately before the technical tokens.
   *
   * Example:
   *
   * Batman.Knightfall.Part.1.Knightfall.2026...
   *
   * TMDB therefore gives us:
   *
   * Batman Knightfall Part 1 Knightfall
   *
   * while Blu-ray.com correctly stores:
   *
   * Batman Knightfall Part 1
   *
   * If the final word already appeared in
   * the title, remove that trailing duplicate.
   */
  const lastWord =
    words[
      words.length -
      1
    ];

  const appearedEarlier =
    words
      .slice(
        0,
        -1,
      )
      .includes(
        lastWord,
      );

  if (
    !appearedEarlier
  ) {
    return value;
  }

  return words
    .slice(
      0,
      -1,
    )
    .join(
      " ",
    );
}

function normalizeForMatching(
  value:
    string | null |
    undefined,
) {
  const normalized =
    normalizeBluRayTitle(
      value,
    );

  return collapseTrailingDuplicateWord(
    normalized,
  );
}

function titlesMatchExactly(
  inputTitle: string,
  candidateTitle: string,
) {
  return (
    normalizeForMatching(
      inputTitle,
    ) ===
    normalizeForMatching(
      candidateTitle,
    )
  );
}

function titlesMatchAsVariation(
  inputTitle: string,
  candidateTitle: string,
) {
  const input =
    normalizeForMatching(
      inputTitle,
    );

  const candidate =
    normalizeForMatching(
      candidateTitle,
    );

  if (
    !input ||
    !candidate
  ) {
    return false;
  }

  if (
    input ===
    candidate
  ) {
    return true;
  }

  const inputWords =
    input.split(
      " ",
    );

  const candidateWords =
    candidate.split(
      " ",
    );

  /*
   * Do not use loose containment for very
   * short titles such as:
   *
   * It
   * Up
   * Run
   *
   * That would create dangerous matches.
   */
  if (
    inputWords.length <
      3 ||
    candidateWords.length <
      3
  ) {
    return false;
  }

  if (
    input.startsWith(
      `${candidate} `,
    ) ||
    candidate.startsWith(
      `${input} `,
    )
  ) {
    return true;
  }

  /*
   * Compare token overlap conservatively.
   *
   * Every word in the shorter title must
   * occur in the longer title, and the
   * shorter title must contain at least
   * three meaningful tokens.
   */
  const shorter =
    inputWords.length <=
    candidateWords.length
      ? inputWords
      : candidateWords;

  const longer =
    inputWords.length >
    candidateWords.length
      ? inputWords
      : candidateWords;

  const longerSet =
    new Set(
      longer,
    );

  const overlap =
    shorter.filter(
      (
        word,
      ) =>
        longerSet.has(
          word,
        ),
    );

  return (
    shorter.length >=
      3 &&
    overlap.length ===
      shorter.length
  );
}

function yearMatches(
  inputYear:
    string | null,
  candidateYear:
    string | null,
) {
  /*
   * If one side has no usable year,
   * title matching may still proceed.
   *
   * If both have years, they must agree.
   */
  if (
    !inputYear ||
    !candidateYear
  ) {
    return true;
  }

  return (
    inputYear ===
    candidateYear
  );
}

function compareReleaseDates(
  a:
    BluRayComRelease,
  b:
    BluRayComRelease,
) {
  if (
    !a.releaseDateIso &&
    !b.releaseDateIso
  ) {
    return (
      a.productId -
      b.productId
    );
  }

  if (
    !a.releaseDateIso
  ) {
    return 1;
  }

  if (
    !b.releaseDateIso
  ) {
    return -1;
  }

  const aTime =
    new Date(
      `${a.releaseDateIso}T12:00:00Z`,
    ).getTime();

  const bTime =
    new Date(
      `${b.releaseDateIso}T12:00:00Z`,
    ).getTime();

  if (
    aTime !==
    bTime
  ) {
    return (
      aTime -
      bTime
    );
  }

  return (
    a.productId -
    b.productId
  );
}

function selectPreferredRelease({
  candidates,
  preferredFormat,
}: {
  candidates:
    BluRayComRelease[];

  preferredFormat:
    BluRayComFormat | null;
}) {
  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  let pool =
    candidates;

  if (
    preferredFormat
  ) {
    const formatMatches =
      candidates.filter(
        (
          candidate,
        ) =>
          candidate.format ===
          preferredFormat,
      );

    if (
      formatMatches.length >
      0
    ) {
      pool =
        formatMatches;
    }
  }

  /*
   * If multiple editions exist, choose the
   * earliest official date for the matching
   * format.
   *
   * This represents the earliest official
   * physical availability for that format.
   */
  return [
    ...pool,
  ].sort(
    compareReleaseDates,
  )[0];
}

function createSuccessResult({
  input,
  normalizedInputTitle,
  preferredFormat,
  candidates,
  method,
}: {
  input:
    BluRayComMatchInput;

  normalizedInputTitle:
    string;

  preferredFormat:
    BluRayComFormat | null;

  candidates:
    BluRayComRelease[];

  method:
    Exclude<
      BluRayComMatchMethod,
      "NO_MATCH"
    >;
}): BluRayComMatchResult {
  const selectedRelease =
    selectPreferredRelease({
      candidates,

      preferredFormat,
    });

  return {
    matched:
      true,

    method,

    inputTitle:
      input.title,

    normalizedInputTitle,

    inputYear:
      normalizeYear(
        input.year,
      ),

    preferredFormat,

    officialReleaseDate:
      selectedRelease
        ?.releaseDateIso ??
      null,

    selectedRelease,

    candidates:
      [
        ...candidates,
      ].sort(
        compareReleaseDates,
      ),

    details:
      selectedRelease
        ? `Matched Blu-ray.com product ${selectedRelease.productId}: "${selectedRelease.title}" with official release date ${selectedRelease.releaseDateIso ?? selectedRelease.releaseDate}.`
        : "Blu-ray.com candidates were found but no preferred release could be selected.",
  };
}

export function matchBluRayComRelease({
  input,
  releases,
}: {
  input:
    BluRayComMatchInput;

  releases:
    BluRayComRelease[];
}): BluRayComMatchResult {
  const normalizedInputTitle =
    normalizeForMatching(
      input.title,
    );

  const inputYear =
    normalizeYear(
      input.year,
    );

  const preferredFormat =
    inferPreferredFormat(
      input.quality,
    );

  /*
   * Stage 1:
   *
   * Exact normalized title + matching year.
   */
  const exactYearCandidates =
    releases.filter(
      (
        candidate,
      ) =>
        titlesMatchExactly(
          input.title,
          candidate.title,
        ) &&
        yearMatches(
          inputYear,
          normalizeYear(
            candidate.movieYear,
          ),
        ),
    );

  if (
    exactYearCandidates.length >
    0
  ) {
    const exactFormatCandidates =
      preferredFormat
        ? exactYearCandidates.filter(
            (
              candidate,
            ) =>
              candidate.format ===
              preferredFormat,
          )
        : [];

    if (
      exactFormatCandidates.length >
      0
    ) {
      return createSuccessResult({
        input,

        normalizedInputTitle,

        preferredFormat,

        candidates:
          exactFormatCandidates,

        method:
          "EXACT_TITLE_YEAR_FORMAT",
      });
    }

    return createSuccessResult({
      input,

      normalizedInputTitle,

      preferredFormat,

      candidates:
        exactYearCandidates,

      method:
        "EXACT_TITLE_YEAR",
    });
  }

  /*
   * Stage 2:
   *
   * Conservative title variation +
   * matching year.
   *
   * This handles real source-title
   * differences such as the repeated
   * trailing "Knightfall" case without
   * enabling broad fuzzy matching.
   */
  const variationCandidates =
    releases.filter(
      (
        candidate,
      ) =>
        titlesMatchAsVariation(
          input.title,
          candidate.title,
        ) &&
        yearMatches(
          inputYear,
          normalizeYear(
            candidate.movieYear,
          ),
        ),
    );

  if (
    variationCandidates.length >
    0
  ) {
    const variationFormatCandidates =
      preferredFormat
        ? variationCandidates.filter(
            (
              candidate,
            ) =>
              candidate.format ===
              preferredFormat,
          )
        : [];

    if (
      variationFormatCandidates.length >
      0
    ) {
      return createSuccessResult({
        input,

        normalizedInputTitle,

        preferredFormat,

        candidates:
          variationFormatCandidates,

        method:
          "TITLE_VARIATION_YEAR_FORMAT",
      });
    }

    return createSuccessResult({
      input,

      normalizedInputTitle,

      preferredFormat,

      candidates:
        variationCandidates,

      method:
        "TITLE_VARIATION_YEAR",
    });
  }

  return {
    matched:
      false,

    method:
      "NO_MATCH",

    inputTitle:
      input.title,

    normalizedInputTitle,

    inputYear,

    preferredFormat,

    officialReleaseDate:
      null,

    selectedRelease:
      null,

    candidates:
      [],

    details:
      "No sufficiently strong Blu-ray.com title/year match was found.",
  };
}