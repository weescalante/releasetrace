import { notFound } from "next/navigation";

type Genre = {
  id: number;
  name: string;
};

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  runtime: number | null;
  genres: Genre[];
};

type ReleaseDate = {
  certification: string;
  iso_639_1: string;
  release_date: string;
  type: number;
  note: string;
};

type ReleaseDateRegion = {
  iso_3166_1: string;
  release_dates: ReleaseDate[];
};

type ReleaseDatesResponse = {
  results: ReleaseDateRegion[];
};

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getMovie(id: string) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?language=en-US`,
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

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`TMDB movie request failed with status ${response.status}.`);
  }

  const movie: TmdbMovie = await response.json();

  return movie;
}

async function getReleaseDates(id: string) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${id}/release_dates`,
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
      `TMDB release date request failed with status ${response.status}.`
    );
  }

  const data: ReleaseDatesResponse = await response.json();

  return data.results;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function formatRuntime(runtime: number | null) {
  if (!runtime) {
    return "Runtime unavailable";
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getReleaseType(type: number) {
  switch (type) {
    case 1:
      return "Premiere";
    case 2:
      return "Limited Theatrical";
    case 3:
      return "Theatrical";
    case 4:
      return "Digital";
    case 5:
      return "Physical";
    case 6:
      return "TV";
    default:
      return "Other";
  }
}

function getRegionReleases(
  releaseDates: ReleaseDateRegion[],
  region: "US" | "CA"
) {
  const regionData = releaseDates.find(
    (item) => item.iso_3166_1 === region
  );

  if (!regionData) {
    return [];
  }

  return regionData.release_dates;
}

export default async function MoviePage({
  params,
}: MoviePageProps) {
  const { id } = await params;

  const [movie, releaseDates] = await Promise.all([
    getMovie(id),
    getReleaseDates(id),
  ]);

  if (!movie) {
    notFound();
  }

  const usReleases = getRegionReleases(releaseDates, "US");
  const canadaReleases = getRegionReleases(releaseDates, "CA");

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-bold tracking-tight">
            ReleaseTrace
          </a>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <a href="/movies" className="transition hover:text-white">
              Movies
            </a>

            <a href="/calendar" className="transition hover:text-white">
              Calendar
            </a>

            <a href="/red-zone" className="transition hover:text-white">
              Red Zone
            </a>

            <a href="#" className="transition hover:text-white">
              Changes
            </a>
          </nav>
        </div>
      </header>

      {backdropUrl && (
        <div
          className="h-[320px] bg-cover bg-center sm:h-[420px]"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), #000), url(${backdropUrl})`,
          }}
        />
      )}

      <section
        className={`mx-auto w-full max-w-7xl px-6 pb-20 ${
          backdropUrl ? "-mt-32 relative" : "py-16"
        }`}
      >
        <a
          href="/movies"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          ← Back to Movies
        </a>

        <div className="mt-8 grid gap-10 md:grid-cols-[280px_1fr]">
          <div>
            {posterUrl ? (
              <div
                className="aspect-[2/3] rounded-xl border border-zinc-800 bg-cover bg-center shadow-2xl"
                style={{
                  backgroundImage: `url(${posterUrl})`,
                }}
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                No poster available
              </div>
            )}
          </div>

          <div className="pt-2">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
              Movie
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {movie.title}
            </h1>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
              <span>
                {movie.release_date
                  ? new Date(`${movie.release_date}T00:00:00`).getFullYear()
                  : "Year unavailable"}
              </span>

              <span>{formatRuntime(movie.runtime)}</span>

              {movie.vote_average > 0 && (
                <span>{movie.vote_average.toFixed(1)} / 10</span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400"
                >
                  {genre.name}
                </span>
              ))}
            </div>

            <p className="mt-8 max-w-3xl text-lg leading-8 text-zinc-300">
              {movie.overview || "No overview is currently available."}
            </p>

            <div className="mt-12">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
                ReleaseTrace
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Release timeline
              </h2>

              <p className="mt-3 max-w-2xl text-zinc-400">
                Official release information currently reported for the United
                States and Canada.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <h3 className="text-xl font-semibold">
                  United States
                </h3>

                {usReleases.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {usReleases.map((release, index) => (
                      <div
                        key={`${release.release_date}-${release.type}-${index}`}
                        className="border-b border-zinc-800 pb-4 last:border-0 last:pb-0"
                      >
                        <p className="font-medium">
                          {getReleaseType(release.type)}
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                          {formatDate(release.release_date)}
                        </p>

                        {release.certification && (
                          <p className="mt-1 text-xs text-zinc-600">
                            Rating: {release.certification}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-zinc-500">
                    No US release information available.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <h3 className="text-xl font-semibold">
                  Canada
                </h3>

                {canadaReleases.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {canadaReleases.map((release, index) => (
                      <div
                        key={`${release.release_date}-${release.type}-${index}`}
                        className="border-b border-zinc-800 pb-4 last:border-0 last:pb-0"
                      >
                        <p className="font-medium">
                          {getReleaseType(release.type)}
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                          {formatDate(release.release_date)}
                        </p>

                        {release.certification && (
                          <p className="mt-1 text-xs text-zinc-600">
                            Rating: {release.certification}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-zinc-500">
                    No Canadian release information available.
                  </p>
                )}
              </section>
            </div>

            <div className="mt-10 rounded-xl border border-zinc-800 p-6">
              <p className="text-sm font-medium text-zinc-300">
                Unauthorized availability
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                No ReleaseTrace monitoring data has been connected to this
                title yet.
              </p>
            </div>

            <p className="mt-8 text-xs text-zinc-600">
              Movie metadata and images provided by TMDB.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}