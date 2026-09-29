import Link from "next/link";
import { getCloudPublicDetections } from "../lib/cloudDatabase";

export const dynamic = "force-dynamic";

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  popularity?: number;
  vote_count?: number;
};

type TmdbShow = {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path: string | null;
  popularity?: number;
  vote_count?: number;
};

type UpcomingTitle = {
  id: number;
  title: string;
  mediaType: "MOVIE" | "SERIES";
  releaseDate: string;
  posterPath: string;
};

function formatDate(date: string | null): string {
  if (!date) {
    return "Date unavailable";
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatShortDate(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatDetectedDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getReleaseLabel(
  detectionType: string,
  region: string | null,
): string {
  let label = "Relevant release";

  if (detectionType === "CAM") {
    label = "Theatrical release";
  }

  if (detectionType === "WEB") {
    label = "Digital release";
  }

  if (region) {
    return `${label} · ${region}`;
  }

  return label;
}

function getTimingDescription(
  detectionType: string,
  releaseDate: string | null,
  detectedDate: string,
): string | null {
  if (!releaseDate) {
    return null;
  }

  const detected = new Date(detectedDate);

  if (Number.isNaN(detected.getTime())) {
    return null;
  }

  const [year, month, day] = releaseDate
    .split("-")
    .map(Number);

  const releaseDay = Date.UTC(
    year,
    month - 1,
    day,
  );

  const detectedDay = Date.UTC(
    detected.getUTCFullYear(),
    detected.getUTCMonth(),
    detected.getUTCDate(),
  );

  const difference = Math.round(
    (detectedDay - releaseDay) /
      (1000 * 60 * 60 * 24),
  );

  const releaseName =
    detectionType === "CAM"
      ? "theatrical release"
      : "digital release";

  if (difference === 0) {
    return `Detected on ${releaseName} day`;
  }

  if (difference === 1) {
    return `Detected 1 day after ${releaseName}`;
  }

  if (difference === -1) {
    return `Detected 1 day before ${releaseName}`;
  }

  if (difference > 1) {
    return `Detected ${difference} days after ${releaseName}`;
  }

  return `Detected ${Math.abs(
    difference,
  )} days before ${releaseName}`;
}

function getDateRange() {
  const start = new Date();

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function getUpcomingTitles(): Promise<{
  movies: UpcomingTitle[];
  shows: UpcomingTitle[];
}> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    return {
      movies: [],
      shows: [],
    };
  }

  const { startDate, endDate } = getDateRange();

  try {
    const movieRequests = [1, 2, 3].map((page) => {
      const params = new URLSearchParams({
        include_adult: "false",
        include_video: "false",
        language: "en-US",
        page: String(page),
        region: "US",
        sort_by: "popularity.desc",
        "primary_release_date.gte": startDate,
        "primary_release_date.lte": endDate,
      });

      return fetch(
        `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
          },
          next: {
            revalidate: 1800,
          },
        },
      );
    });

    const showRequests = [1, 2, 3].map((page) => {
      const params = new URLSearchParams({
        include_adult: "false",
        language: "en-US",
        page: String(page),
        sort_by: "popularity.desc",
        "first_air_date.gte": startDate,
        "first_air_date.lte": endDate,
      });

      return fetch(
        `https://api.themoviedb.org/3/discover/tv?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
          },
          next: {
            revalidate: 1800,
          },
        },
      );
    });

    const [
      movieResponses,
      showResponses,
    ] = await Promise.all([
      Promise.all(movieRequests),
      Promise.all(showRequests),
    ]);

    const moviePages = await Promise.all(
      movieResponses
        .filter((response) => response.ok)
        .map((response) => response.json()),
    );

    const showPages = await Promise.all(
      showResponses
        .filter((response) => response.ok)
        .map((response) => response.json()),
    );

    const rawMovies: TmdbMovie[] =
      moviePages.flatMap(
        (page) => page.results ?? [],
      );

    const rawShows: TmdbShow[] =
      showPages.flatMap(
        (page) => page.results ?? [],
      );

    const movies: UpcomingTitle[] = rawMovies
      .filter(
        (movie) =>
          movie.poster_path &&
          movie.release_date &&
          movie.release_date >= startDate &&
          movie.release_date <= endDate,
      )
      .slice(0, 4)
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        mediaType: "MOVIE" as const,
        releaseDate: movie.release_date ?? "",
        posterPath: movie.poster_path as string,
      }))
      .sort(
        (a, b) =>
          new Date(a.releaseDate).getTime() -
          new Date(b.releaseDate).getTime(),
      );

    const shows: UpcomingTitle[] = rawShows
      .filter(
        (show) =>
          show.poster_path &&
          show.first_air_date &&
          show.first_air_date >= startDate &&
          show.first_air_date <= endDate,
      )
      .slice(0, 4)
      .map((show) => ({
        id: show.id,
        title: show.name,
        mediaType: "SERIES" as const,
        releaseDate: show.first_air_date ?? "",
        posterPath: show.poster_path as string,
      }))
      .sort(
        (a, b) =>
          new Date(a.releaseDate).getTime() -
          new Date(b.releaseDate).getTime(),
      );

    return {
      movies,
      shows,
    };
  } catch (error) {
    console.error(
      "Upcoming titles fetch failed:",
      error,
    );

    return {
      movies: [],
      shows: [],
    };
  }
}

