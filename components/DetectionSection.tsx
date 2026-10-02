"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DetectionType,
  PublicDetection,
} from "../lib/cloudDatabase";

type DetectionSectionProps = {
  id: string;
  label: string;
  title: string;
  description: string;
  detectionType: DetectionType;

  initialDetections: PublicDetection[];
  initialTotal: number;
  initialHasMore: boolean;
  initialNextOffset: number | null;
};

type DetectionApiResponse = {
  success: boolean;
  detections: PublicDetection[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};

type ViewMode = "cards" | "list";

type LatencyInfo = {
  short: string;
  long: string;
  className: string;
};

function formatReleaseDate(
  date: string | null,
) {
  if (!date) {
    return "Unavailable";
  }

  const parsedDate = new Date(
    `${date}T00:00:00Z`,
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(parsedDate);
}

function formatDetectedDate(
  date: string,
) {
  const parsedDate =
    new Date(date);

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
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    },
  ).format(parsedDate);
}

function formatRegion(
  region: string | null,
) {
  if (!region) {
    return null;
  }

  if (region === "US") {
    return "United States";
  }

  if (region === "CA") {
    return "Canada";
  }

  return region;
}

function getReleaseStage(
  detectionType: DetectionType,
) {
  if (detectionType === "CAM") {
    return "Theatrical";
  }

  if (detectionType === "WEB") {
    return "Digital";
  }

  return "Physical";
}

function getReleaseContext(
  detection: PublicDetection,
) {
  const stage =
    getReleaseStage(
      detection.detectionType,
    );

  const region =
    formatRegion(
      detection.relevantReleaseRegion,
    );

  return region
    ? `${stage} · ${region}`
    : stage;
}

function getTitleHref(
  detection: PublicDetection,
) {
  if (!detection.tmdbId) {
    return null;
  }

  return `/movies/${detection.tmdbId}?from=leak-detections`;
}

