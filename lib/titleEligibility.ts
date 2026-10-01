type ProductionCountry =
  | string
  | {
      iso_3166_1?:
        string | null;

      name?:
        string | null;
    };

type MovieCountryMetadata = {
  /*
   * TMDB commonly supplies ISO codes
   * here, for example:
   *
   * IN
   * US
   * GB
   */
  originCountries?:
    string[] | null;

  /*
   * TMDB movie details supplies
   * production countries as objects.
   */
  productionCountries?:
    ProductionCountry[] | null;

  /*
   * CinemaCity may provide a human-
   * readable country such as:
   *
   * India
   * United States
   * United Kingdom
   */
  sourceCountry?:
    string | null;
};

/*
 * Countries excluded from the
 * Watch Leaks detection pipeline.
 *
 * ISO 3166-1 alpha-2:
 *
 * IN = India
 */
const EXCLUDED_COUNTRY_CODES =
  new Set([
    "IN",
  ]);

/*
 * Human-readable country names that
 * correspond to an excluded country.
 *
 * This is mainly for source metadata
 * from CinemaCity.
 */
const EXCLUDED_COUNTRY_NAMES =
  new Set([
    "INDIA",
  ]);

function normalizeValue(
  value:
    string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  return normalized ||
    null;
}

function normalizeCountryCode(
  value:
    string | null | undefined,
) {
  const normalized =
    normalizeValue(
      value,
    );

  if (!normalized) {
    return null;
  }

  /*
   * TMDB usually gives us "IN".
   *
   * CinemaCity may instead give us
   * the full country name.
   */
  if (
    normalized ===
    "INDIA"
  ) {
    return "IN";
  }

  return normalized;
}

function getProductionCountryCode(
  country:
    ProductionCountry,
) {
  if (
    typeof country ===
    "string"
  ) {
    return normalizeCountryCode(
      country,
    );
  }

  const isoCode =
    normalizeCountryCode(
      country.iso_3166_1,
    );

  if (isoCode) {
    return isoCode;
  }

  return normalizeCountryCode(
    country.name,
  );
}

function getSourceCountryCode(
  sourceCountry:
    string | null | undefined,
) {
  const normalized =
    normalizeValue(
      sourceCountry,
    );

  if (!normalized) {
    return null;
  }

  /*
   * Exact normal case:
   *
   * India
   */
  if (
    EXCLUDED_COUNTRY_NAMES.has(
      normalized,
    )
  ) {
    return "IN";
  }

  /*
   * Also handle source strings such as:
   *
   * India, United States
   * India / UK
   * Country: India
   *
   * We deliberately match the word
   * INDIA rather than the substring "IN"
   * because "IN" appears inside many
   * unrelated country names.
   */
  const countryParts =
    normalized
      .split(
        /[,/|;]+/,
      )
      .map(
        (
          part,
        ) =>
          part.trim(),
      )
      .filter(
        Boolean,
      );

  if (
    countryParts.some(
      (
        part,
      ) =>
        EXCLUDED_COUNTRY_NAMES.has(
          part,
        ),
    )
  ) {
    return "IN";
  }

  if (
    /\bINDIA\b/.test(
      normalized,
    )
  ) {
    return "IN";
  }

  /*
   * This also allows a source to give
   * us the ISO code directly.
   */
  if (
    EXCLUDED_COUNTRY_CODES.has(
      normalized,
    )
  ) {
    return normalized;
  }

  return null;
}

export function getExcludedMovieCountry({
  originCountries,
  productionCountries,
  sourceCountry,
}: MovieCountryMetadata):
  string | null {
  /*
   * First use CinemaCity's own country
   * metadata.
   *
   * This lets us reject obvious Indian
   * titles before wasting TMDB/Gemini
   * work on them.
   */
  const sourceCode =
    getSourceCountryCode(
      sourceCountry,
    );

  if (
    sourceCode &&
    EXCLUDED_COUNTRY_CODES.has(
      sourceCode,
    )
  ) {
    return sourceCode;
  }

  /*
   * Then verify TMDB origin country.
   */
  for (
    const country of
    originCountries ?? []
  ) {
    const code =
      normalizeCountryCode(
        country,
      );

    if (
      code &&
      EXCLUDED_COUNTRY_CODES.has(
        code,
      )
    ) {
      return code;
    }
  }

  /*
   * Finally verify TMDB production
   * countries.
   *
   * This catches a title whose origin
   * metadata is incomplete but whose
   * production metadata identifies India.
   */
  for (
    const country of
    productionCountries ?? []
  ) {
    const code =
      getProductionCountryCode(
        country,
      );

    if (
      code &&
      EXCLUDED_COUNTRY_CODES.has(
        code,
      )
    ) {
      return code;
    }
  }

  return null;
}

export function shouldExcludeMovieByCountry(
  metadata:
    MovieCountryMetadata,
) {
  return (
    getExcludedMovieCountry(
      metadata,
    ) !== null
  );
}