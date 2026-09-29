"use client";

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

function formatReleaseDate(
  date: string | null,
): string {
  if (!date) {
    return "Release date unavailable";
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
): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
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

function getReleaseLabel(
  detectionType: DetectionType,
  region: string | null,
): string {
  const label =
    detectionType === "CAM"
      ? "Theatrical release"
      : "Digital release";

  if (region) {
    return `${label} · ${region}`;
  }

  return label;
}

function getTimingDescription(
  detectionType: DetectionType,
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

  const [year, month, day] =
    releaseDate.split("-").map(Number);

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
  const [detections, setDetections] =
    useState(initialDetections);

  const [total, setTotal] =
    useState(initialTotal);

  const [hasMore, setHasMore] =
    useState(initialHasMore);

  const [nextOffset, setNextOffset] =
    useState(initialNextOffset);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

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
      const response = await fetch(
        `/api/detections?type=${detectionType}&limit=8&offset=${nextOffset}`,
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load more detections.",
        );
      }

      const data: DetectionApiResponse =
        await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to load more detections.",
        );
      }

      setDetections((current) => [
        ...current,
        ...data.detections,
      ]);

      setTotal(data.total);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch (loadError) {
      console.error(loadError);

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
      className="scroll-mt-8 pt-14"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-zinc-900 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-500">
            {label}
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            {title}
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            {description}
          </p>
        </div>

        <p className="shrink-0 text-xs text-zinc-600">
          {total}{" "}
          {total === 1
            ? "detection"
            : "detections"}
          {" · "}
          Most recent first
        </p>
      </div>

      {detections.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-sm text-zinc-400">
            No recent detections are currently
            available.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {detections.map((detection) => (
              <DetectionCard
                key={detection.id}
                detection={detection}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : `Load more ${detectionType} detections`}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-red-400">
              {error}
            </p>
          )}

          {!hasMore &&
            detections.length > 8 && (
              <p className="mt-6 text-center text-xs text-zinc-600">
                All {total} detections loaded.
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
  const releaseLabel =
    getReleaseLabel(
      detection.detectionType,
      detection.relevantReleaseRegion,
    );

  const timingDescription =
    getTimingDescription(
      detection.detectionType,
      detection.relevantReleaseDate,
      detection.detectedAt,
    );

  const posterUrl =
    detection.posterPath
      ? `https://image.tmdb.org/t/p/w185${detection.posterPath}`
      : null;

  return (
    <article className="group flex min-h-[165px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-700">
      <div className="w-28 shrink-0 bg-zinc-900 sm:w-32">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${detection.title} poster`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-600">
            No poster
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
              {detection.year ?? "Unknown"}
            </p>

            <h3 className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight">
              {detection.title}
            </h3>
          </div>

          <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-red-400">
            {detection.detectionType}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              {releaseLabel}
            </p>

            <p className="mt-1 text-sm font-medium text-zinc-200">
              {formatReleaseDate(
                detection.relevantReleaseDate,
              )}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Detected
            </p>

            <p className="mt-1 text-sm font-medium text-zinc-200">
              {formatDetectedDate(
                detection.detectedAt,
              )}
            </p>
          </div>
        </div>

        {timingDescription && (
          <p className="mt-4 border-t border-zinc-900 pt-3 text-xs text-zinc-400">
            {timingDescription}
          </p>
        )}

        <p className="mt-2 text-xs text-zinc-600">
          Quality{" "}
          <span className="text-zinc-400">
            {detection.quality ??
              "Unknown"}
          </span>
        </p>
      </div>
    </article>
  );
}