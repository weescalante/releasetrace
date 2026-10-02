export type PredbSignal =
  | "WEB"
  | "BLURAY"
  | "OTHER";

export type PredbSourcePage =
  | "MOVIES"
  | "TV"
  | "UNKNOWN";

export type PredbUnknownContentKind =
  | "MOVIE_CANDIDATE"
  | "TV_CANDIDATE"
  | "IGNORE";

export type PredbMovieRelease = {
  postId: string;

  releaseName: string;

  normalizedTitle: string;

  year: string;

  quality: string;

  signal: PredbSignal;

  category: string;

  publishedAt: string;

  sourceUrl: string;

  sourcePage?: PredbSourcePage;
};

const PREDB_MOVIES_URL =
  "https://predb.me/?cats=movies";

const PREDB_TV_URL =
  "https://predb.me/?cats=tv";

const PREDB_UNKNOWN_URL =
  "https://predb.me/?cats=unknown";

const PREDB_BASE_URL =
  "https://predb.me";

function decodeHtmlEntities(
  value: string,
) {
  return String(
    value ?? "",
  )
    .replace(
      /&#039;/gi,
      "'",
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&apos;/gi,
      "'",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&#(\d+);/g,
      (
        _match,
        code,
      ) =>
        String.fromCharCode(
          Number(
            code,
          ),
        ),
    )
    .trim();
}