function getLatencyInfo(
  releaseDate: string | null,
  detectedDate: string,
): LatencyInfo {
  if (!releaseDate) {
    return {
      short: "Unavailable",
      long:
        "Release date unavailable",
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
        "Detected on release day",
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
          ? "Detected 1 day before release"
          : `Detected ${days} days before release`,

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
        ? "Detected 1 day after release"
        : `Detected ${difference} days after release`,

    className:
      "text-zinc-200",
  };
}

export default function DetectionSection({
  id,
  label,
  title,
  description,
  detectionType,
  initialDetections,
  initialTotal,
  initialHasMore,
  initialNextOffset,
}: DetectionSectionProps) {
  const [
    detections,
    setDetections,
  ] = useState(
    initialDetections,
  );

  const [
    total,
    setTotal,
  ] = useState(
    initialTotal,
  );

  const [
    hasMore,
    setHasMore,
  ] = useState(
    initialHasMore,
  );

  const [
    nextOffset,
    setNextOffset,
  ] = useState(
    initialNextOffset,
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    viewMode,
    setViewMode,
  ] = useState<ViewMode>(
    "cards",
  );

  async function loadMore() {
    if (
      loading ||
      !hasMore ||
      nextOffset === null
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/detections?type=${detectionType}&limit=8&offset=${nextOffset}`,
        );

      if (!response.ok) {
        throw new Error(
          "Unable to load more detections.",
        );
      }

      const data:
        DetectionApiResponse =
        await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to load more detections.",
        );
      }

      setDetections(
        (current) => [
          ...current,
          ...data.detections,
        ],
      );

      setTotal(
        data.total,
      );

      setHasMore(
        data.hasMore,
      );

      setNextOffset(
        data.nextOffset,
      );
    } catch (loadError) {
      console.error(
        loadError,
      );

      setError(
        "Unable to load more detections.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id={id}
      className="scroll-mt-8 pt-12"
    >
      <div className="mb-3 border-b border-zinc-800 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-500">
              {label}
            </p>

            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">
              {title}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-zinc-500">
              {total}{" "}
              {total === 1
                ? "detection"
                : "detections"}
              {" · "}
              Most recent first
            </p>

            <div className="flex rounded-md border border-zinc-700 p-0.5">
              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "cards",
                  )
                }
                className={`rounded px-3 py-1 text-xs font-medium ${
                  viewMode ===
                  "cards"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Cards
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "list",
                  )
                }
                className={`rounded px-3 py-1 text-xs font-medium ${
                  viewMode ===
                  "list"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {detections.length ===
      0 ? (
        <p className="py-4 text-sm text-zinc-400">
          No recent detections are
          currently available.
        </p>
      ) : (
        <>
          {viewMode ===
          "cards" ? (
            <div className="grid gap-1.5 lg:grid-cols-2">
              {detections.map(
                (detection) => (
                  <DetectionCard
                    key={
                      detection.id
                    }
                    detection={
                      detection
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <DetectionList
              detections={
                detections
              }
            />
          )}

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : `Load more ${detectionType} detections`}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-center text-xs text-red-400">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DetectionCard({
  detection,
}: {
  detection: PublicDetection;
}) {
  const releaseContext =
    getReleaseContext(
      detection,
    );

  const latency =
    getLatencyInfo(
      detection.relevantReleaseDate,
      detection.detectedAt,
    );

  const posterUrl =
    detection.posterPath
      ? `https://image.tmdb.org/t/p/w185${detection.posterPath}`
      : null;

  const href =
    getTitleHref(
      detection,
    );

  const content = (
    <>
      <div className="w-14 shrink-0 self-stretch bg-zinc-900">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${detection.title} poster`}
            loading="lazy"
            className="h-full min-h-[94px] w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[94px] items-center justify-center px-1 text-center text-[10px] text-zinc-500">
            No poster
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white">
              {detection.title}
            </h3>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-zinc-300">
              {detection.year && (
                <span>
                  {detection.year}
                </span>
              )}

              {detection.quality && (
                <>
                  <span className="text-zinc-600">
                    •
                  </span>

                  <span>
                    {
                      detection.quality
                    }
                  </span>
                </>
              )}
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-red-400">
            {
              detection.detectionType
            }
          </span>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_1.25fr_.75fr] gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Release
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-100">
              {formatReleaseDate(
                detection.relevantReleaseDate,
              )}
            </p>

            <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-400">
              {releaseContext}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Detected
            </p>

            <p className="mt-0.5 text-xs font-semibold leading-4 text-zinc-100">
              {formatDetectedDate(
                detection.detectedAt,
              )}
            </p>
          </div>

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Latency
            </p>

            <p
              className={`mt-0.5 text-xs font-bold ${latency.className}`}
              title={
                latency.long
              }
            >
              {
                latency.short
              }
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (!href) {
    return (
      <article className="flex overflow-hidden border border-zinc-800 bg-zinc-950/70">
        {content}
      </article>
    );
  }

  return (
    <Link
      href={href}
      className="group flex overflow-hidden border border-zinc-800 bg-zinc-950/70 transition hover:border-zinc-600 hover:bg-zinc-950"
    >
      {content}
    </Link>
  );
}

function DetectionList({
  detections,
}: {
  detections: PublicDetection[];
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1050px]">
        <div className="grid h-8 grid-cols-[minmax(280px,1fr)_170px_200px_250px_130px] items-center border-b border-zinc-700 text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-400">
          <div>
            Title
          </div>

          <div>
            Online Availability
          </div>

          <div>
            Release
          </div>

          <div>
            Detected
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

            const releaseContext =
              getReleaseContext(
                detection,
              );

            const href =
              getTitleHref(
                detection,
              );

            const row = (
              <>
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">
                      {
                        detection.title
                      }
                    </span>

                    {detection.year && (
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {
                          detection.year
                        }
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-red-400">
                    {
                      detection.detectionType
                    }
                  </span>

                  {detection.quality && (
                    <span className="text-[10px] font-medium text-zinc-300">
                      {
                        detection.quality
                      }
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-medium text-zinc-100">
                    {formatReleaseDate(
                      detection.relevantReleaseDate,
                    )}
                  </p>

                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    {
                      releaseContext
                    }
                  </p>
                </div>

                <div className="text-[11px] font-medium text-zinc-200">
                  {formatDetectedDate(
                    detection.detectedAt,
                  )}
                </div>

                <div>
                  <p
                    className={`text-[11px] font-bold ${latency.className}`}
                    title={
                      latency.long
                    }
                  >
                    {
                      latency.short
                    }
                  </p>
                </div>
              </>
            );

            if (!href) {
              return (
                <div
                  key={
                    detection.id
                  }
                  className="grid min-h-9 grid-cols-[minmax(280px,1fr)_170px_200px_250px_130px] items-center border-b border-zinc-900 text-xs"
                >
                  {row}
                </div>
              );
            }

            return (
              <Link
                key={
                  detection.id
                }
                href={href}
                className="grid min-h-9 grid-cols-[minmax(280px,1fr)_170px_200px_250px_130px] items-center border-b border-zinc-900 text-xs transition hover:bg-zinc-950"
              >
                {row}
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}