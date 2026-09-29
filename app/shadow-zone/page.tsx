import Link from "next/link";
import DetectionSection from "../../components/DetectionSection";
import { getCloudPublicDetectionsPage } from "../../lib/cloudDatabase";

export const dynamic = "force-dynamic";

export default async function ShadowZonePage() {
  const [camPage, webPage] =
    await Promise.all([
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
    ]);

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
              className="text-white"
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

      <section className="mx-auto w-full max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
            Unauthorized Availability
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            The Shadow Zone
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
            Unauthorized availability detections
            compared with official release timing
            across film and television.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="#cam"
            className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            CAM Detections
          </a>

          <a
            href="#web"
            className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            WEB Detections
          </a>
        </div>

        <DetectionSection
          id="cam"
          label="Theatrical Availability"
          title="CAM Detections"
          description="Unauthorized theatrical-source availability compared with official theatrical release dates."
          detectionType="CAM"
          initialDetections={
            camPage.detections
          }
          initialTotal={camPage.total}
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
          initialTotal={webPage.total}
          initialHasMore={
            webPage.hasMore
          }
          initialNextOffset={
            webPage.nextOffset
          }
        />

        <p className="mt-16 border-t border-zinc-900 pt-6 text-xs leading-6 text-zinc-600">
          ShadowWindow reports unauthorized
          availability detections and official
          release timing. No unauthorized links
          or downloads are provided.
        </p>
      </section>
    </main>
  );
}