function stripHtml(
  value: string,
) {
  return decodeHtmlEntities(
    value.replace(
      /<[^>]*>/g,
      " ",
    ),
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeReleaseTitle(
  value: string,
) {
  return decodeHtmlEntities(
    value,
  )
    .replace(
      /[._]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .replace(
      /\s+-\s*$/,
      "",
    )
    .trim();
}

function normalizeForClassification(
  value: string,
) {
  return decodeHtmlEntities(
    value,
  )
    .replace(
      /[._-]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function extractYear(
  releaseName: string,
) {
  const matches = [
    ...releaseName.matchAll(
      /(?:^|[.\s_(])((?:19|20)\d{2})(?=$|[.\s_)])/g,
    ),
  ];

  if (
    matches.length ===
    0
  ) {
    return "Unknown";
  }

  return (
    matches[
      matches.length -
        1
    ][1] ??
    "Unknown"
  );
}

function extractTitle(
  releaseName: string,
  year: string,
) {
  if (
    year !==
    "Unknown"
  ) {
    const yearPattern =
      new RegExp(
        `(?:^|[._\\s(])${year}(?=$|[._\\s)])`,
        "i",
      );

    const match =
      yearPattern.exec(
        releaseName,
      );

    if (
      match &&
      typeof match.index ===
        "number"
    ) {
      const beforeYear =
        releaseName.slice(
          0,
          match.index,
        );

      const cleaned =
        normalizeReleaseTitle(
          beforeYear,
        );

      if (cleaned) {
        return cleaned;
      }
    }
  }

  const technicalMarker =
    /(?:^|[._\s])(?:480p|576p|720p|1080p|2160p|4k|uhd|hdr|dv|web(?:[._-]?dl|rip)?|bluray|blu[._-]?ray|bdrip|remux)(?:$|[._\s])/i;

  const technicalMatch =
    technicalMarker.exec(
      releaseName,
    );

  const titlePart =
    technicalMatch &&
    typeof technicalMatch.index ===
      "number"
      ? releaseName.slice(
          0,
          technicalMatch.index,
        )
      : releaseName;

  return normalizeReleaseTitle(
    titlePart,
  );
}

function getTechnicalSuffix(
  releaseName: string,
  year: string,
) {
  if (
    year ===
    "Unknown"
  ) {
    return releaseName;
  }

  const yearPattern =
    new RegExp(
      `(?:^|[._\\s(])${year}(?=$|[._\\s)])`,
      "i",
    );

  const match =
    yearPattern.exec(
      releaseName,
    );

  if (
    !match ||
    typeof match.index !==
      "number"
  ) {
    return releaseName;
  }

  return releaseName.slice(
    match.index +
      match[0].length,
  );
}

export function classifyPredbRelease(
  releaseName: string,
): PredbSignal {
  const year =
    extractYear(
      releaseName,
    );

  const suffix =
    getTechnicalSuffix(
      releaseName,
      year,
    );

  const normalized =
    suffix
      .replace(
        /[._-]+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .toUpperCase();

  if (
    /\bBLU\s*RAY\b/.test(
      normalized,
    ) ||
    /\bBLURAY\b/.test(
      normalized,
    ) ||
    /\bBDRIP\b/.test(
      normalized,
    ) ||
    /\bBDREMUX\b/.test(
      normalized,
    ) ||
    /\bBD25\b/.test(
      normalized,
    ) ||
    /\bBD50\b/.test(
      normalized,
    )
  ) {
    return "BLURAY";
  }

  if (
    /\bWEB\b/.test(
      normalized,
    ) ||
    /\bWEB\s*DL\b/.test(
      normalized,
    ) ||
    /\bWEBDL\b/.test(
      normalized,
    ) ||
    /\bWEBRIP\b/.test(
      normalized,
    )
  ) {
    return "WEB";
  }

  return "OTHER";
}

function getQuality(
  releaseName: string,
  signal: PredbSignal,
) {
  const normalized =
    releaseName
      .replace(
        /[._]+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      );

  const resolution =
    normalized.match(
      /\b(?:480p|576p|720p|1080p|2160p|4K)\b/i,
    )?.[0];

  if (
    signal ===
    "WEB"
  ) {
    const source =
      normalized.match(
        /\b(?:WEB[\s-]?DL|WEBDL|WEBRIP|WEB)\b/i,
      )?.[0] ??
      "WEB";

    return [
      resolution,
      source,
    ]
      .filter(
        Boolean,
      )
      .join(
        " ",
      );
  }

  if (
    signal ===
    "BLURAY"
  ) {
    let source =
      "Blu-ray";

    if (
      /\bBDRIP\b/i.test(
        normalized,
      )
    ) {
      source =
        "BDRip";
    } else if (
      /\bBDREMUX\b/i.test(
        normalized,
      ) ||
      /\bREMUX\b/i.test(
        normalized,
      )
    ) {
      source =
        "Blu-ray Remux";
    } else if (
      /\bUHD\b/i.test(
        normalized,
      )
    ) {
      source =
        "UHD Blu-ray";
    }

    return [
      resolution,
      source,
    ]
      .filter(
        Boolean,
      )
      .join(
        " ",
      );
  }

  return "Unknown";
}

function parseUtcTimestamp({
  unixTimestamp,
  titleTimestamp,
}: {
  unixTimestamp:
    string | null;

  titleTimestamp:
    string | null;
}) {
  if (
    unixTimestamp &&
    /^\d{9,12}$/.test(
      unixTimestamp,
    )
  ) {
    const parsed =
      new Date(
        Number(
          unixTimestamp,
        ) *
          1000,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed.toISOString();
    }
  }

  if (
    titleTimestamp
  ) {
    const match =
      titleTimestamp.match(
        /(\d{4})-(\d{2})-(\d{2})\s*@\s*(\d{2}):(\d{2}):(\d{2})/i,
      );

    if (match) {
      const parsed =
        new Date(
          Date.UTC(
            Number(
              match[1],
            ),
            Number(
              match[2],
            ) -
              1,
            Number(
              match[3],
            ),
            Number(
              match[4],
            ),
            Number(
              match[5],
            ),
            Number(
              match[6],
            ),
          ),
        );

      return parsed.toISOString();
    }
  }

  return "Unknown";
}

function parsePostBlock(
  postId: string,
  html: string,
  fallbackCategory: string,
  sourcePage: PredbSourcePage,
): PredbMovieRelease | null {
  const titleMatch =
    html.match(
      /class=["']p-title["'][^>]*>([\s\S]*?)<\/a>/i,
    );

  if (!titleMatch) {
    return null;
  }

  const releaseName =
    stripHtml(
      titleMatch[1],
    );

  if (!releaseName) {
    return null;
  }

  const signal =
    classifyPredbRelease(
      releaseName,
    );

  const year =
    extractYear(
      releaseName,
    );

  const normalizedTitle =
    extractTitle(
      releaseName,
      year,
    );

  const timeTag =
    html.match(
      /class=["']p-time["'][^>]*>/i,
    )?.[0] ??
    "";

  const unixTimestamp =
    timeTag.match(
      /\bdata=["'](\d+)["']/i,
    )?.[1] ??
    null;

  const titleTimestamp =
    timeTag.match(
      /\btitle=["']([^"']+)["']/i,
    )?.[1] ??
    null;

  const categoryBlock =
    html.match(
      /class=["'][^"']*\bp-cat\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ??
    "";

  const category =
    stripHtml(
      categoryBlock,
    ) ||
    fallbackCategory;

  return {
    postId,

    releaseName,

    normalizedTitle,

    year,

    quality:
      getQuality(
        releaseName,
        signal,
      ),

    signal,

    category,

    publishedAt:
      parseUtcTimestamp({
        unixTimestamp,

        titleTimestamp,
      }),

    sourceUrl:
      `${PREDB_BASE_URL}/?post=${postId}`,

    sourcePage,
  };
}

function parsePredbHtml(
  html: string,
  fallbackCategory: string,
  sourcePage: PredbSourcePage,
) {
  const parts =
    html.split(
      /<div\s+class=["']post["']\s+id=["']/i,
    );

  const releases:
    PredbMovieRelease[] =
    [];

  for (
    const part of
    parts.slice(1)
  ) {
    const idEnd =
      part.indexOf(
        '"',
      );

    const singleQuoteEnd =
      part.indexOf(
        "'",
      );

    const possibleEnds =
      [
        idEnd,
        singleQuoteEnd,
      ].filter(
        (
          value,
        ) =>
          value >=
          0,
      );

    if (
      possibleEnds.length ===
      0
    ) {
      continue;
    }

    const identifierEnd =
      Math.min(
        ...possibleEnds,
      );

    const postId =
      part
        .slice(
          0,
          identifierEnd,
        )
        .trim();

    if (
      !/^\d+$/.test(
        postId,
      )
    ) {
      continue;
    }

    const release =
      parsePostBlock(
        postId,
        part,
        fallbackCategory,
        sourcePage,
      );

    if (release) {
      releases.push(
        release,
      );
    }
  }

  return releases;
}

export function parsePredbMoviesHtml(
  html: string,
) {
  return parsePredbHtml(
    html,
    "Movies",
    "MOVIES",
  );
}

export function parsePredbTvHtml(
  html: string,
) {
  return parsePredbHtml(
    html,
    "TV",
    "TV",
  );
}

export function parsePredbUnknownHtml(
  html: string,
) {
  return parsePredbHtml(
    html,
    "Unknown",
    "UNKNOWN",
  );
}

function isRelevantSignal(
  release:
    PredbMovieRelease,
) {
  return (
    release.signal ===
      "WEB" ||
    release.signal ===
      "BLURAY"
  );
}

function hasSeasonEpisodePattern(
  releaseName: string,
) {
  const normalized =
    normalizeForClassification(
      releaseName,
    );

  return (
    /\bS\d{1,2}\s*E\d{1,3}\b/i.test(
      normalized,
    ) ||
    /\bS\d{1,2}E\d{1,3}\b/i.test(
      releaseName,
    ) ||
    /\bSEASON\s*\d{1,2}\b/i.test(
      normalized,
    ) ||
    /\bEPISODE\s*\d{1,3}\b/i.test(
      normalized,
    ) ||
    /\bEP\s*\d{1,3}\b/i.test(
      normalized,
    )
  );
}

function hasDatedEpisodePattern(
  releaseName: string,
) {
  return /(?:^|[._\s-])(?:19|20)\d{2}[._\s-](?:0?[1-9]|1[0-2])[._\s-](?:0?[1-9]|[12]\d|3[01])(?:$|[._\s-])/i.test(
    releaseName,
  );
}

export function isLikelyPredbSportsRelease(
  releaseName: string,
) {
  const normalized =
    normalizeForClassification(
      releaseName,
    );

  const hasFullDate =
    hasDatedEpisodePattern(
      releaseName,
    );

  const hasSportsOrganization =
    /\b(?:UEFA|FIFA|MOTOGP|MOTO2|MOTO3|NASCAR|INDYCAR|ATP|WTA|PGA)\b/i.test(
      normalized,
    );

  const hasRaceSession =
    /\b(?:FREE\s+PRACTICE|PRACTICE|QUALIFYING|SPRINT\s+RACE|SPRINT\s+SHOOTOUT|RACE\s+SESSION|WARM\s+UP)\b/i.test(
      normalized,
    );

  const hasFormulaOne =
    /\bFORMULA\s*1\b/i.test(
      normalized,
    ) ||
    /\bFORMULA1\b/i.test(
      releaseName,
    ) ||
    /\bF1\b/i.test(
      normalized,
    );

  const hasGrandPrix =
    /\bGRAND\s+PRIX\b/i.test(
      normalized,
    );

  if (
    hasFormulaOne &&
    (
      hasGrandPrix ||
      hasRaceSession ||
      hasFullDate
    )
  ) {
    return true;
  }

  if (
    hasSportsOrganization &&
    (
      hasFullDate ||
      hasRaceSession
    )
  ) {
    return true;
  }

  if (
    /\bUEFA\b/i.test(
      normalized,
    ) &&
    /\bCHAMPIONS\s+LEAGUE\b/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /\b(?:MOTOGP|MOTO2|MOTO3)\b/i.test(
      normalized,
    ) &&
    hasRaceSession
  ) {
    return true;
  }

  return false;
}

export function isLikelyPredbTvRelease(
  releaseName: string,
) {
  if (
    isLikelyPredbSportsRelease(
      releaseName,
    )
  ) {
    return false;
  }

  return (
    hasSeasonEpisodePattern(
      releaseName,
    ) ||
    hasDatedEpisodePattern(
      releaseName,
    )
  );
}

export function classifyPredbUnknownContent(
  releaseName: string,
): PredbUnknownContentKind {
  if (
    isLikelyPredbSportsRelease(
      releaseName,
    )
  ) {
    return "IGNORE";
  }

  if (
    isLikelyPredbTvRelease(
      releaseName,
    )
  ) {
    return "TV_CANDIDATE";
  }

  return "MOVIE_CANDIDATE";
}

function sortNewestFirst(
  releases:
    PredbMovieRelease[],
) {
  return [
    ...releases,
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        new Date(
          a.publishedAt,
        ).getTime();

      const bTime =
        new Date(
          b.publishedAt,
        ).getTime();

      if (
        Number.isNaN(
          aTime,
        ) &&
        Number.isNaN(
          bTime,
        )
      ) {
        return 0;
      }

      if (
        Number.isNaN(
          aTime,
        )
      ) {
        return 1;
      }

      if (
        Number.isNaN(
          bTime,
        )
      ) {
        return -1;
      }

      return (
        bTime -
        aTime
      );
    },
  );
}

function mergeByPostId(
  groups:
    PredbMovieRelease[][],
) {
  const merged =
    new Map<
      string,
      PredbMovieRelease
    >();

  for (
    const group of
    groups
  ) {
    for (
      const release of
      group
    ) {
      if (
        !merged.has(
          release.postId,
        )
      ) {
        merged.set(
          release.postId,
          release,
        );
      }
    }
  }

  return sortNewestFirst(
    [
      ...merged.values(),
    ],
  );
}

async function fetchPredbPage({
  url,
  label,
  fallbackCategory,
  sourcePage,
}: {
  url: string;

  label: string;

  fallbackCategory: string;

  sourcePage: PredbSourcePage;
}) {
  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "WatchLeaks/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },

        cache:
          "no-store",
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `PreDB ${label} request failed with status ${response.status}.`,
    );
  }

  const html =
    await response.text();

  return parsePredbHtml(
    html,
    fallbackCategory,
    sourcePage,
  );
}

async function getPredbMoviesPageReleases() {
  return fetchPredbPage({
    url:
      PREDB_MOVIES_URL,

    label:
      "Movies",

    fallbackCategory:
      "Movies",

    sourcePage:
      "MOVIES",
  });
}

async function getPredbTvPageReleases() {
  return fetchPredbPage({
    url:
      PREDB_TV_URL,

    label:
      "TV",

    fallbackCategory:
      "TV",

    sourcePage:
      "TV",
  });
}

export async function getPredbUnknownReleases() {
  /*
   * The Unknown page is supplemental.
   *
   * PreDB may occasionally refuse or fail
   * this category independently of the main
   * Movies/TV pages (for example 403/503).
   *
   * A failure here must therefore NOT abort
   * movie or TV ingestion. We log the issue
   * and continue with the primary category
   * pages only.
   */
  try {
    const releases =
      await fetchPredbPage({
        url:
          PREDB_UNKNOWN_URL,

        label:
          "Unknown",

        fallbackCategory:
          "Unknown",

        sourcePage:
          "UNKNOWN",
      });

    return sortNewestFirst(
      releases.filter(
        isRelevantSignal,
      ),
    );
  } catch (error) {
    console.warn(
      "PreDB Unknown supplemental source unavailable; continuing without it:",
      error,
    );

    return [];
  }
}

export async function getPredbMovieReleases() {
  const [
    moviePage,
    unknownPage,
  ] =
    await Promise.all([
      getPredbMoviesPageReleases(),
      getPredbUnknownReleases(),
    ]);

  const movieReleases =
    moviePage.filter(
      isRelevantSignal,
    );

  const unknownMovieCandidates =
    unknownPage.filter(
      (
        release,
      ) =>
        classifyPredbUnknownContent(
          release.releaseName,
        ) ===
        "MOVIE_CANDIDATE",
    );

  return mergeByPostId([
    movieReleases,
    unknownMovieCandidates,
  ]);
}

export async function getPredbTvReleases() {
  const [
    tvPage,
    unknownPage,
  ] =
    await Promise.all([
      getPredbTvPageReleases(),
      getPredbUnknownReleases(),
    ]);

  const tvReleases =
    tvPage.filter(
      isRelevantSignal,
    );

  const unknownTvCandidates =
    unknownPage.filter(
      (
        release,
      ) =>
        classifyPredbUnknownContent(
          release.releaseName,
        ) ===
        "TV_CANDIDATE",
    );

  return mergeByPostId([
    tvReleases,
    unknownTvCandidates,
  ]);
}

export async function getPredbAllRelevantReleases() {
  const [
    moviePage,
    tvPage,
    unknownPage,
  ] =
    await Promise.all([
      getPredbMoviesPageReleases(),
      getPredbTvPageReleases(),
      getPredbUnknownReleases(),
    ]);

  const relevantUnknown =
    unknownPage.filter(
      (
        release,
      ) =>
        classifyPredbUnknownContent(
          release.releaseName,
        ) !==
        "IGNORE",
    );

  return mergeByPostId([
    moviePage.filter(
      isRelevantSignal,
    ),

    tvPage.filter(
      isRelevantSignal,
    ),

    relevantUnknown,
  ]);
}

export async function getPredbWebReleases() {
  const releases =
    await getPredbMovieReleases();

  return sortNewestFirst(
    releases.filter(
      (
        release,
      ) =>
        release.signal ===
        "WEB",
    ),
  );
}