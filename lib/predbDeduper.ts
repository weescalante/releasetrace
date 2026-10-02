import {
  type PredbMovieRelease,
} from "../data/predb";

function getTimestamp(
  value: string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return Number.isNaN(
    timestamp,
  )
    ? null
    : timestamp;
}

function getGroupingKey(
  release:
    PredbMovieRelease,
) {
  return [
    release.normalizedTitle
      .trim()
      .toLowerCase(),

    release.year,

    release.signal,
  ].join(
    "::",
  );
}

/*
 * PreDB frequently publishes several
 * encodes of the same movie within minutes:
 *
 * 1080p Blu-ray
 * 720p Blu-ray
 * BDRip
 * COMPLETE BLURAY
 *
 * Watch Leaks should treat those as one
 * availability event.
 *
 * For latency intelligence, the earliest
 * PreDB timestamp is the important one.
 */
export function dedupePredbReleases(
  releases:
    PredbMovieRelease[],
) {
  const grouped =
    new Map<
      string,
      PredbMovieRelease
    >();

  for (
    const release of
    releases
  ) {
    if (
      release.signal !==
        "WEB" &&
      release.signal !==
        "BLURAY"
    ) {
      continue;
    }

    const key =
      getGroupingKey(
        release,
      );

    const existing =
      grouped.get(
        key,
      );

    if (
      !existing
    ) {
      grouped.set(
        key,
        release,
      );

      continue;
    }

    const existingTime =
      getTimestamp(
        existing.publishedAt,
      );

    const candidateTime =
      getTimestamp(
        release.publishedAt,
      );

    if (
      candidateTime ===
      null
    ) {
      continue;
    }

    if (
      existingTime ===
        null ||
      candidateTime <
        existingTime
    ) {
      /*
       * Replace the representative with
       * the earliest known PreDB release.
       */
      grouped.set(
        key,
        release,
      );
    }
  }

  return [
    ...grouped.values(),
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        getTimestamp(
          a.publishedAt,
        );

      const bTime =
        getTimestamp(
          b.publishedAt,
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
    },
  );
}