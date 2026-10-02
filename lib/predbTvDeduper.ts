import type {
  PredbMovieRelease,
} from "../data/predb";

import {
  parsePredbTvRelease,
  type PredbTvParsedRelease,
} from "./predbTvParser";

export type PredbTvEvent = {
  release:
    PredbMovieRelease;

  parsed:
    PredbTvParsedRelease;

  eventKey:
    string;

  variants:
    PredbMovieRelease[];

  variantCount:
    number;
};

function normalizeIdentityText(
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
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeClassificationText(
  value: string,
) {
  return String(
    value ?? "",
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

/*
 * PreDB Unknown contains some broadcasts that
 * syntactically resemble dated TV episodes:
 *
 * MLB.Wild.Card.2026.09.30...
 * UFC...
 * Formula1...
 *
 * Those must not enter the Watch Leaks
 * television pipeline.
 *
 * This is intentionally based on recognizable
 * sports organizations/event structures rather
 * than on the calendar year.
 */
export function isPredbSportsBroadcast(
  releaseName: string,
) {
  const normalized =
    normalizeClassificationText(
      releaseName,
    );

  const upper =
    normalized.toUpperCase();

  const sportsOrganizations = [
    "MLB",
    "NFL",
    "NBA",
    "WNBA",
    "NHL",
    "MLS",
    "NCAA",
    "UFC",
    "PGA",
    "ATP",
    "WTA",
    "UEFA",
    "FIFA",
    "MOTOGP",
    "MOTO2",
    "MOTO3",
    "NASCAR",
    "INDYCAR",
    "FORMULA 1",
    "FORMULA1",
    "F1",
  ];

  const hasSportsOrganization =
    sportsOrganizations.some(
      (
        organization,
      ) =>
        new RegExp(
          `(?:^|\\s)${organization.replace(
            /\s+/g,
            "\\s*",
          )}(?:\\s|$)`,
          "i",
        ).test(
          upper,
        ),
    );

  const hasGameOrMatchPattern =
    /\bVS\b/i.test(
      upper,
    ) ||
    /\bV\b/i.test(
      upper,
    ) ||
    /\bVERSUS\b/i.test(
      upper,
    );

  const hasCompetitionPhrase =
    /\b(?:WILD\s+CARD|PLAYOFFS?|FINALS?|SEMIFINALS?|QUARTERFINALS?|CHAMPIONSHIP|CHAMPIONS\s+LEAGUE|WORLD\s+CUP|GRAND\s+PRIX)\b/i.test(
      upper,
    );

  const hasRacePhrase =
    /\b(?:QUALIFYING|FREE\s+PRACTICE|PRACTICE|SPRINT|RACE|WARM\s+UP)\b/i.test(
      upper,
    );

  if (
    hasSportsOrganization &&
    (
      hasGameOrMatchPattern ||
      hasCompetitionPhrase ||
      hasRacePhrase
    )
  ) {
    return true;
  }

  /*
   * MLB/NFL/NBA/etc. releases often already
   * identify the sport strongly enough even
   * when "vs" has been omitted.
   */
  if (
    /\b(?:MLB|NFL|NBA|WNBA|NHL|MLS|NCAA|UFC)\b/i.test(
      upper,
    )
  ) {
    return true;
  }

  if (
    /\bUEFA\b/i.test(
      upper,
    ) &&
    /\b(?:CHAMPIONS|EUROPA|CONFERENCE)\b/i.test(
      upper,
    )
  ) {
    return true;
  }

  if (
    /\b(?:MOTOGP|MOTO2|MOTO3|NASCAR|INDYCAR)\b/i.test(
      upper,
    )
  ) {
    return true;
  }

  if (
    (
      /\bFORMULA\s*1\b/i.test(
        upper,
      ) ||
      /\bF1\b/i.test(
        upper,
      )
    ) &&
    (
      /\bGRAND\s+PRIX\b/i.test(
        upper,
      ) ||
      hasRacePhrase
    )
  ) {
    return true;
  }

  return false;
}

function safeTime(
  value: string,
) {
  const time =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      time,
    )
  ) {
    return null;
  }

  return time;
}

function compareOldestFirst(
  a: PredbMovieRelease,
  b: PredbMovieRelease,
) {
  const aTime =
    safeTime(
      a.publishedAt,
    );

  const bTime =
    safeTime(
      b.publishedAt,
    );

  if (
    aTime === null &&
    bTime === null
  ) {
    return (
      Number(
        a.postId,
      ) -
      Number(
        b.postId,
      )
    );
  }

  if (
    aTime === null
  ) {
    return 1;
  }

  if (
    bTime === null
  ) {
    return -1;
  }

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
    Number(
      a.postId,
    ) -
    Number(
      b.postId,
    )
  );
}

