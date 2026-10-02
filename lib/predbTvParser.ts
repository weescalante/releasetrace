export type PredbTvParsedRelease = {
  releaseName: string;

  seriesTitle: string;

  titleCandidates: string[];

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeAirDate:
    string | null;

  apparentYear:
    number | null;

  isEpisode:
    boolean;

  isSeasonPack:
    boolean;
};

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
    .trim();
}

function cleanTitle(
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
      /[-]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeCandidate(
  value: string,
) {
  return cleanTitle(
    value,
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function getSeasonEpisode(
  releaseName: string,
) {
  const match =
    releaseName.match(
      /(?:^|[._\s-])S(\d{1,2})E(\d{1,3})(?=$|[._\s-])/i,
    );

  if (!match) {
    return {
      seasonNumber:
        null,

      episodeNumber:
        null,

      index:
        null,
    };
  }

  return {
    seasonNumber:
      Number(
        match[1],
      ),

    episodeNumber:
      Number(
        match[2],
      ),

    index:
      match.index ??
      null,
  };
}

function getSeasonOnly(
  releaseName: string,
) {
  const match =
    releaseName.match(
      /(?:^|[._\s-])S(\d{1,2})(?=$|[._\s-])/i,
    );

  if (!match) {
    return {
      seasonNumber:
        null,

      index:
        null,
    };
  }

  return {
    seasonNumber:
      Number(
        match[1],
      ),

    index:
      match.index ??
      null,
  };
}

function getEpisodeAirDate(
  releaseName: string,
) {
  const match =
    releaseName.match(
      /(?:^|[._\s-])((?:19|20)\d{2})[._\s-](0[1-9]|1[0-2])[._\s-](0[1-9]|[12]\d|3[01])(?=$|[._\s-])/i,
    );

  if (!match) {
    return {
      value:
        null,

      year:
        null,

      index:
        null,
    };
  }

  const year =
    Number(
      match[1],
    );

  const month =
    Number(
      match[2],
    );

  const day =
    Number(
      match[3],
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  /*
   * Reject impossible calendar dates.
   *
   * Example:
   *
   * 2026.02.31
   *
   * should not silently become a March date.
   */
  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return {
      value:
        null,

      year:
        null,

      index:
        null,
    };
  }

  return {
    value:
      `${String(year).padStart(
        4,
        "0",
      )}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}-${String(
        day,
      ).padStart(
        2,
        "0",
      )}`,

    year,

    index:
      match.index ??
      null,
  };
}

function getTechnicalMarkerIndex(
  releaseName: string,
) {
  const match =
    /(?:^|[._\s-])(?:480p|576p|720p|1080p|2160p|4k|uhd|hdr10|hdr|dv|dolby[._\s-]*vision|web(?:[._-]?dl|rip)?|webrip|bluray|blu[._-]?ray|bdrip|remux|h264|h265|x264|x265|hevc|av1)(?=$|[._\s-])/i.exec(
      releaseName,
    );

  return (
    match?.index ??
    null
  );
}

function getEarliestBoundary(
  boundaries:
    Array<
      number | null
    >,
) {
  const usable =
    boundaries.filter(
      (
        value,
      ): value is number =>
        value !==
          null &&
        value >=
          0,
    );

  if (
    usable.length ===
    0
  ) {
    return null;
  }

  return Math.min(
    ...usable,
  );
}

function extractStandaloneYearAtEnd(
  value: string,
) {
  const match =
    value.match(
      /(?:^|[\s._-])((?:19|20)\d{2})\s*$/i,
    );

  if (!match) {
    return null;
  }

  return {
    year:
      Number(
        match[1],
      ),

    index:
      match.index ??
      0,
  };
}

function removeTrailingStandaloneYear(
  title: string,
) {
  const match =
    title.match(
      /^(.+?)\s+((?:19|20)\d{2})$/i,
    );

  if (!match) {
    return null;
  }

  const withoutYear =
    match[1]
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  /*
   * Do not destroy numeric TV titles such
   * as:
   *
   * 1923
   * 1883
   *
   * Only create a second candidate when
   * there is meaningful title text before
   * the apparent year.
   */
  if (
    !/[A-Za-z]/.test(
      withoutYear,
    )
  ) {
    return null;
  }

  return {
    title:
      withoutYear,

    year:
      Number(
        match[2],
      ),
  };
}

function uniqueTitles(
  values: string[],
) {
  const seen =
    new Set<string>();

  const output:
    string[] =
    [];

  for (
    const value of
    values
  ) {
    const cleaned =
      normalizeCandidate(
        value,
      );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

    if (
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

export function parsePredbTvRelease(
  releaseName: string,
): PredbTvParsedRelease {
  const decoded =
    decodeHtmlEntities(
      releaseName,
    );

  const episode =
    getSeasonEpisode(
      decoded,
    );

  const season =
    episode.seasonNumber !==
    null
      ? {
          seasonNumber:
            episode.seasonNumber,

          index:
            episode.index,
        }
      : getSeasonOnly(
          decoded,
        );

  const airDate =
    getEpisodeAirDate(
      decoded,
    );

  const technicalIndex =
    getTechnicalMarkerIndex(
      decoded,
    );

  /*
   * A TV title normally ends before one of:
   *
   * S02E05
   * S02
   * 2026.10.01
   * 1080p
   * WEB-DL
   *
   * We use whichever marker appears first.
   */
  const boundary =
    getEarliestBoundary([
      episode.index,

      season.index,

      airDate.index,

      technicalIndex,
    ]);

  const rawTitle =
    boundary ===
    null
      ? decoded
      : decoded.slice(
          0,
          boundary,
        );

  const primaryTitle =
    normalizeCandidate(
      rawTitle,
    );

  /*
   * Some scene releases include a year
   * directly before SxxExx:
   *
   * Example:
   *
   * Example.Show.2026.S01E03...
   *
   * That year may represent the series'
   * release year, so we preserve the original
   * candidate AND generate a second candidate
   * without the trailing year.
   *
   * The matcher can test both against TMDB.
   *
   * We deliberately do not assume the year
   * from a YYYY.MM.DD release is the series'
   * first-air year. For a long-running show
   * such as Fair City, 2026 is the episode
   * air year, not the series year.
   */
  const withoutYear =
    removeTrailingStandaloneYear(
      primaryTitle,
    );

  const titleCandidates =
    uniqueTitles([
      primaryTitle,

      withoutYear?.title ??
        "",
    ]);

  let apparentYear:
    number | null =
      withoutYear?.year ??
      null;

  /*
   * If the title extraction itself ended in
   * an obvious standalone year, preserve it
   * as contextual metadata.
   *
   * We will NOT blindly send this as
   * first_air_date_year to TMDB.
   */
  if (
    apparentYear ===
    null
  ) {
    const trailingYear =
      extractStandaloneYearAtEnd(
        rawTitle,
      );

    if (
      trailingYear
    ) {
      apparentYear =
        trailingYear.year;
    }
  }

  const seriesTitle =
    titleCandidates[0] ??
    primaryTitle;

  return {
    releaseName:
      decoded,

    seriesTitle,

    titleCandidates,

    seasonNumber:
      episode.seasonNumber ??
      season.seasonNumber,

    episodeNumber:
      episode.episodeNumber,

    episodeAirDate:
      airDate.value,

    apparentYear,

    isEpisode:
      episode.episodeNumber !==
        null ||
      airDate.value !==
        null,

    isSeasonPack:
      episode.episodeNumber ===
        null &&
      season.seasonNumber !==
        null,
  };
}