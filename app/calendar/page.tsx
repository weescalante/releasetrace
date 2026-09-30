import Link from "next/link";

import SiteHeader from "../../components/SiteHeader";

type Region = "US" | "CA";

type MediaFilter = "all" | "movies" | "tv";

type ViewMode = "cards" | "list";

type TmdbMovie = {
  id: number;
  title: string;
  poster_path: string | null;
};

type DiscoverMovieResponse = {
  results: TmdbMovie[];
};

type TmdbReleaseDate = {
  certification: string;
  release_date: string;
  type: number;
  note: string;
};

type ReleaseDateRegion = {
  iso_3166_1: string;
  release_dates: TmdbReleaseDate[];
};

type ReleaseDatesResponse = {
  results: ReleaseDateRegion[];
};

type TmdbShow = {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date?: string;
  origin_country: string[];
  original_language: string;
  genre_ids: number[];
};

type DiscoverTvResponse = {
  results: TmdbShow[];
};

type TmdbEpisode = {
  id: number;
  name: string;
  overview: string;
  air_date: string | null;
  episode_number: number;
  season_number: number;
  episode_type?: string;
  runtime?: number | null;
};

type TmdbShowDetails = {
  id: number;
  name: string;
  poster_path: string | null;
  origin_country: string[];
  number_of_seasons: number;
  next_episode_to_air: TmdbEpisode | null;
  last_episode_to_air: TmdbEpisode | null;
};

type TmdbSeasonDetails = {
  id: number;
  name: string;
  season_number: number;
  episodes: TmdbEpisode[];
};

type CalendarMovieItem = {
  key: string;
  id: number;
  title: string;

  mediaType: "MOVIE";

  releaseDate: string;
  releaseLabel: string;

  posterPath: string;

  regions: Region[];
};

type CalendarTvItem = {
  key: string;
  id: number;
  title: string;

  mediaType: "TV";

  releaseDate: string;
  releaseLabel: string;

  posterPath: string;

  originCountries: string[];

  seasonNumber: number;
  episodeNumber: number;
  episodeCode: string;
};

type CalendarItem =
  | CalendarMovieItem
  | CalendarTvItem;

type CalendarPageProps = {
  searchParams: Promise<{
    type?: string;
    view?: string;
  }>;
};

const WESTERN_ORIGINS = "US|CA|GB|AU|NZ|IE";

const TV_EXCLUDED_GENRES = new Set([
  10763, // News
  10767, // Talk
]);

const MOVIE_DISCOVER_PAGES = [1, 2, 3];

const TV_DISCOVER_PAGES = [1, 2, 3];

