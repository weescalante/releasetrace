import Link from "next/link";

import SiteHeader from "../../components/SiteHeader";

import TitleBrowser, {
  type BrowseTitle,
} from "../../components/TitleBrowser";

import {
  getLatestPublicTvDetections,
  type PublicTvDetection,
} from "../../lib/tvDetections";

type TmdbShow = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  origin_country: string[];
};

type TmdbResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbShow[];
};

type TVShowsPageProps = {
  searchParams: Promise<{
    page?: string;
    view?: string;
  }>;
};

const PAGE_SIZE = 32;

const MAX_TMDB_PAGES = 100;

const WESTERN_ORIGINS =
  "US|CA|GB|AU|NZ|IE";

const LATEST_DETECTION_COUNT = 12;

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function parsePage(
  value:
    string |
    undefined,
) {
  const parsed =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <
      1
  ) {
    return 1;
  }

  return parsed;
}

async function fetchShowPage(
  page:
    number,
): Promise<
  TmdbResponse
> {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const params =
    new URLSearchParams({
      language:
        "en-US",

      page:
        String(
          page,
        ),

      sort_by:
        "first_air_date.desc",

      include_adult:
        "false",

      include_null_first_air_dates:
        "false",

      with_original_language:
        "en",

      with_origin_country:
        WESTERN_ORIGINS,

      "vote_count.gte":
        "20",

      "first_air_date.lte":
        getToday(),
    });

  const response =
    await fetch(
      `https://api.themoviedb.org/3/discover/tv?${params.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          accept:
            "application/json",
        },

        next: {
          revalidate:
            3600,
        },
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `TMDB TV request failed with status ${response.status}.`,
    );
  }

  return response.json();
}

function sortShows(
  shows:
    TmdbShow[],
) {
  return shows.sort(
    (
      a,
      b,
    ) => {
      const aTime =
        new Date(
          `${a.first_air_date}T00:00:00Z`,
        ).getTime();

      const bTime =
        new Date(
          `${b.first_air_date}T00:00:00Z`,
        ).getTime();

      if (
        bTime !==
        aTime
      ) {
        return (
          bTime -
          aTime
        );
      }

      return (
        b.vote_count -
        a.vote_count
      );
    },
  );
}

async function getCuratedShows(
  requestedPage:
    number,
) {
  const requiredCount =
    requestedPage *
    PAGE_SIZE;

  const showMap =
    new Map<
      number,
      TmdbShow
    >();

  let tmdbPage =
    1;

  let totalResults =
    0;

  let reachedEnd =
    false;

  while (
    showMap.size <
      requiredCount &&
    tmdbPage <=
      MAX_TMDB_PAGES &&
    !reachedEnd
  ) {
    const data =
      await fetchShowPage(
        tmdbPage,
      );

    totalResults =
      data.total_results;

    data.results.forEach(
      (
        show,
      ) => {
        if (
          !show.poster_path ||
          !show.first_air_date
        ) {
          return;
        }

        if (
          !showMap.has(
            show.id,
          )
        ) {
          showMap.set(
            show.id,
            show,
          );
        }
      },
    );

    reachedEnd =
      tmdbPage >=
      Math.min(
        data.total_pages,
        500,
      );

    tmdbPage +=
      1;
  }

  const allShows =
    sortShows(
      Array.from(
        showMap.values(),
      ),
    );

  const start =
    (
      requestedPage -
      1
    ) *
    PAGE_SIZE;

  const end =
    start +
    PAGE_SIZE;

  const pageShows =
    allShows.slice(
      start,
      end,
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalResults /
          PAGE_SIZE,
      ),
    );

  return {
    shows:
      pageShows,

    totalPages,

    totalResults,
  };
}

function formatCountries(
  countries:
    string[],
) {
  if (
    !countries.length
  ) {
    return null;
  }

  return countries
    .slice(
      0,
      2,
    )
    .join(
      " • ",
    );
}

function formatEpisodeCode(
  detection:
    PublicTvDetection,
) {
  if (
    detection.seasonNumber ===
      null ||
    detection.episodeNumber ===
      null
  ) {
    return "Episode";
  }

  return `S${String(
    detection.seasonNumber,
  ).padStart(
    2,
    "0",
  )}E${String(
    detection.episodeNumber,
  ).padStart(
    2,
    "0",
  )}`;
}

function formatEpisodeAirDate(
  date:
    string |
    null,
) {
  if (!date) {
    return "—";
  }

  const parsedDate =
    new Date(
      `${date}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",

      timeZone:
        "UTC",
    },
  ).format(
    parsedDate,
  );
}

