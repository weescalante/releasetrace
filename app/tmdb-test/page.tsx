type TmdbMovie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

type TmdbResponse = {
  results: TmdbMovie[];
};

async function getNowPlayingMovies() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is missing.");
  }

  const response = await fetch(
    "https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1&region=CA",
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
    throw new Error(`TMDB request failed with status ${response.status}.`);
  }

  const data: TmdbResponse = await response.json();

  return data.results.slice(0, 8);
}

export default async function TmdbTestPage() {
  const movies = await getNowPlayingMovies();

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
          TMDB Connection Test
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Movies now playing in Canada
        </h1>

        <p className="mt-4 text-zinc-400">
          This data is being loaded live from TMDB.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {movies.map((movie) => {
            const posterUrl = movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : null;

            return (
              <article
                key={movie.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
              >
                {posterUrl ? (
                  <div
                    className="aspect-[2/3] bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${posterUrl})`,
                    }}
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center bg-zinc-900 text-zinc-600">
                    No poster
                  </div>
                )}

                <div className="p-5">
                  <h2 className="text-lg font-semibold">
                    {movie.title}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {movie.release_date || "Release date unavailable"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}