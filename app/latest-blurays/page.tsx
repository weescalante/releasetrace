import DetectionSection from "../../components/DetectionSection";
import SiteHeader from "../../components/SiteHeader";

import {
  getCloudPublicDetectionsPage,
} from "../../lib/cloudDatabase";

export const dynamic =
  "force-dynamic";

export default async function LatestBluraysPage() {
  const blurayPage =
    await getCloudPublicDetectionsPage({
      detectionType:
        "BLURAY",

      limit:
        20,

      offset:
        0,
    });

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
            Real-Time Blu-ray Intelligence
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Latest Blu-rays
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            The latest Blu-ray and physical-release
            availability detected across monitored
            release sources, ordered by newest
            detection first and refreshed every
            15 minutes.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-y border-zinc-800 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Status
            </span>

            <span className="text-sm font-bold text-emerald-400">
              Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Refresh
            </span>

            <span className="text-sm font-semibold text-zinc-200">
              Every 15 minutes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Order
            </span>

            <span className="text-sm font-semibold text-zinc-200">
              Latest first
            </span>
          </div>
        </div>

        <DetectionSection
          id="latest-blurays"
          label="Latest Availability"
          title="Blu-ray Detections"
          description="A revolving feed of the most recently detected Blu-ray and physical-release availability."
          detectionType="BLURAY"
          initialDetections={
            blurayPage.detections
          }
          initialTotal={
            blurayPage.total
          }
          initialHasMore={
            blurayPage.hasMore
          }
          initialNextOffset={
            blurayPage.nextOffset
          }
        />

        <p className="mt-14 border-t border-zinc-900 pt-5 text-xs leading-6 text-zinc-600">
          Watch Leaks reports detection
          timing and official release
          intelligence. Specific monitored
          sources and unauthorized links
          are not published.
        </p>
      </section>
    </main>
  );
}