function formatDetectedAt(
  detectedAt:
    string,
) {
  const parsedDate =
    new Date(
      detectedAt,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return detectedAt;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        "UTC",

      timeZoneName:
        "short",
    },
  ).format(
    parsedDate,
  );
}

function LatestTvDetections({
  detections,
}: {
  detections:
    PublicTvDetection[];
}) {
  if (
    detections.length ===
    0
  ) {
    return null;
  }

  return (
    <section>
      <div className="border-b border-zinc-800 pb-3">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-500">
          Detection Intelligence
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Latest TV Detections
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Latest verified WEB availability
          detections for individual television
          episodes.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {detections.map(
          (
            detection,
          ) => {
            const posterUrl =
              detection.posterPath
                ? `https://image.tmdb.org/t/p/w342${detection.posterPath}`
                : null;

            const episodeCode =
              formatEpisodeCode(
                detection,
              );

            return (
              <Link
                key={
                  detection.id
                }
                href={`/tv-shows/${detection.tmdbId}?from=tv-shows`}
                className="group overflow-hidden border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
              >
                <div className="relative">
                  {posterUrl ? (
                    <img
                      src={
                        posterUrl
                      }
                      alt={`${detection.title} poster`}
                      loading="lazy"
                      className="aspect-[2/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center bg-zinc-900 text-[10px] text-zinc-600">
                      No poster
                    </div>
                  )}

                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                    <span className="border border-amber-300 bg-amber-400 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-black shadow-lg">
                      WEB DETECTED
                    </span>

                    <span className="border border-red-500 bg-black/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-red-400">
                      {episodeCode}
                    </span>
                  </div>
                </div>

                <div className="p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[8px] uppercase tracking-wider text-zinc-600">
                      TV
                    </span>

                    <span className="text-[8px] font-medium text-amber-300">
                      {detection.quality ??
                        "WEB"}
                    </span>
                  </div>

                  <h2 className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white">
                    {
                      detection.title
                    }
                  </h2>

                  <p className="mt-1 line-clamp-1 text-[9px] text-zinc-400">
                    {detection.episodeTitle ??
                      episodeCode}
                  </p>

                  <div className="mt-2 border-t border-zinc-900 pt-2">
                    <p className="text-[7px] uppercase tracking-wider text-zinc-700">
                      Air Date
                    </p>

                    <p className="mt-0.5 text-[9px] text-zinc-400">
                      {formatEpisodeAirDate(
                        detection.episodeAirDate,
                      )}
                    </p>
                  </div>

                  <div className="mt-2">
                    <p className="text-[7px] uppercase tracking-wider text-zinc-700">
                      First Detected
                    </p>

                    <p className="mt-0.5 text-[9px] leading-4 text-zinc-400">
                      {formatDetectedAt(
                        detection.detectedAt,
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            );
          },
        )}
      </div>
    </section>
  );
}

export default async function TVShowsPage({
  searchParams,
}: TVShowsPageProps) {
  const params =
    await searchParams;

  const requestedPage =
    parsePage(
      params.page,
    );

  const [
    curatedShows,
    latestDetections,
  ] =
    await Promise.all([
      getCuratedShows(
        requestedPage,
      ),

      getLatestPublicTvDetections(
        LATEST_DETECTION_COUNT,
      ),
    ]);

  const {
    shows,
    totalPages,
    totalResults,
  } =
    curatedShows;

  const page =
    Math.min(
      requestedPage,
      totalPages,
    );

  const items:
    BrowseTitle[] =
    shows.map(
      (
        show,
      ) => ({
        id:
          show.id,

        title:
          show.name,

        overview:
          show.overview,

        posterPath:
          show.poster_path,

        date:
          show.first_air_date,

        dateLabel:
          "First Aired",

        categoryLabel:
          "TV",

        regionLabel:
          formatCountries(
            show.origin_country,
          ),

        rating:
          show.vote_average,

        voteCount:
          show.vote_count,

        href:
          `/tv-shows/${show.id}?from=tv-shows`,
      }),
    );

  const initialView =
    params.view ===
    "list"
      ? "list"
      : "cards";

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <LatestTvDetections
          detections={
            latestDetections
          }
        />

        <div className="mt-16">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-500">
            Latest Television Releases
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            Latest TV Shows
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The latest English-language
            television shows released
            across the US, Canada and
            major Western markets.
          </p>

          <TitleBrowser
            items={
              items
            }
            page={
              page
            }
            totalPages={
              totalPages
            }
            totalResults={
              totalResults
            }
            basePath="/tv-shows"
            initialView={
              initialView
            }
          />
        </div>

        <p className="mt-10 text-xs text-zinc-700">
          TV metadata, ratings and
          images provided by TMDB.
          Detection intelligence reflects
          verified WEB availability
          observations.
        </p>
      </section>
    </main>
  );
}