import Link from "next/link";

type Region = "US" | "CA";

type TmdbMovie = {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
};

type DiscoverResponse = {
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

type CalendarMovie = {
  id: number;
  title: string;
  releaseDate: string;
  posterPath: string | null;
  voteAverage: number;
  regions: Region[];
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getCandidateMovies(
  region: Region,
  startDate: string,
  endDate: string
) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
  }

  const pages = [1, 2];

  const requests = pages.map(async (page) => {
    const params = new URLSearchParams({
      language: "en-US",
      region,
      "release_date.gte": startDate,
      "release_date.lte": endDate,
      with_release_type: "2|3",
      sort_by: "release_date.asc",
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
      }
    );

    if (!response.ok) {
      throw new Error(
        `TMDB discover request for ${region} failed with status ${response.status}.`
      );
    }

    const data: DiscoverResponse = await response.json();

    return data.results;
  });

  const results = await Promise.all(requests);

  return results.flat();
}

async function getMovieReleaseDates(movieId: number) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
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
    }
  );

  if (!response.ok) {
    throw new Error(
      `TMDB release-date request for movie ${movieId} failed with status ${response.status}.`
    );
  }

  const data: ReleaseDatesResponse = await response.json();

  return data.results;
}

function findTheatricalDates(
  releaseDates: ReleaseDateRegion[],
  region: Region,
  startDate: string,
  endDate: string
) {
  const regionData = releaseDates.find(
    (item) => item.iso_3166_1 === region
  );

  if (!regionData) {
    return [];
  }

  const dates = regionData.release_dates
    .filter((release) => release.type === 2 || release.type === 3)
    .map((release) => release.release_date.slice(0, 10))
    .filter((date) => date >= startDate && date <= endDate);

  return [...new Set(dates)].sort();
}

async function buildCalendar(
  candidates: TmdbMovie[],
  startDate: string,
  endDate: string
) {
  const calendarMap = new Map<string, CalendarMovie>();

  const uniqueMovies = Array.from(
    new Map(candidates.map((movie) => [movie.id, movie])).values()
  );

  for (let index = 0; index < uniqueMovies.length; index += 10) {
    const batch = uniqueMovies.slice(index, index + 10);

    const batchResults = await Promise.all(
      batch.map(async (movie) => {
        const releaseDates = await getMovieReleaseDates(movie.id);

        const usDates = findTheatricalDates(
          releaseDates,
          "US",
          startDate,
          endDate
        );

        const canadaDates = findTheatricalDates(
          releaseDates,
          "CA",
          startDate,
          endDate
        );

        return {
          movie,
          usDates,
          canadaDates,
        };
      })
    );

    batchResults.forEach(({ movie, usDates, canadaDates }) => {
      const addRelease = (date: string, region: Region) => {
        const key = `${movie.id}-${date}`;
        const existing = calendarMap.get(key);

        if (existing) {
          if (!existing.regions.includes(region)) {
            existing.regions.push(region);
          }

          return;
        }

        calendarMap.set(key, {
          id: movie.id,
          title: movie.title,
          releaseDate: date,
          posterPath: movie.poster_path,
          voteAverage: movie.vote_average,
          regions: [region],
        });
      };

      usDates.forEach((date) => addRelease(date, "US"));
      canadaDates.forEach((date) => addRelease(date, "CA"));
    });
  }

  return Array.from(calendarMap.values()).sort((a, b) =>
    a.releaseDate.localeCompare(b.releaseDate)
  );
}

function formatDateHeading(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatRegions(regions: Region[]) {
  return regions
    .map((region) => {
      if (region === "US") {
        return "US";
      }

      return "Canada";
    })
    .join(" • ");
}

export default async function CalendarPage() {
  const today = new Date();

  const endDateObject = new Date(today);
  endDateObject.setUTCDate(endDateObject.getUTCDate() + 60);

  const startDate = toDateString(today);
  const endDate = toDateString(endDateObject);

  const [usCandidates, canadaCandidates] = await Promise.all([
    getCandidateMovies("US", startDate, endDate),
    getCandidateMovies("CA", startDate, endDate),
  ]);

  const candidates = [...usCandidates, ...canadaCandidates];

  const movies = await buildCalendar(
    candidates,
    startDate,
    endDate
  );

  const moviesByDate = movies.reduce<Record<string, CalendarMovie[]>>(
    (groups, movie) => {
      if (!groups[movie.releaseDate]) {
        groups[movie.releaseDate] = [];
      }

      groups[movie.releaseDate].push(movie);

      return groups;
    },
    {}
  );

  const releaseDates = Object.keys(moviesByDate).sort();

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            ReleaseTrace
          </Link>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <Link
              href="/movies"
              className="transition hover:text-white"
            >
              Movies
            </Link>

            <Link
              href="/calendar"
              className="text-white"
            >
              Calendar
            </Link>

            <a
              href="/red-zone"
              className="transition hover:text-white"
            >
              Red Zone
            </a>

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
          Release Calendar
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Upcoming theatrical releases
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Upcoming theatrical movie releases scheduled in the United States
          and Canada over the next 60 days.
        </p>

        <div className="mt-12 space-y-14">
          {releaseDates.map((date) => (
            <section key={date}>
              <div className="border-b border-zinc-800 pb-4">
                <p className="text-xl font-semibold">
                  {formatDateHeading(date)}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {moviesByDate[date].length}{" "}
                  {moviesByDate[date].length === 1
                    ? "release"
                    : "releases"}
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {moviesByDate[date].map((movie) => {
                  const posterUrl = movie.posterPath
                    ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
                    : null;

                  return (
                    <Link
                      key={`${movie.id}-${movie.releaseDate}`}
                      href={`/movies/${movie.id}`}
                      className="group flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
                    >
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
                          <p className="text-xs font-medium uppercase tracking-wider text-red-400">
                            {formatRegions(movie.regions)}
                          </p>

                          <h2 className="mt-2 text-lg font-semibold">
                            {movie.title}
                          </h2>
                        </div>

                        {movie.voteAverage > 0 && (
                          <p className="mt-5 text-sm text-zinc-500">
                            {movie.voteAverage.toFixed(1)} / 10
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {releaseDates.length === 0 && (
          <div className="mt-12 rounded-xl border border-zinc-800 p-8 text-zinc-400">
            No upcoming theatrical releases were found for this period.
          </div>
        )}

        <p className="mt-16 text-xs text-zinc-600">
          Movie metadata and images provided by TMDB.
        </p>
      </section>
    </main>
  );
}