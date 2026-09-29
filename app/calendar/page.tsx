import Link from "next/link";

type Region = "US" | "CA";
type MediaFilter = "all" | "movies" | "series";

type TmdbMovie = {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
};

type TmdbShow = {
  id: number;
  name: string;
  poster_path: string | null;
  vote_average: number;
  first_air_date?: string;
};

type DiscoverMovieResponse = {
  results: TmdbMovie[];
};

type DiscoverTvResponse = {
  results: TmdbShow[];
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

type CalendarItem = {
  id: number;
  title: string;
  mediaType: "MOVIE" | "SERIES";
  releaseDate: string;
  posterPath: string | null;
  voteAverage: number;
  regions: Region[];
  releaseLabel: string;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getCandidateMovies(
  region: Region,
  startDate: string,
  endDate: string,
) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const pages = [1, 2];

  const requests = pages.map(async (page) => {
    const params = new URLSearchParams({
      language: "en-US",
      region,
      "release_date.gte": startDate,
      "release_date.lte": endDate,
      with_release_type: "2|3",
      sort_by: "popularity.desc",
      include_adult: "false",
      page: page.toString(),
    });

    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json",
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

    const data: DiscoverMovieResponse =
      await response.json();

    return data.results;
  });

  const results = await Promise.all(requests);

  return results.flat();
}

async function getMovieReleaseDates(
  movieId: number,
) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}/release_dates`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
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

  const data: ReleaseDatesResponse =
    await response.json();

  return data.results;
}

function findTheatricalDates(
  releaseDates: ReleaseDateRegion[],
  region: Region,
  startDate: string,
  endDate: string,
) {
  const regionData = releaseDates.find(
    (item) => item.iso_3166_1 === region,
  );

  if (!regionData) {
    return [];
  }

  const dates = regionData.release_dates
    .filter(
      (release) =>
        release.type === 2 ||
        release.type === 3,
    )
    .map((release) =>
      release.release_date.slice(0, 10),
    )
    .filter(
      (date) =>
        date >= startDate &&
        date <= endDate,
    );

  return [...new Set(dates)].sort();
}

async function buildMovieCalendar(
  candidates: TmdbMovie[],
  startDate: string,
  endDate: string,
): Promise<CalendarItem[]> {
  const calendarMap = new Map<
    string,
    CalendarItem
  >();

  const uniqueMovies = Array.from(
    new Map(
      candidates.map((movie) => [
        movie.id,
        movie,
      ]),
    ).values(),
  );

  for (
    let index = 0;
    index < uniqueMovies.length;
    index += 10
  ) {
    const batch = uniqueMovies.slice(
      index,
      index + 10,
    );

    const batchResults = await Promise.all(
      batch.map(async (movie) => {
        try {
          const releaseDates =
            await getMovieReleaseDates(movie.id);

          const usDates = findTheatricalDates(
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
            usDates: [] as string[],
            canadaDates: [] as string[],
          };
        }
      }),
    );

    batchResults.forEach(
      ({
        movie,
        usDates,
        canadaDates,
      }) => {
        const addRelease = (
          date: string,
          region: Region,
        ) => {
          const key = `${movie.id}-${date}`;
          const existing =
            calendarMap.get(key);

          if (existing) {
            if (
              !existing.regions.includes(region)
            ) {
              existing.regions.push(region);
            }

            return;
          }

          calendarMap.set(key, {
            id: movie.id,
            title: movie.title,
            mediaType: "MOVIE",
            releaseDate: date,
            posterPath: movie.poster_path,
            voteAverage: movie.vote_average,
            regions: [region],
            releaseLabel: "Theatrical release",
          });
        };

        usDates.forEach((date) =>
          addRelease(date, "US"),
        );

        canadaDates.forEach((date) =>
          addRelease(date, "CA"),
        );
      },
    );
  }

  return Array.from(calendarMap.values());
}

async function getUpcomingSeries(
  startDate: string,
  endDate: string,
): Promise<CalendarItem[]> {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const pages = [1, 2, 3];

  const responses = await Promise.all(
    pages.map(async (page) => {
      const params = new URLSearchParams({
        include_adult: "false",
        language: "en-US",
        page: page.toString(),
        sort_by: "popularity.desc",
        "first_air_date.gte": startDate,
        "first_air_date.lte": endDate,
      });

      const response = await fetch(
        `https://api.themoviedb.org/3/discover/tv?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
          },
          next: {
            revalidate: 3600,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `TMDB TV discover request failed with status ${response.status}.`,
        );
      }

      const data: DiscoverTvResponse =
        await response.json();

      return data.results;
    }),
  );

  const uniqueShows = Array.from(
    new Map(
      responses
        .flat()
        .map((show) => [
          show.id,
          show,
        ]),
    ).values(),
  );

  return uniqueShows
    .filter(
      (show) =>
        show.first_air_date &&
        show.first_air_date >= startDate &&
        show.first_air_date <= endDate,
    )
    .map((show) => ({
      id: show.id,
      title: show.name,
      mediaType: "SERIES" as const,
      releaseDate: show.first_air_date ?? "",
      posterPath: show.poster_path,
      voteAverage: show.vote_average,
      regions: [],
      releaseLabel: "Series premiere",
    }));
}

