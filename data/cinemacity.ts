import { XMLParser } from "fast-xml-parser";

import { saveCloudDetection } from "../lib/cloudDatabase";
import {
  recordFeedFailure,
  recordFeedSuccess,
} from "../lib/feedStatus";

export type Signal = "CAM" | "WEB" | "OTHER";

export type ReleaseRegion = "US" | "CA";

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

type TmdbSearchResponse = {
  results: {
    id: number;
    title: string;
    poster_path: string | null;
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
  posterPath: string | null;

  theatricalReleaseDate: string | null;
  theatricalReleaseRegion: ReleaseRegion | null;

  digitalReleaseDate: string | null;
  digitalReleaseRegion: ReleaseRegion | null;

  physicalReleaseDate: string | null;
  physicalReleaseRegion: ReleaseRegion | null;
};

type RawFeedItem = {
  title?: unknown;
  quality?: unknown;
  year?: unknown;
  country?: unknown;
  pubDate?: unknown;
  link?: unknown;
};

const FEED_SOURCE = "CinemaCity";

export function normalizeTitle(
  title: string,
): string {
  const primaryTitle =
    title.split("/")[0].trim();

  return primaryTitle
    .replace(
      /\s*\(\d{4}\)\s*$/,
      "",
    )
    .trim();
}

export function classifyQuality(
  quality: string,
): Signal {
  const normalizedQuality =
    quality.toUpperCase();

  if (
    normalizedQuality.includes("CAM") ||
    normalizedQuality.includes("TS") ||
    normalizedQuality.includes("TELESYNC")
  ) {
    return "CAM";
  }

  if (
    normalizedQuality.includes("WEB") ||
    normalizedQuality.includes("WEBDL") ||
    normalizedQuality.includes("WEB-DL") ||
    normalizedQuality.includes("WEBRIP")
  ) {
    return "WEB";
  }

  return "OTHER";
}

export function isRecentRelease(
  releaseDate: string | null,
): boolean {
  if (!releaseDate) {
    return false;
  }

  const release =
    new Date(releaseDate);

  const today =
    new Date();

  const daysDifference =
    (today.getTime() -
      release.getTime()) /
    (1000 * 60 * 60 * 24);

  return (
    daysDifference >= -30 &&
    daysDifference <= 120
  );
}

function firstReleaseForType(
  releaseData: TmdbReleaseDatesResponse,
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

    if (!region) {
      continue;
    }

    const matchingDates =
      region.release_dates
        .filter(
          (release) =>
            release.type === type,
        )
        .map(
          (release) =>
            release.release_date,
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(a).getTime() -
            new Date(b).getTime(),
        );

    if (
      matchingDates.length > 0
    ) {
      return {
        date:
          matchingDates[0].slice(
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

async function findTmdbMovie(
  title: string,
  year: string,
): Promise<TmdbMatch | null> {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    return null;
  }

  try {
    const params =
      new URLSearchParams({
        query: title,
        include_adult:
          "false",
        language:
          "en-US",
      });

    if (
      /^\d{4}$/.test(year)
    ) {
      params.set(
        "primary_release_year",
        year,
      );
    }

    const searchResponse =
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
      !searchResponse.ok
    ) {
      return null;
    }

    const searchData:
      TmdbSearchResponse =
      await searchResponse.json();

    const match =
      searchData.results[0];

    if (!match) {
      return null;
    }

    const releaseResponse =
      await fetch(
        `https://api.themoviedb.org/3/movie/${match.id}/release_dates`,
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

    let theatricalRelease:
      ReleaseMatch | null =
      null;

    let digitalRelease:
      ReleaseMatch | null =
      null;

    let physicalRelease:
      ReleaseMatch | null =
      null;

    if (
      releaseResponse.ok
    ) {
      const releaseData:
        TmdbReleaseDatesResponse =
        await releaseResponse.json();

      // TMDB release types:
      // 2 = Theatrical (Limited)
      // 3 = Theatrical
      // 4 = Digital
      // 5 = Physical

      theatricalRelease =
        firstReleaseForType(
          releaseData,
          3,
        ) ??
        firstReleaseForType(
          releaseData,
          2,
        );

      digitalRelease =
        firstReleaseForType(
          releaseData,
          4,
        );

      physicalRelease =
        firstReleaseForType(
          releaseData,
          5,
        );
    }

    return {
      id:
        match.id,

      posterPath:
        match.poster_path ??
        null,

      theatricalReleaseDate:
        theatricalRelease
          ?.date ?? null,

      theatricalReleaseRegion:
        theatricalRelease
          ?.region ?? null,

      digitalReleaseDate:
        digitalRelease
          ?.date ?? null,

      digitalReleaseRegion:
        digitalRelease
          ?.region ?? null,

      physicalReleaseDate:
        physicalRelease
          ?.date ?? null,

      physicalReleaseRegion:
        physicalRelease
          ?.region ?? null,
    };
  } catch (error) {
    console.error(
      "TMDB movie lookup failed:",
      error,
    );

    return null;
  }
}

function getRelevantRelease(
  signal: Signal,
  tmdbMatch:
    TmdbMatch | null,
): ReleaseMatch | null {
  if (!tmdbMatch) {
    return null;
  }

  if (
    signal === "CAM" &&
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
    signal === "WEB" &&
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
  items: RawFeedItem[],
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
          item.pubDate ?? "",
        ).trim();

      if (!publishedAt) {
        return;
      }

      const parsedDate =
        new Date(
          publishedAt,
        );

      const timestamp =
        parsedDate.getTime();

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
          parsedDate.toISOString();

        latestTitle =
          String(
            item.title ??
              "Unknown title",
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
  checkedAt: string;
  error: string;
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
              "ShadowWindow/1.0",
          },

          cache:
            "no-store",
        },
      );

    if (!response.ok) {
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
        ?.item ?? [];

    const items:
      RawFeedItem[] =
      Array.isArray(
        rawItems,
      )
        ? rawItems
        : [rawItems];

    feedLoaded = true;

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
          async (item) => {
            const title =
              String(
                item.title ??
                  "Unknown title",
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
              String(
                item.country ??
                  "Unknown",
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

            const signal =
              classifyQuality(
                quality,
              );

            const tmdbMatch =
              await findTmdbMovie(
                normalizedTitle,
                year,
              );

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

            if (
              signal !==
              "OTHER"
            ) {
              await saveCloudDetection(
                {
                  tmdbId:
                    movie.tmdbId,

                  title:
                    movie.normalizedTitle,

                  year:
                    movie.year,

                  detectionType:
                    movie.signal,

                  quality:
                    movie.quality,

                  detectedAt:
                    movie.publishedAt,

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
                    "CinemaCity",

                  sourceUrl:
                    movie.sourceUrl,
                },
              );
            }

            return movie;
          },
        ),
      );

    return movies.filter(
      (movie) => {
        if (
          movie.signal ===
          "OTHER"
        ) {
          return false;
        }

        return isRecentRelease(
          movie.tmdbReleaseDate,
        );
      },
    );
  } catch (error) {
    console.error(
      "CinemaCity ingestion failed:",
      error,
    );

    /*
     * Only mark the RSS itself as
     * failed when we never successfully
     * fetched and parsed the feed.
     *
     * A later TMDB/database problem
     * should not make the RSS health
     * indicator falsely say the feed
     * itself is down.
     */
    if (!feedLoaded) {
      const message =
        error instanceof Error
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