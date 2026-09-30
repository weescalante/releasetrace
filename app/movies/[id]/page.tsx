import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import SiteHeader from "../../../components/SiteHeader";

import {
  getCloudPublicDetectionsByTmdbId,
  type DetectionType,
  type PublicDetection,
} from "../../../lib/cloudDatabase";

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
  vote_count: number;
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

type Region = "US" | "CA";

type ReleaseStage =
  | "Theatrical"
  | "Digital"
  | "Physical";

type ReleaseMilestone = {
  region: Region;
  stage: ReleaseStage;
  date: string;
  certification: string;
};

type WindowMetric = {
  label: string;
  value: string;
  detail: string;
};

type LatencyInfo = {
  short: string;
  long: string;
  className: string;
};

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    from?: string;
  }>;
};

async function getMovie(
  id: string,
) {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?language=en-US`,
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

  if (
    response.status === 404
  ) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `TMDB movie request failed with status ${response.status}.`,
    );
  }

  const movie:
    TmdbMovie =
    await response.json();

  return movie;
}

async function getReleaseDates(
  id: string,
) {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${id}/release_dates`,
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
      `TMDB release date request failed with status ${response.status}.`,
    );
  }

  const data:
    ReleaseDatesResponse =
    await response.json();

  return data.results;
}

function formatDate(
  date: string,
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      `${date.slice(
        0,
        10,
      )}T00:00:00Z`,
    ),
  );
}

function formatOptionalDate(
  date: string | null,
) {
  if (!date) {
    return "Unavailable";
  }

  return formatDate(date);
}

function formatDetectedDate(
  date: string,
) {
  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    },
  ).format(parsed);
}

