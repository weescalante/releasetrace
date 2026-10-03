import type {
  Metadata,
} from "next";

import SiteHeader from "../../components/SiteHeader";

export const metadata:
Metadata = {
  title:
    "About | Watch Leaks",

  description:
    "Learn how Watch Leaks tracks release timing and detected CAM, WEB, and Blu-ray availability across film and television.",

  alternates: {
    canonical:
      "https://watchleaks.com/about",
  },

  openGraph: {
    title:
      "About Watch Leaks",

    description:
      "How Watch Leaks tracks official release timing and detected availability across film and television.",

    url:
      "https://watchleaks.com/about",

    siteName:
      "Watch Leaks",

    type:
      "website",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
            About Watch Leaks
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Release intelligence,
            explained.
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-300">
            Watch Leaks tracks when
            film and television titles
            become available across
            different release stages
            and compares those signals
            with official release
            timing.
          </p>

          <p className="mt-4 text-base leading-7 text-zinc-500">
            The goal is to provide a
            clear historical record of
            when availability was first
            detected, without
            publishing the monitored
            sources or links to
            unauthorized content.
          </p>
        </div>

        <div className="mt-12 grid gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-3">
          <div className="bg-black p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
              CAM
            </p>

            <h2 className="mt-3 text-lg font-bold">
              Camera-source detection
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              A CAM detection records
              when camera-source
              availability for a title
              is first detected and
              compares that timing with
              its official theatrical
              release.
            </p>
          </div>

          <div className="bg-black p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
              WEB
            </p>

            <h2 className="mt-3 text-lg font-bold">
              Digital-source detection
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              A WEB detection records
              when digital-source
              availability is first
              detected and compares it
              with known official
              digital release timing.
            </p>
          </div>

          <div className="bg-black p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
              BLU-RAY
            </p>

            <h2 className="mt-3 text-lg font-bold">
              Physical-release detection
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Blu-ray detections track
              physical-release
              availability and compare
              detected timing with
              official physical release
              information when
              available.
            </p>
          </div>
        </div>

        <section className="mt-14 border-t border-zinc-800 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Methodology
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            How detection timing works
          </h2>

          <div className="mt-6 space-y-5 text-base leading-7 text-zinc-400">
            <p>
              Watch Leaks continuously
              processes release signals
              from monitored sources.
              When qualifying
              availability is detected,
              the system attempts to
              identify the corresponding
              movie or television title
              and records the earliest
              verified detection time.
            </p>

            <p>
              Title identity and release
              information are
              cross-referenced against
              structured entertainment
              metadata before detections
              are presented publicly.
            </p>

            <p>
              Official theatrical,
              digital, physical, and
              episode-release dates are
              used where available to
              calculate the timing
              difference between an
              official release and a
              detection.
            </p>

            <p>
              Because release dates can
              differ by territory,
              platform, format, and
              distributor, some titles
              may show an unavailable
              release date when a
              sufficiently reliable
              comparison date has not
              been established.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            What Watch Leaks Does Not Do
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Detection intelligence,
            not distribution.
          </h2>

          <div className="mt-6 space-y-5 text-base leading-7 text-zinc-400">
            <p>
              Watch Leaks does not host,
              distribute, stream, or
              provide download links to
              unauthorized copies of
              films or television
              programs.
            </p>

            <p>
              Specific monitored sources
              and unauthorized links are
              intentionally not
              published.
            </p>

            <p>
              Public pages report
              detection timing,
              availability type, title
              identity, and relevant
              official release
              information for
              informational and research
              purposes.
            </p>
          </div>
        </section>

        <section className="mt-14 border-y border-zinc-800 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Refresh Cycle
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Continuously updated
            intelligence
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
            Watch Leaks processes
            automated detection feeds
            throughout the day. Public
            detection pages are designed
            to surface newly verified
            availability as the
            underlying intelligence is
            refreshed.
          </p>
        </section>

        <p className="mt-10 text-xs leading-6 text-zinc-600">
          Watch Leaks is an independent
          release-intelligence project.
          It is not affiliated with
          studios, distributors,
          streaming platforms, or
          metadata providers referenced
          by the service.
        </p>
      </section>
    </main>
  );
}