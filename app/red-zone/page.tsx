import Link from "next/link";
import { getCloudPublicDetections } from "../../lib/cloudDatabase";

export const dynamic = "force-dynamic";

function formatReleaseDate(date: string | null): string {
  if (!date) {
    return "Release date unavailable";
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
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
    return `${detectionType} detected on ${releaseName} day`;
  }

  if (difference === 1) {
    return `${detectionType} detected 1 day after ${releaseName}`;
  }

  if (difference === -1) {
    return `${detectionType} detected 1 day before ${releaseName}`;
  }

  if (difference > 1) {
    return `${detectionType} detected ${difference} days after ${releaseName}`;
  }

  return `${detectionType} detected ${Math.abs(
    difference,
  )} days before ${releaseName}`;
}

export default async function RedZonePage() {
  const movies = await getCloudPublicDetections();

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
              className="transition hover:text-white"
            >
              Calendar
            </Link>

            <Link
              href="/red-zone"
              className="text-white"
            >
              Red Zone
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
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
            Unauthorized Availability
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            The Red Zone
          </h1>

          <p className="mt-5 text-lg text-zinc-400">
            Recent unauthorized availability detections compared with official
            release dates.
          </p>
        </div>

        <section className="mt-12">
          <div className="mb-7 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
                Latest Detections
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Recently detected titles
              </h2>
            </div>

            <p className="hidden text-sm text-zinc-600 sm:block">
              Most recent first
            </p>
          </div>

          {movies.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10">
              <p className="text-zinc-400">
                No recent detections are currently available.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {movies.map((movie) => {
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

                const posterUrl = movie.posterPath
                  ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
                  : null;

                return (
                  <article
                    key={movie.id}
                    className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition duration-300 hover:border-zinc-700"
                  >
                    <div className="flex min-h-[260px] flex-col sm:flex-row">
                      <div className="relative w-full shrink-0 overflow-hidden bg-zinc-900 sm:w-44 md:w-52">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={`${movie.title} poster`}
                            loading="lazy"
                            className="h-full min-h-[300px] w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:min-h-full"
                          />
                        ) : (
                          <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center text-sm text-zinc-600 sm:min-h-full">
                            Poster unavailable
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent sm:hidden" />
                      </div>

                      <div className="flex flex-1 flex-col p-6 sm:p-7 md:p-8">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                              {movie.year ?? "Unknown"}
                            </p>

                            <h3 className="mt-2 text-2xl font-bold tracking-tight">
                              {movie.title}
                            </h3>
                          </div>

                          <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
                            {movie.detectionType}
                          </span>
                        </div>

                        <div className="mt-7 grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                              {releaseLabel}
                            </p>

                            <p className="mt-2 text-lg font-semibold text-zinc-100">
                              {formatReleaseDate(
                                movie.relevantReleaseDate,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                              Availability detected
                            </p>

                            <p className="mt-2 text-lg font-semibold text-zinc-100">
                              {formatDetectedDate(
                                movie.detectedAt,
                              )}
                            </p>
                          </div>
                        </div>

                        {timingDescription && (
                          <div className="mt-7 rounded-xl border border-zinc-800 bg-black/40 px-4 py-3">
                            <p className="text-sm font-medium text-zinc-300">
                              {timingDescription}
                            </p>
                          </div>
                        )}

                        <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-7 text-sm text-zinc-500">
                          <span>
                            Quality{" "}
                            <strong className="font-medium text-zinc-300">
                              {movie.quality ?? "Unknown"}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-16 border-t border-zinc-900 pt-6 text-xs text-zinc-600">
          ReleaseTrace reports unauthorized availability detections and official
          release timing. No unauthorized links or downloads are provided.
        </p>
      </section>
    </main>
  );
}