function formatRuntime(
  runtime: number | null,
) {
  if (!runtime) {
    return "Unavailable";
  }

  const hours =
    Math.floor(
      runtime / 60,
    );

  const minutes =
    runtime % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getYear(
  releaseDate: string,
) {
  if (!releaseDate) {
    return "Unavailable";
  }

  return releaseDate.slice(
    0,
    4,
  );
}

function formatDetectionRegion(
  region: string | null,
) {
  if (!region) {
    return "Unavailable";
  }

  if (region === "US") {
    return "United States";
  }

  if (region === "CA") {
    return "Canada";
  }

  return region;
}

function getDetectionReleaseStage(
  detectionType: DetectionType,
) {
  return detectionType === "CAM"
    ? "Theatrical"
    : "Digital";
}

function getLatencyInfo(
  releaseDate: string | null,
  detectedDate: string,
): LatencyInfo {
  if (!releaseDate) {
    return {
      short: "Unavailable",
      long:
        "Official release date unavailable",
      className:
        "text-zinc-500",
    };
  }

  const detected =
    new Date(detectedDate);

  if (
    Number.isNaN(
      detected.getTime(),
    )
  ) {
    return {
      short: "Unavailable",
      long:
        "Unable to calculate latency",
      className:
        "text-zinc-500",
    };
  }

  const [
    year,
    month,
    day,
  ] = releaseDate
    .slice(0, 10)
    .split("-")
    .map(Number);

  const releaseDay =
    Date.UTC(
      year,
      month - 1,
      day,
    );

  const detectedDay =
    Date.UTC(
      detected.getUTCFullYear(),
      detected.getUTCMonth(),
      detected.getUTCDate(),
    );

  const difference =
    Math.round(
      (detectedDay -
        releaseDay) /
        (1000 *
          60 *
          60 *
          24),
    );

  if (difference === 0) {
    return {
      short: "Same day",
      long:
        "Detected on official release day",
      className:
        "text-amber-300",
    };
  }

  if (difference < 0) {
    const days =
      Math.abs(difference);

    return {
      short:
        days === 1
          ? "1 day early"
          : `${days} days early`,

      long:
        days === 1
          ? "Detected 1 day before official release"
          : `Detected ${days} days before official release`,

      className:
        "text-red-400",
    };
  }

  return {
    short:
      difference === 1
        ? "+1 day"
        : `+${difference} days`,

    long:
      difference === 1
        ? "Detected 1 day after official release"
        : `Detected ${difference} days after official release`,

    className:
      "text-zinc-100",
  };
}

function getRegionReleases(
  releaseDates:
    ReleaseDateRegion[],
  region: Region,
) {
  const regionData =
    releaseDates.find(
      (item) =>
        item.iso_3166_1 ===
        region,
    );

  return (
    regionData?.release_dates ??
    []
  );
}

function getStageFromType(
  type: number,
): ReleaseStage | null {
  if (
    type === 2 ||
    type === 3
  ) {
    return "Theatrical";
  }

  if (type === 4) {
    return "Digital";
  }

  if (type === 5) {
    return "Physical";
  }

  return null;
}

function buildMilestones(
  releaseDates:
    ReleaseDateRegion[],
) {
  const regions: Region[] = [
    "US",
    "CA",
  ];

  const milestones:
    ReleaseMilestone[] = [];

  regions.forEach(
    (region) => {
      const releases =
        getRegionReleases(
          releaseDates,
          region,
        );

      const stages:
        ReleaseStage[] = [
        "Theatrical",
        "Digital",
        "Physical",
      ];

      stages.forEach(
        (stage) => {
          const matching =
            releases
              .filter(
                (release) =>
                  getStageFromType(
                    release.type,
                  ) === stage,
              )
              .sort(
                (a, b) =>
                  a.release_date.localeCompare(
                    b.release_date,
                  ),
              );

          const first =
            matching[0];

          if (!first) {
            return;
          }

          milestones.push({
            region,
            stage,

            date:
              first.release_date.slice(
                0,
                10,
              ),

            certification:
              first.certification,
          });
        },
      );
    },
  );

  return milestones.sort(
    (a, b) =>
      a.date.localeCompare(
        b.date,
      ),
  );
}

function getMilestone(
  milestones:
    ReleaseMilestone[],
  region: Region,
  stage: ReleaseStage,
) {
  return milestones.find(
    (milestone) =>
      milestone.region ===
        region &&
      milestone.stage ===
        stage,
  );
}

function getDaysBetween(
  startDate: string,
  endDate: string,
) {
  const start =
    new Date(
      `${startDate}T00:00:00Z`,
    ).getTime();

  const end =
    new Date(
      `${endDate}T00:00:00Z`,
    ).getTime();

  return Math.round(
    (end - start) /
      (1000 *
        60 *
        60 *
        24),
  );
}

function formatWindowValue(
  days: number,
) {
  if (days === 0) {
    return "Same day";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function buildWindowMetrics(
  milestones:
    ReleaseMilestone[],
): WindowMetric[] {
  const metrics:
    WindowMetric[] = [];

  const regions: {
    code: Region;
    name: string;
  }[] = [
    {
      code: "US",
      name:
        "United States",
    },

    {
      code: "CA",
      name: "Canada",
    },
  ];

  regions.forEach(
    ({ code, name }) => {
      const theatrical =
        getMilestone(
          milestones,
          code,
          "Theatrical",
        );

      const digital =
        getMilestone(
          milestones,
          code,
          "Digital",
        );

      const physical =
        getMilestone(
          milestones,
          code,
          "Physical",
        );

      if (
        theatrical &&
        digital
      ) {
        const days =
          getDaysBetween(
            theatrical.date,
            digital.date,
          );

        metrics.push({
          label:
            `${name}: Theatrical → Digital`,

          value:
            formatWindowValue(
              days,
            ),

          detail:
            `${formatDate(
              theatrical.date,
            )} → ${formatDate(
              digital.date,
            )}`,
        });
      }

      if (
        digital &&
        physical
      ) {
        const days =
          getDaysBetween(
            digital.date,
            physical.date,
          );

        metrics.push({
          label:
            `${name}: Digital → Physical`,

          value:
            formatWindowValue(
              days,
            ),

          detail:
            `${formatDate(
              digital.date,
            )} → ${formatDate(
              physical.date,
            )}`,
        });
      }
    },
  );

  return metrics;
}

function getRegionName(
  region: Region,
) {
  return region === "US"
    ? "United States"
    : "Canada";
}

function getStageClass(
  stage: ReleaseStage,
) {
  if (
    stage ===
    "Theatrical"
  ) {
    return "text-red-400";
  }

  if (
    stage ===
    "Digital"
  ) {
    return "text-amber-300";
  }

  return "text-zinc-300";
}

function getBackDestination(
  from: string | undefined,
  referer: string,
) {
  if (
    from ===
      "shadow-zone" ||
    referer.includes(
      "/shadow-zone",
    )
  ) {
    return {
      href:
        "/shadow-zone",
      label:
        "Back to Shadow Zone",
    };
  }

  if (
    from === "calendar" ||
    referer.includes(
      "/calendar",
    )
  ) {
    return {
      href: "/calendar",
      label:
        "Back to Release Calendar",
    };
  }

  return {
    href: "/movies",
    label:
      "Back to Movies",
  };
}

export default async function MoviePage({
  params,
  searchParams,
}: MoviePageProps) {
  const [
    routeParams,
    query,
    requestHeaders,
  ] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);

  const { id } =
    routeParams;

  const tmdbId =
    Number(id);

  const [
    movie,
    releaseDates,
    detections,
  ] = await Promise.all([
    getMovie(id),

    getReleaseDates(id),

    Number.isFinite(tmdbId)
      ? getCloudPublicDetectionsByTmdbId(
          tmdbId,
        )
      : Promise.resolve(
          [] as PublicDetection[],
        ),
  ]);

  if (!movie) {
    notFound();
  }

  const milestones =
    buildMilestones(
      releaseDates,
    );

  const metrics =
    buildWindowMetrics(
      milestones,
    );

  const posterUrl =
    movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null;

  const backdropUrl =
    movie.backdrop_path
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
      : null;

  const referer =
    requestHeaders.get(
      "referer",
    ) ?? "";

  const back =
    getBackDestination(
      query.from,
      referer,
    );

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      {backdropUrl && (
        <div
          className="h-52 bg-cover bg-center opacity-50 sm:h-72"
          style={{
            backgroundImage:
              `linear-gradient(to bottom, rgba(0,0,0,0.15), #000), url(${backdropUrl})`,
          }}
        />
      )}

      <section
        className={`mx-auto w-full max-w-7xl px-6 pb-16 ${
          backdropUrl
            ? "relative -mt-20"
            : "pt-12"
        }`}
      >
        <Link
          href={back.href}
          className="text-sm font-medium text-zinc-300 transition hover:text-white"
        >
          ← {back.label}
        </Link>

        <div className="mt-5 grid gap-7 md:grid-cols-[190px_1fr]">
          <div>
            {posterUrl ? (
              <img
                src={
                  posterUrl
                }
                alt={`${movie.title} poster`}
                className="w-full border border-zinc-800 object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center border border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
                No poster available
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-500">
              Movie Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {movie.title}
            </h1>

            <div className="mt-5 grid max-w-3xl grid-cols-2 border-y border-zinc-800 sm:grid-cols-4">
              <div className="py-3 pr-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Year
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {getYear(
                    movie.release_date,
                  )}
                </p>
              </div>

              <div className="py-3 pr-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Runtime
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {formatRuntime(
                    movie.runtime,
                  )}
                </p>
              </div>

              <div className="py-3 pr-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  TMDB Rating
                </p>

                <p className="mt-1 text-sm font-bold text-white">
                  {movie.vote_average >
                  0
                    ? `${movie.vote_average.toFixed(
                        1,
                      )} / 10`
                    : "Unrated"}
                </p>
              </div>

              <div className="py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Rating Votes
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {movie.vote_count >
                  0
                    ? movie.vote_count.toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>

            {movie.genres.length >
              0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {movie.genres.map(
                  (genre) => (
                    <span
                      key={
                        genre.id
                      }
                      className="border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300"
                    >
                      {
                        genre.name
                      }
                    </span>
                  ),
                )}
              </div>
            )}

            <OnlineAvailabilitySummary
              detections={
                detections
              }
            />

            <div className="mt-7 max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Overview
              </p>

              <p className="mt-2 text-sm leading-7 text-zinc-200">
                {movie.overview ||
                  "No overview is currently available."}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <div className="border-b border-zinc-800 pb-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
              Official Release Intelligence
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Release Milestones
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Earliest reported
              theatrical, digital and
              physical releases for the
              United States and Canada.
            </p>
          </div>

          {milestones.length >
          0 ? (
            <ReleaseList
              milestones={
                milestones
              }
            />
          ) : (
            <p className="mt-5 text-sm text-zinc-400">
              No US or Canadian
              release milestones are
              currently available.
            </p>
          )}
        </section>

        <section className="mt-12">
          <div className="border-b border-zinc-800 pb-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
              Release Windows
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Window Metrics
            </h2>
          </div>

          {metrics.length >
          0 ? (
            <div className="mt-3 divide-y divide-zinc-900">
              {metrics.map(
                (metric) => (
                  <div
                    key={
                      metric.label
                    }
                    className="grid min-h-12 gap-2 py-2 sm:grid-cols-[1fr_140px_280px] sm:items-center"
                  >
                    <p className="text-sm font-medium text-zinc-300">
                      {
                        metric.label
                      }
                    </p>

                    <p className="text-sm font-bold text-white">
                      {
                        metric.value
                      }
                    </p>

                    <p className="text-xs text-zinc-500 sm:text-right">
                      {
                        metric.detail
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-400">
              Not enough official
              release milestones are
              currently available to
              calculate release-window
              metrics.
            </p>
          )}
        </section>

        <DetectionHistory
          detections={
            detections
          }
        />

        <p className="mt-12 border-t border-zinc-900 pt-5 text-xs text-zinc-500">
          Movie metadata, ratings and
          images provided by TMDB.
          ShadowWindow detection data is
          derived from monitored
          unauthorized-availability
          observations.
        </p>
      </section>
    </main>
  );
}

function OnlineAvailabilitySummary({
  detections,
}: {
  detections:
    PublicDetection[];
}) {
  const camDetections =
    detections.filter(
      (detection) =>
        detection.detectionType ===
        "CAM",
    );

  const webDetections =
    detections.filter(
      (detection) =>
        detection.detectionType ===
        "WEB",
    );

  const firstCam =
    camDetections[0] ??
    null;

  const firstWeb =
    webDetections[0] ??
    null;

  let status =
    "No Detection";

  let statusClass =
    "text-zinc-400";

  if (
    firstCam &&
    firstWeb
  ) {
    status = "CAM → WEB";
    statusClass =
      "text-amber-300";
  } else if (firstWeb) {
    status =
      "WEB Available";
    statusClass =
      "text-amber-300";
  } else if (firstCam) {
    status =
      "CAM Available";
    statusClass =
      "text-red-400";
  }

  return (
    <section className="mt-6 max-w-4xl border-y border-zinc-700 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
            Online Availability
          </p>

          <p
            className={`mt-1 text-xl font-bold ${statusClass}`}
          >
            {status}
          </p>
        </div>

        {detections.length >
          0 && (
          <p className="text-xs font-medium text-zinc-400">
            {
              detections.length
            }{" "}
            {detections.length ===
            1
              ? "detection"
              : "detections"}{" "}
            recorded
          </p>
        )}
      </div>

      {detections.length ===
      0 ? (
        <p className="mt-3 text-sm text-zinc-400">
          No CAM or WEB availability
          has been detected by
          ShadowWindow for this title.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {firstCam && (
            <AvailabilityBlock
              label="CAM"
              detection={
                firstCam
              }
            />
          )}

          {firstWeb && (
            <AvailabilityBlock
              label="WEB"
              detection={
                firstWeb
              }
            />
          )}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-zinc-500">
        Online availability may be
        observed across unauthorized
        streaming services, torrent
        indexes, cyberlockers and
        file-hosting services. Specific
        monitored sources and
        unauthorized links are not
        published.
      </p>
    </section>
  );
}

function AvailabilityBlock({
  label,
  detection,
}: {
  label: DetectionType;
  detection:
    PublicDetection;
}) {
  const latency =
    getLatencyInfo(
      detection.relevantReleaseDate,
      detection.detectedAt,
    );

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
          {label}
        </span>

        <span className="text-sm font-semibold text-zinc-200">
          {detection.quality ||
            "Quality unavailable"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
        <InfoItem
          label="First Detected"
          value={formatDetectedDate(
            detection.detectedAt,
          )}
        />

        <InfoItem
          label="Official Release"
          value={formatOptionalDate(
            detection.relevantReleaseDate,
          )}
        />

        <InfoItem
          label="Region"
          value={formatDetectionRegion(
            detection.relevantReleaseRegion,
          )}
        />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Latency
          </p>

          <p
            className={`mt-1 text-sm font-bold ${latency.className}`}
            title={
              latency.long
            }
          >
            {latency.short}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium leading-5 text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function DetectionHistory({
  detections,
}: {
  detections:
    PublicDetection[];
}) {
  const hasCam =
    detections.some(
      (detection) =>
        detection.detectionType ===
        "CAM",
    );

  const hasWeb =
    detections.some(
      (detection) =>
        detection.detectionType ===
        "WEB",
    );

  let progression =
    "No progression recorded";

  if (
    hasCam &&
    hasWeb
  ) {
    progression =
      "CAM → WEB";
  } else if (hasCam) {
    progression =
      "CAM";
  } else if (hasWeb) {
    progression =
      "WEB";
  }

  return (
    <section className="mt-12">
      <div className="border-b border-zinc-800 pb-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
          Shadow Intelligence
        </p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Detection History
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Recorded unauthorized
              availability for this
              title in chronological
              order.
            </p>
          </div>

          {detections.length >
            0 && (
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Detection Progression
              </p>

              <p className="mt-1 text-sm font-bold text-white">
                {progression}
              </p>
            </div>
          )}
        </div>
      </div>

      {detections.length ===
      0 ? (
        <div className="border-b border-zinc-900 py-4">
          <p className="text-sm font-medium text-zinc-300">
            No ShadowWindow
            detection data is
            currently connected to
            this title.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="grid h-9 grid-cols-[230px_150px_150px_180px_170px_120px] items-center border-b border-zinc-700 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              <div>
                Detected
              </div>

              <div>
                Online Availability
              </div>

              <div>
                Quality
              </div>

              <div>
                Official Release
              </div>

              <div>
                Region
              </div>

              <div>
                Latency
              </div>
            </div>

            {detections.map(
              (detection) => {
                const latency =
                  getLatencyInfo(
                    detection.relevantReleaseDate,
                    detection.detectedAt,
                  );

                return (
                  <div
                    key={
                      detection.id
                    }
                    className="grid min-h-12 grid-cols-[230px_150px_150px_180px_170px_120px] items-center border-b border-zinc-900 text-sm"
                  >
                    <div className="pr-3 font-medium text-zinc-200">
                      {formatDetectedDate(
                        detection.detectedAt,
                      )}
                    </div>

                    <div>
                      <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400">
                        {
                          detection.detectionType
                        }
                      </span>
                    </div>

                    <div className="font-medium text-zinc-300">
                      {detection.quality ||
                        "Unavailable"}
                    </div>

                    <div>
                      <p className="font-medium text-zinc-200">
                        {formatOptionalDate(
                          detection.relevantReleaseDate,
                        )}
                      </p>

                      <p className="mt-0.5 text-xs text-zinc-500">
                        {getDetectionReleaseStage(
                          detection.detectionType,
                        )}
                      </p>
                    </div>

                    <div className="font-medium text-zinc-300">
                      {formatDetectionRegion(
                        detection.relevantReleaseRegion,
                      )}
                    </div>

                    <div
                      className={`font-bold ${latency.className}`}
                      title={
                        latency.long
                      }
                    >
                      {
                        latency.short
                      }
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReleaseList({
  milestones,
}: {
  milestones:
    ReleaseMilestone[];
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid h-9 grid-cols-[180px_160px_190px_1fr] items-center border-b border-zinc-700 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
          <div>
            Region
          </div>

          <div>
            Release
          </div>

          <div>
            Date
          </div>

          <div>
            Certification
          </div>
        </div>

        {milestones.map(
          (
            milestone,
            index,
          ) => (
            <div
              key={`${milestone.region}-${milestone.stage}-${milestone.date}-${index}`}
              className="grid h-11 grid-cols-[180px_160px_190px_1fr] items-center border-b border-zinc-900 text-sm"
            >
              <div className="font-medium text-zinc-300">
                {getRegionName(
                  milestone.region,
                )}
              </div>

              <div
                className={`font-semibold ${getStageClass(
                  milestone.stage,
                )}`}
              >
                {
                  milestone.stage
                }
              </div>

              <div className="font-medium text-zinc-200">
                {formatDate(
                  milestone.date,
                )}
              </div>

              <div className="text-zinc-400">
                {milestone.certification ||
                  "—"}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}