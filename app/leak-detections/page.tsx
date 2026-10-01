import DetectionSection from "../../components/DetectionSection";
import SiteHeader from "../../components/SiteHeader";

import {
  getCloudPublicDetectionsPage,
} from "../../lib/cloudDatabase";

import {
  getFeedStatus,
} from "../../lib/feedStatus";

export const dynamic = "force-dynamic";

function formatTimeAgo(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const differenceMs =
    Date.now() -
    date.getTime();

  const differenceMinutes =
    Math.max(
      0,
      Math.floor(
        differenceMs /
          (1000 * 60),
      ),
    );

  if (differenceMinutes < 1) {
    return "just now";
  }

  if (differenceMinutes === 1) {
    return "1 minute ago";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes} minutes ago`;
  }

  const differenceHours =
    Math.floor(
      differenceMinutes /
        60,
    );

  if (differenceHours === 1) {
    return "1 hour ago";
  }

  if (differenceHours < 24) {
    return `${differenceHours} hours ago`;
  }

  const differenceDays =
    Math.floor(
      differenceHours /
        24,
    );

  if (differenceDays === 1) {
    return "1 day ago";
  }

  return `${differenceDays} days ago`;
}

function getFeedHealth(
  lastSuccessfulAt: string | null,
) {
  if (!lastSuccessfulAt) {
    return {
      label: "Awaiting Update",
      className:
        "text-zinc-400",
    };
  }

  const date =
    new Date(
      lastSuccessfulAt,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return {
      label: "Unknown",
      className:
        "text-zinc-400",
    };
  }

  const ageMinutes =
    (Date.now() -
      date.getTime()) /
    (1000 * 60);

  if (ageMinutes <= 30) {
    return {
      label: "Live",
      className:
        "text-emerald-400",
    };
  }

  if (ageMinutes <= 90) {
    return {
      label: "Delayed",
      className:
        "text-amber-300",
    };
  }

  return {
    label: "Stale",
    className:
      "text-red-400",
  };
}

export default async function LeakDetectionsPage() {
  const [
    camPage,
    webPage,
    cinemaCityStatus,
  ] = await Promise.all([
    getCloudPublicDetectionsPage({
      detectionType: "CAM",
      limit: 8,
      offset: 0,
    }),

    getCloudPublicDetectionsPage({
      detectionType: "WEB",
      limit: 8,
      offset: 0,
    }),

    getFeedStatus(
      "CinemaCity",
    ),
  ]);

  const lastSuccessfulAt =
    cinemaCityStatus
      ?.lastSuccessfulAt ??
    null;

  const feedHealth =
    getFeedHealth(
      lastSuccessfulAt,
    );

  const lastUpdated =
    formatTimeAgo(
      lastSuccessfulAt,
    );

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
            Unauthorized Availability
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Leak Detections
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
            Track when unauthorized
            versions of films and
            television titles appear
            online compared with their
            official release timing.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-y border-zinc-800 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Feed Status
            </span>

            <span
              className={`text-sm font-bold ${feedHealth.className}`}
            >
              {feedHealth.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Last Updated
            </span>

            <span className="text-sm font-semibold text-zinc-200">
              {lastUpdated ??
                "Not available yet"}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#cam"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            CAM Detections
          </a>

          <a
            href="#web"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            WEB Detections
          </a>
        </div>

        <DetectionSection
          id="cam"
          label="Theatrical Availability"
          title="CAM Detections"
          description="Unauthorized camera-source availability compared with official theatrical release dates."
          detectionType="CAM"
          initialDetections={
            camPage.detections
          }
          initialTotal={
            camPage.total
          }
          initialHasMore={
            camPage.hasMore
          }
          initialNextOffset={
            camPage.nextOffset
          }
        />

        <DetectionSection
          id="web"
          label="Digital Availability"
          title="WEB Detections"
          description="Unauthorized digital-source availability compared with official digital release dates."
          detectionType="WEB"
          initialDetections={
            webPage.detections
          }
          initialTotal={
            webPage.total
          }
          initialHasMore={
            webPage.hasMore
          }
          initialNextOffset={
            webPage.nextOffset
          }
        />

        <p className="mt-14 border-t border-zinc-900 pt-5 text-xs leading-6 text-zinc-600">
          Watch Leaks reports
          unauthorized availability
          detections and official release
          timing. No unauthorized links
          or downloads are provided.
        </p>
      </section>
    </main>
  );
}