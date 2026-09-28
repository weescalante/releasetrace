import Link from "next/link";

export default function RedZonePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            ReleaseTrace
          </Link>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <Link href="/movies" className="transition hover:text-white">
              Movies
            </Link>

            <Link href="/calendar" className="transition hover:text-white">
              Calendar
            </Link>

            <Link href="/red-zone" className="text-white">
              Red Zone
            </Link>

            <a href="#" className="transition hover:text-white">
              Changes
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
            Release Monitoring
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            The Red Zone
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Track recently released movies where unauthorized availability has
            been observed and compare those signals against official release
            timelines.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Active Signals
            </p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-zinc-500">
              Monitoring feed not connected
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              CAM Observed
            </p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-zinc-500">
              No observations recorded
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              WEB Observed
            </p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-zinc-500">
              No observations recorded
            </p>
          </div>
        </div>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
              Monitoring Status
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              No monitoring data connected yet
            </h2>

            <p className="mt-4 leading-7 text-zinc-400">
              ReleaseTrace currently has official movie and release metadata
              from TMDB, but an independent source for observed unauthorized
              availability has not yet been connected.
            </p>

            <p className="mt-4 leading-7 text-zinc-400">
              Once monitoring data is connected, titles with detected signals
              can appear here with the observed format, first-seen date, and
              their position in the official release lifecycle.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
            Signal Types
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            What the Red Zone will track
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
                CAM
              </p>

              <h3 className="mt-3 text-lg font-semibold">
                Theatrical-source observation
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                A monitoring signal indicating that an unauthorized
                theater-recorded copy has been observed.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
                WEB
              </p>

              <h3 className="mt-3 text-lg font-semibold">
                Digital-source observation
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                A monitoring signal indicating that an unauthorized
                digital-source copy has been observed.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-16 text-xs text-zinc-600">
          ReleaseTrace reports monitoring signals only. No unauthorized links
          or downloads are provided.
        </p>
      </section>
    </main>
  );
}