export default async function Home() {
  const [detections, upcoming] =
    await Promise.all([
      getCloudPublicDetections(),
      getUpcomingTitles(),
    ]);

  const camDetections = detections
    .filter(
      (movie) =>
        movie.detectionType === "CAM",
    )
    .slice(0, 3);

  const webDetections = detections
    .filter(
      (movie) =>
        movie.detectionType === "WEB",
    )
    .slice(0, 3);

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
              className="transition hover:text-white"
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

      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
            ShadowWindow
          </p>

          <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            What&apos;s Out.
            <br />
            What&apos;s Next.
          </h1>

          <p className="mt-7 text-xl font-medium text-zinc-200">
            Release intelligence, in real time.
          </p>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
            Track theatrical, digital, physical,
            streaming, and unauthorized availability
            across film and television.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/calendar"
              className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Explore Releases
            </Link>

            <Link
              href="/shadow-zone"
              className="rounded-lg border border-zinc-700 px-5 py-3 font-medium text-white transition hover:border-zinc-500"
            >
              View Shadow Zone
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
              Unauthorized Availability
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Latest Detections
            </h2>
          </div>

          <Link
            href="/shadow-zone"
            className="hidden text-sm font-medium text-zinc-400 transition hover:text-white sm:block"
          >
            View Shadow Zone →
          </Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <DetectionGroup
            title="CAM Detections"
            description="Recent theatrical-source availability."
            detections={camDetections}
          />

          <DetectionGroup
            title="WEB Detections"
            description="Recent digital-source availability."
            detections={webDetections}
          />
        </div>
      </section>

      <section className="border-t border-zinc-900">
        <div className="mx-auto w-full max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
                What&apos;s Next
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                Upcoming Releases
              </h2>

              <p className="mt-3 text-zinc-400">
                What&apos;s coming next across film and
                television.
              </p>
            </div>

            <Link
              href="/calendar"
              className="shrink-0 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              View all →
            </Link>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <UpcomingGroup
              title="Upcoming Movies"
              emptyMessage="No upcoming movies found."
              titles={upcoming.movies}
            />

            <UpcomingGroup
              title="Upcoming Series"
              emptyMessage="No upcoming series found."
              titles={upcoming.shows}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ShadowWindow</p>

          <p>
            Release intelligence across film and
            television.
          </p>
        </div>
      </footer>
    </main>
  );
}

type DetectionGroupProps = {
  title: string;
  description: string;
  detections: Awaited<
    ReturnType<typeof getCloudPublicDetections>
  >;
};

function DetectionGroup({
  title,
  description,
  detections,
}: DetectionGroupProps) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-xl font-bold">
          {title}
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          {description}
        </p>
      </div>

      {detections.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-sm text-zinc-500">
            No recent detections.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {detections.map((movie) => {
            const posterUrl = movie.posterPath
              ? `https://image.tmdb.org/t/p/w185${movie.posterPath}`
              : null;

            const releaseLabel = getReleaseLabel(
              movie.detectionType,
              movie.relevantReleaseRegion,
            );

            const timingDescription =
              getTimingDescription(
                movie.detectionType,
                movie.relevantReleaseDate,
                movie.detectedAt,
              );

            return (
              <article
                key={movie.id}
                className="flex overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-700"
              >
                <div className="w-24 shrink-0 bg-zinc-900 sm:w-28">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={`${movie.title} poster`}
                      loading="lazy"
                      className="h-full min-h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-40 items-center justify-center px-3 text-center text-xs text-zinc-600">
                      No poster
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="min-w-0 font-semibold">
                      {movie.title}
                    </h4>

                    <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                      {movie.detectionType}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                    {releaseLabel}
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    {formatDate(
                      movie.relevantReleaseDate,
                    )}
                  </p>

                  <p className="mt-3 text-xs text-zinc-500">
                    Detected{" "}
                    {formatDetectedDate(
                      movie.detectedAt,
                    )}
                  </p>

                  {timingDescription && (
                    <p className="mt-2 text-sm text-zinc-500">
                      {timingDescription}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

type UpcomingGroupProps = {
  title: string;
  emptyMessage: string;
  titles: UpcomingTitle[];
};

function UpcomingGroup({
  title,
  emptyMessage,
  titles,
}: UpcomingGroupProps) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-xl font-bold">
          {title}
        </h3>
      </div>

      {titles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-sm text-zinc-500">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          {titles.map((title, index) => {
            const posterUrl =
              `https://image.tmdb.org/t/p/w185${title.posterPath}`;

            return (
              <article
                key={`${title.mediaType}-${title.id}`}
                className={`flex items-center gap-5 p-4 ${
                  index !== titles.length - 1
                    ? "border-b border-zinc-800"
                    : ""
                }`}
              >
                <div className="w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                  <img
                    src={posterUrl}
                    alt={`${title.title} poster`}
                    loading="lazy"
                    className="aspect-[2/3] h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-red-400">
                    {formatShortDate(
                      title.releaseDate,
                    )}
                  </p>

                  <h4 className="mt-2 font-semibold text-zinc-100">
                    {title.title}
                  </h4>

                  <p className="mt-1 text-xs uppercase tracking-wider text-zinc-600">
                    {title.mediaType === "MOVIE"
                      ? "Movie"
                      : "Series premiere"}
                  </p>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="text-sm text-zinc-400">
                    {formatDate(
                      title.releaseDate,
                    )}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}