function compareNewestEventFirst(
  a: PredbTvEvent,
  b: PredbTvEvent,
) {
  const aTime =
    safeTime(
      a.release
        .publishedAt,
    );

  const bTime =
    safeTime(
      b.release
        .publishedAt,
    );

  if (
    aTime === null &&
    bTime === null
  ) {
    return 0;
  }

  if (
    aTime === null
  ) {
    return 1;
  }

  if (
    bTime === null
  ) {
    return -1;
  }

  return (
    bTime -
    aTime
  );
}

function getSeriesIdentity(
  parsed:
    PredbTvParsedRelease,
) {
  /*
   * Prefer the candidate without a trailing
   * apparent year when one exists.
   *
   * Dark Matter 2024
   * Dark Matter
   *
   * becomes:
   *
   * dark matter
   */
  const candidate =
    parsed
      .titleCandidates[
        parsed
          .titleCandidates
          .length -
          1
      ] ??
    parsed.seriesTitle;

  return normalizeIdentityText(
    candidate,
  );
}

export function getPredbTvEventKey({
  release,
  parsed,
}: {
  release:
    PredbMovieRelease;

  parsed:
    PredbTvParsedRelease;
}) {
  const series =
    getSeriesIdentity(
      parsed,
    );

  const signal =
    release.signal;

  /*
   * Standard episodic release.
   *
   * 1080p / 2160p / HDR / DV variants of
   * one SxxExx become one availability event.
   */
  if (
    parsed.seasonNumber !==
      null &&
    parsed.episodeNumber !==
      null
  ) {
    return [
      signal,

      series,

      `s${String(
        parsed.seasonNumber,
      ).padStart(
        2,
        "0",
      )}`,

      `e${String(
        parsed.episodeNumber,
      ).padStart(
        3,
        "0",
      )}`,
    ].join(
      "|",
    );
  }

  /*
   * Dated television episode.
   *
   * Example:
   *
   * Fair.City.2026.09.29...
   */
  if (
    parsed.episodeAirDate
  ) {
    return [
      signal,

      series,

      `date:${parsed.episodeAirDate}`,
    ].join(
      "|",
    );
  }

  /*
   * Whole-season release.
   */
  if (
    parsed.isSeasonPack &&
    parsed.seasonNumber !==
      null
  ) {
    return [
      signal,

      series,

      `season:${String(
        parsed.seasonNumber,
      ).padStart(
        2,
        "0",
      )}`,
    ].join(
      "|",
    );
  }

  /*
   * Conservative fallback.
   *
   * Unknown episode structure should remain
   * distinct rather than accidentally merging
   * unrelated releases.
   */
  return [
    signal,

    series,

    "raw",

    normalizeIdentityText(
      release.releaseName,
    ),
  ].join(
    "|",
  );
}

export function dedupePredbTvReleases(
  releases:
    PredbMovieRelease[],
): PredbTvEvent[] {
  const groups =
    new Map<
      string,
      {
        parsed:
          PredbTvParsedRelease;

        releases:
          PredbMovieRelease[];
      }
    >();

  for (
    const release of
    releases
  ) {
    /*
     * Remove sports broadcasts before they
     * can become TV availability events.
     *
     * Nothing is deleted from PreDB or Turso.
     * They simply do not enter the television
     * detection pipeline.
     */
    if (
      isPredbSportsBroadcast(
        release.releaseName,
      )
    ) {
      continue;
    }

    const parsed =
      parsePredbTvRelease(
        release.releaseName,
      );

    const eventKey =
      getPredbTvEventKey({
        release,

        parsed,
      });

    const existing =
      groups.get(
        eventKey,
      );

    if (
      existing
    ) {
      existing.releases.push(
        release,
      );

      continue;
    }

    groups.set(
      eventKey,
      {
        parsed,

        releases: [
          release,
        ],
      },
    );
  }

  const events:
    PredbTvEvent[] =
    [];

  for (
    const [
      eventKey,
      group,
    ] of groups
  ) {
    const variants = [
      ...group.releases,
    ].sort(
      compareOldestFirst,
    );

    /*
     * Earliest PreDB observation becomes the
     * canonical first-seen event.
     */
    const release =
      variants[0];

    const parsed =
      parsePredbTvRelease(
        release.releaseName,
      );

    events.push({
      release,

      parsed,

      eventKey,

      variants,

      variantCount:
        variants.length,
    });
  }

  return events.sort(
    compareNewestEventFirst,
  );
}