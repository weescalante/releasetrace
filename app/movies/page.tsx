import Link from "next/link";

type Region = "US" | "CA";

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
};

type TmdbResponse = {
  results: TmdbMovie[];
};

type ReleaseTraceMovie = TmdbMovie & {
  regions: Region[];
};

async function getNowPlayingMovies(region: Region) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1&region=${region}`,
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
      `TMDB request for ${region} failed with status ${response.status}.`,
    );
  }

  const data: TmdbResponse = await response.json();

  return data.results;
}

function combineMovies(
  usMovies: TmdbMovie[],
  canadaMovies: TmdbMovie[],
): ReleaseTraceMovie[] {
  const movieMap = new Map<number, ReleaseTraceMovie>();

  const addMovies = (movies: TmdbMovie[], region: Region) => {
    movies.forEach((movie) => {
      const existingMovie = movieMap.get(movie.id);

      if (existingMovie) {
        if (!existingMovie.regions.includes(region)) {
          existingMovie.regions.push(region);
        }

        return;
      }

      movieMap.set(movie.id, {
        ...movie,
        regions: [region],
      });
    });
  };

  addMovies(usMovies, "US");
  addMovies(canadaMovies, "CA");

  return Array.from(movieMap.values());
}

function formatDate(date: string) {
  if (!date) {
    return "Release date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
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

export default async function MoviesPage() {
  const [usMovies, canadaMovies] = await Promise.all([
    getNowPlayingMovies("US"),
    getNowPlayingMovies("CA"),
  ]);

  const movies = combineMovies(usMovies, canadaMovies);

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            ReleaseTrace
          </Link>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <Link href="/movies" className="text-white">
              Movies
            </Link>

            <Link href="/calendar" className="transition hover:text-white">
              Calendar
            </Link>
            <a href="/shadow-zone" className="transition hover:text-white">
              Shadow Zone
            </a>

            <a href="#" className="transition hover:text-white">
              Changes
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
          Now Playing
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Movies in theaters
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Movies currently listed as playing theatrically in the United States
          and Canada.
        </p>

        <div className="mt-12 grid gap-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {movies.map((movie) => {
            const posterUrl = movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : null;

            return (
              <Link
                key={movie.id}
                href={`/movies/${movie.id}`}
                className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
              >
                {posterUrl ? (
                  <div
                    className="aspect-[2/3] bg-cover bg-center transition duration-300 group-hover:scale-[1.02]"
                    style={{
                      backgroundImage: `url(${posterUrl})`,
                    }}
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center bg-zinc-900 text-sm text-zinc-600">
                    No poster available
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Theatrical
                    </p>

                    <p className="text-xs font-medium text-red-400">
                      {formatRegions(movie.regions)}
                    </p>
                  </div>

                  <h2 className="mt-2 text-lg font-semibold">{movie.title}</h2>

                  <div className="mt-3 flex items-center justify-between gap-4 text-sm text-zinc-500">
                    <span>{formatDate(movie.release_date)}</span>

                    {movie.vote_average > 0 && (
                      <span>{movie.vote_average.toFixed(1)} / 10</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-12 text-xs text-zinc-600">
          Movie metadata and images provided by TMDB.
        </p>
      </section>
    </main>
  );
}