const MAX_TV_SHOWS_TO_EXPAND = 30;

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateHeading(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatRegions(regions: Region[]) {
  return regions
    .map((region) =>
      region === "US"
        ? "United States"
        : "Canada",
    )
    .join(" • ");
}

function formatOriginCountries(
  countries: string[],
) {
  if (!countries.length) {
    return "Region unavailable";
  }

  return countries
    .map((country) => {
      if (country === "US") {
        return "United States";
      }

      if (country === "CA") {
        return "Canada";
      }

      if (country === "GB") {
        return "United Kingdom";
      }

      if (country === "AU") {
        return "Australia";
      }

      if (country === "NZ") {
        return "New Zealand";
      }

      if (country === "IE") {
        return "Ireland";
      }

      return country;
    })
    .slice(0, 2)
    .join(" • ");
}

function formatEpisodeCode(
  seasonNumber: number,
  episodeNumber: number,
) {
  const season = String(
    seasonNumber,
  ).padStart(2, "0");

  const episode = String(
    episodeNumber,
  ).padStart(2, "0");

  return `S${season}E${episode}`;
}

function getTvReleaseLabel(
  episode: TmdbEpisode,
) {
  const episodeCode =
    formatEpisodeCode(
      episode.season_number,
      episode.episode_number,
    );

  const episodeType =
    episode.episode_type
      ?.toLowerCase()
      .trim();

  if (
    episode.season_number === 1 &&
    episode.episode_number === 1
  ) {
    return `Series Premiere · ${episodeCode}`;
  }

  if (episode.episode_number === 1) {
    return `Season ${episode.season_number} Premiere · ${episodeCode}`;
  }

  if (episodeType === "finale") {
    return `Season ${episode.season_number} Finale · ${episodeCode}`;
  }

  return `Episode · ${episodeCode}`;
}

async function getCandidateMovies(
  region: Region,
  startDate: string,
  endDate: string,
) {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const requests =
    MOVIE_DISCOVER_PAGES.map(
      async (page) => {
        const params =
          new URLSearchParams({
            language: "en-US",
            region,
            page: page.toString(),
            sort_by: "popularity.desc",
            include_adult: "false",
            include_video: "false",
            with_release_type: "2|3",
            with_original_language:
              "en",
            with_origin_country:
              WESTERN_ORIGINS,
            "release_date.gte":
              startDate,
            "release_date.lte":
              endDate,
          });

        const response =
          await fetch(
            `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
                accept:
                  "application/json",
              },
              next: {
                revalidate: 3600,
              },
            },
          );

        if (!response.ok) {
          throw new Error(
            `TMDB movie discover request for ${region} failed with status ${response.status}.`,
          );
        }

        const data:
          DiscoverMovieResponse =
          await response.json();

        return data.results;
      },
    );

  const pages =
    await Promise.all(requests);

  return pages
    .flat()
    .filter(
      (movie) =>
        movie.poster_path !== null,
    );
}

async function getMovieReleaseDates(
  movieId: number,
) {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response =
    await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/release_dates`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
          accept:
            "application/json",
        },
        next: {
          revalidate: 3600,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `TMDB release-date request for movie ${movieId} failed with status ${response.status}.`,
    );
  }

  const data:
    ReleaseDatesResponse =
    await response.json();

  return data.results;
}

function findTheatricalDates(
  releaseDates:
    ReleaseDateRegion[],
  region: Region,
  startDate: string,
  endDate: string,
) {
  const regionData =
    releaseDates.find(
      (item) =>
        item.iso_3166_1 ===
        region,
    );

  if (!regionData) {
    return [];
  }

  const dates =
    regionData.release_dates
      .filter(
        (release) =>
          release.type === 2 ||
          release.type === 3,
      )
      .map((release) =>
        release.release_date.slice(
          0,
          10,
        ),
      )
      .filter(
        (date) =>
          date >= startDate &&
          date <= endDate,
      );

  return [
    ...new Set(dates),
  ].sort();
}

async function buildMovieCalendar(
  candidates: TmdbMovie[],
  startDate: string,
  endDate: string,
): Promise<
  CalendarMovieItem[]
> {
  const calendarMap =
    new Map<
      string,
      CalendarMovieItem
    >();

  const uniqueMovies =
    Array.from(
      new Map(
        candidates.map(
          (movie) => [
            movie.id,
            movie,
          ],
        ),
      ).values(),
    );

  for (
    let index = 0;
    index <
    uniqueMovies.length;
    index += 10
  ) {
    const batch =
      uniqueMovies.slice(
        index,
        index + 10,
      );

    const batchResults =
      await Promise.all(
        batch.map(
          async (movie) => {
            try {
              const releaseDates =
                await getMovieReleaseDates(
                  movie.id,
                );

              const usDates =
                findTheatricalDates(
                  releaseDates,
                  "US",
                  startDate,
                  endDate,
                );

              const canadaDates =
                findTheatricalDates(
                  releaseDates,
                  "CA",
                  startDate,
                  endDate,
                );

              return {
                movie,
                usDates,
                canadaDates,
              };
            } catch (error) {
              console.error(
                `Release dates failed for ${movie.title}:`,
                error,
              );

              return {
                movie,
                usDates:
                  [] as string[],
                canadaDates:
                  [] as string[],
              };
            }
          },
        ),
      );

    batchResults.forEach(
      ({
        movie,
        usDates,
        canadaDates,
      }) => {
        if (!movie.poster_path) {
          return;
        }

        const posterPath =
          movie.poster_path;

        const addRelease = (
          date: string,
          region: Region,
        ) => {
          const key =
            `${movie.id}-${date}`;

          const existing =
            calendarMap.get(key);

          if (existing) {
            if (
              !existing.regions.includes(
                region,
              )
            ) {
              existing.regions.push(
                region,
              );
            }

            return;
          }

          calendarMap.set(
            key,
            {
              key:
                `movie-${movie.id}-${date}`,
              id: movie.id,
              title:
                movie.title,
              mediaType:
                "MOVIE",
              releaseDate:
                date,
              releaseLabel:
                "Theatrical Release",
              posterPath,
              regions: [
                region,
              ],
            },
          );
        };

        usDates.forEach(
          (date) =>
            addRelease(
              date,
              "US",
            ),
        );

        canadaDates.forEach(
          (date) =>
            addRelease(
              date,
              "CA",
            ),
        );
      },
    );
  }

  return Array.from(
    calendarMap.values(),
  ).sort((a, b) =>
    a.releaseDate.localeCompare(
      b.releaseDate,
    ),
  );
}

async function getCandidateShows(
  startDate: string,
  endDate: string,
) {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const responses =
    await Promise.all(
      TV_DISCOVER_PAGES.map(
        async (page) => {
          const params =
            new URLSearchParams({
              include_adult:
                "false",
              include_null_first_air_dates:
                "false",
              language:
                "en-US",
              page:
                page.toString(),
              sort_by:
                "popularity.desc",
              with_original_language:
                "en",
              with_origin_country:
                WESTERN_ORIGINS,
              "air_date.gte":
                startDate,
              "air_date.lte":
                endDate,
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

          if (!response.ok) {
            throw new Error(
              `TMDB TV discover request failed with status ${response.status}.`,
            );
          }

          const data:
            DiscoverTvResponse =
            await response.json();

          return data.results;
        },
      ),
    );

  const uniqueShows =
    Array.from(
      new Map(
        responses
          .flat()
          .filter(
            (show) => {
              if (
                !show.poster_path
              ) {
                return false;
              }

              const hasExcludedGenre =
                show.genre_ids.some(
                  (genreId) =>
                    TV_EXCLUDED_GENRES.has(
                      genreId,
                    ),
                );

              return (
                !hasExcludedGenre
              );
            },
          )
          .map((show) => [
            show.id,
            show,
          ]),
      ).values(),
    );

  return uniqueShows.slice(
    0,
    MAX_TV_SHOWS_TO_EXPAND,
  );
}

async function getShowDetails(
  showId: number,
) {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${showId}?language=en-US`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
          accept:
            "application/json",
        },
        next: {
          revalidate: 3600,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `TMDB TV details request for ${showId} failed with status ${response.status}.`,
    );
  }

  const data:
    TmdbShowDetails =
    await response.json();

  return data;
}

async function getSeasonDetails(
  showId: number,
  seasonNumber: number,
) {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?language=en-US`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
          accept:
            "application/json",
        },
        next: {
          revalidate: 3600,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `TMDB season request for show ${showId}, season ${seasonNumber} failed with status ${response.status}.`,
    );
  }

  const data:
    TmdbSeasonDetails =
    await response.json();

  return data;
}

async function buildTvCalendar(
  candidates: TmdbShow[],
  startDate: string,
  endDate: string,
): Promise<
  CalendarTvItem[]
> {
  const calendarMap =
    new Map<
      string,
      CalendarTvItem
    >();

  for (
    let index = 0;
    index <
    candidates.length;
    index += 6
  ) {
    const batch =
      candidates.slice(
        index,
        index + 6,
      );

    const batchResults =
      await Promise.all(
        batch.map(
          async (
            candidate,
          ) => {
            try {
              const details =
                await getShowDetails(
                  candidate.id,
                );

              const seasonNumbers =
                new Set<number>();

              if (
                details
                  .next_episode_to_air
                  ?.season_number
              ) {
                seasonNumbers.add(
                  details
                    .next_episode_to_air
                    .season_number,
                );
              }

              if (
                details
                  .last_episode_to_air
                  ?.season_number
              ) {
                seasonNumbers.add(
                  details
                    .last_episode_to_air
                    .season_number,
                );
              }

              if (
                details.number_of_seasons >
                0
              ) {
                seasonNumbers.add(
                  details.number_of_seasons,
                );
              }

              const validSeasonNumbers =
                Array.from(
                  seasonNumbers,
                ).filter(
                  (
                    seasonNumber,
                  ) =>
                    seasonNumber >
                    0,
                );

              const seasons =
                await Promise.all(
                  validSeasonNumbers.map(
                    async (
                      seasonNumber,
                    ) => {
                      try {
                        return await getSeasonDetails(
                          candidate.id,
                          seasonNumber,
                        );
                      } catch (
                        error
                      ) {
                        console.error(
                          `Season ${seasonNumber} failed for ${candidate.name}:`,
                          error,
                        );

                        return null;
                      }
                    },
                  ),
                );

              return {
                candidate,
                details,
                seasons:
                  seasons.filter(
                    (
                      season,
                    ): season is TmdbSeasonDetails =>
                      season !==
                      null,
                  ),
              };
            } catch (error) {
              console.error(
                `TV expansion failed for ${candidate.name}:`,
                error,
              );

              return null;
            }
          },
        ),
      );

    batchResults.forEach(
      (result) => {
        if (!result) {
          return;
        }

        const {
          candidate,
          details,
          seasons,
        } = result;

        const posterPath =
          details.poster_path ??
          candidate.poster_path;

        if (!posterPath) {
          return;
        }

        seasons.forEach(
          (season) => {
            season.episodes.forEach(
              (episode) => {
                const airDate =
                  episode.air_date;

                if (
                  !airDate ||
                  airDate <
                    startDate ||
                  airDate >
                    endDate
                ) {
                  return;
                }

                const episodeCode =
                  formatEpisodeCode(
                    episode.season_number,
                    episode.episode_number,
                  );

                const key =
                  `${candidate.id}-${episode.season_number}-${episode.episode_number}-${airDate}`;

                if (
                  calendarMap.has(
                    key,
                  )
                ) {
                  return;
                }

                calendarMap.set(
                  key,
                  {
                    key:
                      `tv-${key}`,
                    id:
                      candidate.id,
                    title:
                      candidate.name,
                    mediaType:
                      "TV",
                    releaseDate:
                      airDate,
                    releaseLabel:
                      getTvReleaseLabel(
                        episode,
                      ),
                    posterPath,
                    originCountries:
                      details.origin_country
                        ?.length
                        ? details.origin_country
                        : candidate.origin_country,
                    seasonNumber:
                      episode.season_number,
                    episodeNumber:
                      episode.episode_number,
                    episodeCode,
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  return Array.from(
    calendarMap.values(),
  ).sort((a, b) => {
    const dateCompare =
      a.releaseDate.localeCompare(
        b.releaseDate,
      );

    if (
      dateCompare !== 0
    ) {
      return dateCompare;
    }

    return a.title.localeCompare(
      b.title,
    );
  });
}

function buildCalendarHref({
  type,
  view,
}: {
  type: MediaFilter;
  view: ViewMode;
}) {
  const params =
    new URLSearchParams();

  if (type !== "all") {
    params.set(
      "type",
      type,
    );
  }

  if (view !== "list") {
    params.set(
      "view",
      view,
    );
  }

  const query =
    params.toString();

  return query
    ? `/calendar?${query}`
    : "/calendar";
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const params =
    await searchParams;

  const requestedFilter =
    params.type;

  const activeFilter:
    MediaFilter =
    requestedFilter ===
      "movies" ||
    requestedFilter ===
      "tv"
      ? requestedFilter
      : "all";

  const activeView:
    ViewMode =
    params.view ===
    "cards"
      ? "cards"
      : "list";

  const today =
    new Date();

  const endDateObject =
    new Date(today);

  endDateObject.setUTCDate(
    endDateObject.getUTCDate() +
      60,
  );

  const startDate =
    toDateString(today);

  const endDate =
    toDateString(
      endDateObject,
    );

  const [
    usCandidates,
    canadaCandidates,
    tvCandidates,
  ] = await Promise.all([
    getCandidateMovies(
      "US",
      startDate,
      endDate,
    ),

    getCandidateMovies(
      "CA",
      startDate,
      endDate,
    ),

    getCandidateShows(
      startDate,
      endDate,
    ),
  ]);

  const movieCandidates = [
    ...usCandidates,
    ...canadaCandidates,
  ];

  const [
    movies,
    tvEvents,
  ] = await Promise.all([
    buildMovieCalendar(
      movieCandidates,
      startDate,
      endDate,
    ),

    buildTvCalendar(
      tvCandidates,
      startDate,
      endDate,
    ),
  ]);

  const allItems:
    CalendarItem[] = [
      ...movies,
      ...tvEvents,
    ].sort((a, b) => {
      const dateCompare =
        a.releaseDate.localeCompare(
          b.releaseDate,
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title,
      );
    });

  const filteredItems =
    allItems.filter(
      (item) => {
        if (
          activeFilter ===
          "movies"
        ) {
          return (
            item.mediaType ===
            "MOVIE"
          );
        }

        if (
          activeFilter ===
          "tv"
        ) {
          return (
            item.mediaType ===
            "TV"
          );
        }

        return true;
      },
    );

  const itemsByDate =
    filteredItems.reduce<
      Record<
        string,
        CalendarItem[]
      >
    >(
      (
        groups,
        item,
      ) => {
        if (
          !groups[
            item.releaseDate
          ]
        ) {
          groups[
            item.releaseDate
          ] = [];
        }

        groups[
          item.releaseDate
        ].push(
          item,
        );

        return groups;
      },
      {},
    );

  const releaseDates =
    Object.keys(
      itemsByDate,
    ).sort();

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
          What&apos;s Next
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Release Calendar
        </h1>

        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-300">
          Upcoming movie and television
          release events over the next
          60 days, focused on the United
          States, Canada and major Western
          regions.
        </p>

        <div className="mt-7 flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                {
                  value:
                    "all",
                  label:
                    "All",
                },
                {
                  value:
                    "movies",
                  label:
                    "Movies",
                },
                {
                  value:
                    "tv",
                  label:
                    "TV Shows",
                },
              ] as {
                value:
                  MediaFilter;
                label:
                  string;
              }[]
            ).map(
              (filter) => {
                const isActive =
                  activeFilter ===
                  filter.value;

                return (
                  <Link
                    key={
                      filter.value
                    }
                    href={buildCalendarHref(
                      {
                        type:
                          filter.value,
                        view:
                          activeView,
                      },
                    )}
                    className={`border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-zinc-500 bg-zinc-800 text-white"
                        : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    {
                      filter.label
                    }
                  </Link>
                );
              },
            )}
          </div>

          <div className="flex w-fit rounded-md border border-zinc-700 p-0.5">
            <Link
              href={buildCalendarHref(
                {
                  type:
                    activeFilter,
                  view:
                    "cards",
                },
              )}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                activeView ===
                "cards"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              Cards
            </Link>

            <Link
              href={buildCalendarHref(
                {
                  type:
                    activeFilter,
                  view:
                    "list",
                },
              )}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                activeView ===
                "list"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              List
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-10">
          {releaseDates.map(
            (date) => {
              const items =
                itemsByDate[
                  date
                ];

              return (
                <section
                  key={
                    date
                  }
                >
                  <div className="flex items-end justify-between gap-4 border-b border-zinc-700 pb-2">
                    <h2 className="text-xl font-bold text-white">
                      {formatDateHeading(
                        date,
                      )}
                    </h2>

                    <p className="text-xs font-medium text-zinc-400">
                      {
                        items.length
                      }{" "}
                      {items.length ===
                      1
                        ? "release"
                        : "releases"}
                    </p>
                  </div>

                  {activeView ===
                  "cards" ? (
                    <CalendarCards
                      items={
                        items
                      }
                    />
                  ) : (
                    <CalendarList
                      items={
                        items
                      }
                    />
                  )}
                </section>
              );
            },
          )}
        </div>

        {releaseDates.length ===
          0 && (
          <div className="mt-8 border border-zinc-700 px-4 py-5 text-sm text-zinc-300">
            No upcoming releases were
            found for this period.
          </div>
        )}

        <p className="mt-12 border-t border-zinc-900 pt-5 text-xs text-zinc-500">
          Release metadata and images
          provided by TMDB.
        </p>
      </section>
    </main>
  );
}

function CalendarCards({
  items,
}: {
  items: CalendarItem[];
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map(
        (item) => {
          const posterUrl =
            `https://image.tmdb.org/t/p/w185${item.posterPath}`;

          const content = (
            <>
              <img
                src={
                  posterUrl
                }
                alt={`${item.title} poster`}
                loading="lazy"
                className="h-28 w-[74px] shrink-0 object-cover"
              />

              <div className="min-w-0 flex-1 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      item.mediaType ===
                      "MOVIE"
                        ? "text-red-400"
                        : "text-blue-300"
                    }`}
                  >
                    {item.mediaType ===
                    "MOVIE"
                      ? "Movie"
                      : "TV Show"}
                  </span>

                  <span className="text-right text-[11px] font-medium text-zinc-400">
                    {item.mediaType ===
                    "MOVIE"
                      ? formatRegions(
                          item.regions,
                        )
                      : formatOriginCountries(
                          item.originCountries,
                        )}
                  </span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white">
                  {
                    item.title
                  }
                </h3>

                <p className="mt-2 text-xs font-semibold text-zinc-300">
                  {
                    item.releaseLabel
                  }
                </p>
              </div>
            </>
          );

          if (
            item.mediaType ===
            "MOVIE"
          ) {
            return (
              <Link
                key={
                  item.key
                }
                href={`/movies/${item.id}`}
                className="flex overflow-hidden border border-zinc-700 bg-zinc-950 transition hover:border-zinc-500"
              >
                {content}
              </Link>
            );
          }

          return (
            <article
              key={
                item.key
              }
              className="flex overflow-hidden border border-zinc-700 bg-zinc-950"
            >
              {content}
            </article>
          );
        },
      )}
    </div>
  );
}

function CalendarList({
  items,
}: {
  items: CalendarItem[];
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid min-h-9 grid-cols-[minmax(340px,1fr)_300px_230px] items-center border-b border-zinc-700 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
          <div>
            Title
          </div>

          <div>
            Release Event
          </div>

          <div>
            Region
          </div>
        </div>

        {items.map(
          (item) => {
            const row = (
              <div className="grid min-h-11 grid-cols-[minmax(340px,1fr)_300px_230px] items-center border-b border-zinc-800 py-1 text-sm transition hover:bg-zinc-950">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="truncate font-semibold text-white">
                      {
                        item.title
                      }
                    </span>

                    <span
                      className={`shrink-0 text-[11px] font-bold uppercase tracking-wide ${
                        item.mediaType ===
                        "MOVIE"
                          ? "text-red-400"
                          : "text-blue-300"
                      }`}
                    >
                      {item.mediaType ===
                      "MOVIE"
                        ? "Movie"
                        : "TV"}
                    </span>
                  </div>
                </div>

                <div className="font-medium text-zinc-200">
                  {
                    item.releaseLabel
                  }
                </div>

                <div className="font-medium text-zinc-300">
                  {item.mediaType ===
                  "MOVIE"
                    ? formatRegions(
                        item.regions,
                      )
                    : formatOriginCountries(
                        item.originCountries,
                      )}
                </div>
              </div>
            );

            if (
              item.mediaType ===
              "MOVIE"
            ) {
              return (
                <Link
                  key={
                    item.key
                  }
                  href={`/movies/${item.id}`}
                  className="block"
                >
                  {row}
                </Link>
              );
            }

            return (
              <div
                key={
                  item.key
                }
              >
                {row}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}