function formatDateHeading(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function formatRegions(
  regions: Region[],
) {
  return regions
    .map((region) => {
      if (region === "US") {
        return "US";
      }

      return "Canada";
    })
    .join(" • ");
}

function getFilterHref(
  filter: MediaFilter,
) {
  if (filter === "all") {
    return "/calendar";
  }

  return `/calendar?type=${filter}`;
}

type CalendarPageProps = {
  searchParams: Promise<{
    type?: string;
  }>;
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const params = await searchParams;

  const requestedFilter = params.type;

  const activeFilter: MediaFilter =
    requestedFilter === "movies" ||
    requestedFilter === "series"
      ? requestedFilter
      : "all";

  const today = new Date();

  const endDateObject = new Date(today);
  endDateObject.setUTCDate(
    endDateObject.getUTCDate() + 60,
  );

  const startDate = toDateString(today);
  const endDate = toDateString(endDateObject);

  const [
    usCandidates,
    canadaCandidates,
    series,
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
    getUpcomingSeries(
      startDate,
      endDate,
    ),
  ]);

  const movieCandidates = [
    ...usCandidates,
    ...canadaCandidates,
  ];

  const movies =
    await buildMovieCalendar(
      movieCandidates,
      startDate,
      endDate,
    );

  const allItems = [
    ...movies,
    ...series,
  ].sort((a, b) =>
    a.releaseDate.localeCompare(
      b.releaseDate,
    ),
  );

  const filteredItems =
    allItems.filter((item) => {
      if (activeFilter === "movies") {
        return item.mediaType === "MOVIE";
      }

      if (activeFilter === "series") {
        return item.mediaType === "SERIES";
      }

      return true;
    });

  const itemsByDate =
    filteredItems.reduce<
      Record<string, CalendarItem[]>
    >((groups, item) => {
      if (!groups[item.releaseDate]) {
        groups[item.releaseDate] = [];
      }

      groups[item.releaseDate].push(item);

      return groups;
    }, {});

  const releaseDates =
    Object.keys(itemsByDate).sort();

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            ShadowWindow
          </Link>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <Link
              href="/movies"
              className="transition hover:text-white"
            >
              Titles
            </Link>

            <Link
              href="/calendar"
              className="text-white"
            >
              Calendar
            </Link>

            <Link
              href="/shadow-zone"
              className="transition hover:text-white"
            >
              Shadow Zone
            </Link>

            <a
              href="#"
              className="transition hover:text-white"
            >
              Changes
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
          What&apos;s Next
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Upcoming Releases
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Upcoming movie and series releases over the
          next 60 days.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {(
            [
              {
                value: "all",
                label: "All",
              },
              {
                value: "movies",
                label: "Movies",
              },
              {
                value: "series",
                label: "Series",
              },
            ] as {
              value: MediaFilter;
              label: string;
            }[]
          ).map((filter) => {
            const isActive =
              activeFilter === filter.value;

            return (
              <Link
                key={filter.value}
                href={getFilterHref(
                  filter.value,
                )}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-white bg-white text-black"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-12 space-y-14">
          {releaseDates.map((date) => (
            <section key={date}>
              <div className="border-b border-zinc-800 pb-4">
                <p className="text-xl font-semibold">
                  {formatDateHeading(date)}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {itemsByDate[date].length}{" "}
                  {itemsByDate[date].length === 1
                    ? "release"
                    : "releases"}
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {itemsByDate[date].map(
                  (item) => {
                    const posterUrl =
                      item.posterPath
                        ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
                        : null;

                    const cardContent = (
                      <>
                        {posterUrl ? (
                          <div
                            className="w-28 shrink-0 bg-cover bg-center sm:w-32"
                            style={{
                              backgroundImage: `url(${posterUrl})`,
                            }}
                          />
                        ) : (
                          <div className="flex w-28 shrink-0 items-center justify-center bg-zinc-900 px-3 text-center text-xs text-zinc-600 sm:w-32">
                            No poster
                          </div>
                        )}

                        <div className="flex min-h-44 flex-1 flex-col justify-between p-5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider ${
                                  item.mediaType ===
                                  "MOVIE"
                                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-300"
                                }`}
                              >
                                {item.mediaType}
                              </span>

                              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                                {
                                  item.releaseLabel
                                }
                              </span>
                            </div>

                            <h2 className="mt-3 text-lg font-semibold">
                              {item.title}
                            </h2>

                            {item.mediaType ===
                              "MOVIE" &&
                              item.regions
                                .length > 0 && (
                                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-red-400">
                                  {formatRegions(
                                    item.regions,
                                  )}
                                </p>
                              )}
                          </div>

                          {item.voteAverage >
                            0 && (
                            <p className="mt-5 text-sm text-zinc-500">
                              {item.voteAverage.toFixed(
                                1,
                              )}{" "}
                              / 10
                            </p>
                          )}
                        </div>
                      </>
                    );

                    if (
                      item.mediaType ===
                      "MOVIE"
                    ) {
                      return (
                        <Link
                          key={`movie-${item.id}-${item.releaseDate}`}
                          href={`/movies/${item.id}`}
                          className="group flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
                        >
                          {cardContent}
                        </Link>
                      );
                    }

                    return (
                      <article
                        key={`series-${item.id}-${item.releaseDate}`}
                        className="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
                      >
                        {cardContent}
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>

        {releaseDates.length === 0 && (
          <div className="mt-12 rounded-xl border border-zinc-800 p-8 text-zinc-400">
            No upcoming releases were found for
            this period.
          </div>
        )}

        <p className="mt-16 text-xs text-zinc-600">
          Release metadata and images provided by
          TMDB.
        </p>
      </section>
    </main>
  );
}