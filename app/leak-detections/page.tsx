import type { Metadata } from "next";
import Link from "next/link";

import DetectionSection from "../../components/DetectionSection";
import SiteHeader from "../../components/SiteHeader";

import {
  getCloudPublicDetectionsPage,
} from "../../lib/cloudDatabase";

import {
  getFeedStatus,
} from "../../lib/feedStatus";

export const metadata: Metadata = {
  title: "Leak Detections",

  description:
    "Track the latest CAM and WEB availability detected by Watch Leaks and compare detection timing with official theatrical and digital releases.",

  alternates: {
    canonical:
      "https://watchleaks.com/leak-detections",
  },

  openGraph: {
    title:
      "Leak Detections | Watch Leaks",

    description:
      "Track the latest CAM and WEB availability detected by Watch Leaks and compare detection timing with official theatrical and digital releases.",

    url:
      "https://watchleaks.com/leak-detections",

    type:
      "website",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Leak Detections | Watch Leaks",

    description:
      "Track the latest CAM and WEB availability detected by Watch Leaks and compare detection timing with official theatrical and digital releases.",
  },
};

export const dynamic =
  "force-dynamic";

function formatTimeAgo(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

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

  if (
    differenceMinutes <
    1
  ) {
    return "just now";
  }

  if (
    differenceMinutes ===
    1
  ) {
    return "1 minute ago";
  }

  if (
    differenceMinutes <
    60
  ) {
    return `${differenceMinutes} minutes ago`;
  }

  const differenceHours =
    Math.floor(
      differenceMinutes /
        60,
    );

  if (
    differenceHours ===
    1
  ) {
    return "1 hour ago";
  }

  if (
    differenceHours <
    24
  ) {
    return `${differenceHours} hours ago`;
  }

  const differenceDays =
    Math.floor(
      differenceHours /
        24,
    );

  if (
    differenceDays ===
    1
  ) {
    return "1 day ago";
  }

  return `${differenceDays} days ago`;
}

function getFeedHealth(
  lastSuccessfulAt:
    string | null,
) {
  if (!lastSuccessfulAt) {
    return {
      label:
        "Awaiting Update",

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
      label:
        "Unknown",

      className:
        "text-zinc-400",
    };
  }

  const ageMinutes =
    (
      Date.now() -
      date.getTime()
    ) /
    (
      1000 *
      60
    );

  if (
    ageMinutes <=
    30
  ) {
    return {
      label:
        "Live",

      className:
        "text-emerald-400",
    };
  }

  if (
    ageMinutes <=
    90
  ) {
    return {
      label:
        "Updating",

      className:
        "text-amber-300",
    };
  }

  return {
    label:
      "Delayed",

    className:
      "text-red-400",
  };
}

export default async function LeakDetectionsPage() {
  const [
    camPage,
    webPage,
    cinemaCityStatus,
  ] =
    await Promise.all([
      getCloudPublicDetectionsPage({
        detectionType:
          "CAM",

        limit:
          6,

        offset:
          0,
      }),

      getCloudPublicDetectionsPage({
        detectionType:
          "WEB",

        limit:
          6,

        offset:
          0,
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
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
            Real-Time Release Intelligence
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Leak Detections
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            Track the latest CAM and WEB
            availability as it is detected,
            compared with official theatrical
            and digital release timing.
          </p>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            Watch Leaks monitors multiple
            release signals and refreshes
            detection intelligence every
            15 minutes.
          </p>
        </div>

        <div className="mt-6 grid border-y border-zinc-800 sm:grid-cols-3">
          <div className="border-b border-zinc-800 py-3 sm:border-b-0 sm:border-r sm:pr-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Status
            </p>

            <div className="mt-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>

              <span
                className={`text-sm font-bold ${feedHealth.className}`}
              >
                {
                  feedHealth.label
                }
              </span>
            </div>
          </div>

          <div className="border-b border-zinc-800 py-3 sm:border-b-0 sm:border-r sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Last Updated
            </p>

            <p className="mt-1 text-sm font-semibold text-zinc-200">
              {
                lastUpdated ??
                "Not available yet"
              }
            </p>
          </div>

          <div className="py-3 sm:pl-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Refresh Cycle
            </p>

            <p className="mt-1 text-sm font-semibold text-zinc-200">
              Every 15 minutes
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <a
            href="#latest-cams"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Latest Cams
          </a>

          <a
            href="#latest-web"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Latest Web
          </a>

          <Link
            href="/latest-blurays"
            className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-white"
          >
            Latest Blu-rays →
          </Link>
        </div>

        <div
          id="latest-cams"
          className="scroll-mt-8"
        >
          <DetectionSection
            id="cam"
            label="Real-Time CAM Availability"
            title="Latest CAM Detections"
            description="The newest camera-source availability detected by Watch Leaks."
            detectionType="CAM"
            initialDetections={
              camPage.detections
            }
            initialTotal={
              camPage.total
            }
            initialHasMore={
              false
            }
            initialNextOffset={
              null
            }
          />

          <div className="mt-4 flex justify-end">
            <Link
              href="/latest-cams"
              className="group inline-flex items-center gap-2 text-sm font-bold text-zinc-300 transition hover:text-white"
            >
              View all CAM detections

              <span className="transition group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>

        <div
          id="latest-web"
          className="scroll-mt-8"
        >
          <DetectionSection
            id="web"
            label="Real-Time WEB Availability"
            title="Latest WEB Detections"
            description="The newest digital-source availability detected by Watch Leaks."
            detectionType="WEB"
            initialDetections={
              webPage.detections
            }
            initialTotal={
              webPage.total
            }
            initialHasMore={
              false
            }
            initialNextOffset={
              null
            }
          />

          <div className="mt-4 flex justify-end">
            <Link
              href="/latest-web"
              className="group inline-flex items-center gap-2 text-sm font-bold text-zinc-300 transition hover:text-white"
            >
              View all WEB detections

              <span className="transition group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>

        <section className="mt-14 border-y border-zinc-800 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Physical Release Intelligence
              </p>

              <h2 className="mt-2 text-xl font-bold text-white">
                Latest Blu-rays
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
                Follow the newest Blu-ray
                availability in its dedicated
                real-time feed.
              </p>
            </div>

            <Link
              href="/latest-blurays"
              className="shrink-0 border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              View Latest Blu-rays →
            </Link>
          </div>
        </section>

        <p className="mt-10 border-t border-zinc-900 pt-5 text-xs leading-6 text-zinc-600">
          Watch Leaks reports unauthorized
          availability detections and official
          release timing. Specific monitored
          sources and unauthorized links are
          not published.
        </p>
      </section>
    </main>
  );
}