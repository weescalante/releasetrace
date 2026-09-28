const redZoneMovies = [
  {
    title: "Example Movie One",
    year: 2026,
    status: "CAM observed",
    firstSeen: "2 hours ago",
  },
  {
    title: "Example Movie Two",
    year: 2026,
    status: "WEB observed",
    firstSeen: "5 hours ago",
  },
  {
    title: "Example Movie Three",
    year: 2026,
    status: "CAM observed",
    firstSeen: "Yesterday",
  },
  {
    title: "Example Movie Four",
    year: 2026,
    status: "No unauthorized copy observed",
    firstSeen: "5 days in theaters",
  },
];

const upcomingReleases = [
  {
    title: "Example Film A",
    type: "Theatrical",
    date: "October 2",
  },
  {
    title: "Example Film B",
    type: "Digital",
    date: "October 4",
  },
  {
    title: "Example Film C",
    type: "4K / Blu-ray",
    date: "October 6",
  },
];

const recentChanges = [
  {
    title: "Example Movie Five",
    change: "Digital release moved earlier",
    detail: "October 20 → October 13",
  },
  {
    title: "Example Movie Six",
    change: "New 4K release date",
    detail: "November 17",
  },
  {
    title: "Example Movie Seven",
    change: "Streaming release confirmed",
    detail: "October 9",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold tracking-tight">
              ReleaseTrace
            </p>
          </div>

          <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <a href="#" className="transition hover:text-white">
              Movies
            </a>

            <a href="#" className="transition hover:text-white">
              Calendar
            </a>

            <a href="#" className="transition hover:text-white">
              Red Zone
            </a>

            <a href="#" className="transition hover:text-white">
              Changes
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
            Movie Release Intelligence
          </p>

          <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Track the complete
            <br />
            lifecycle of a movie.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
            Follow theatrical, digital, physical, streaming, and observed
            unauthorized availability in one continuously updated timeline.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <button className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200">
              Explore Releases
            </button>

            <button className="rounded-lg border border-zinc-700 px-5 py-3 font-medium text-white transition hover:border-zinc-500">
              View Red Zone
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-500">
              Active Now
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              The Red Zone
            </h2>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Recently released movies with current unauthorized-availability
              signals.
            </p>
          </div>

          <button className="hidden text-sm font-medium text-zinc-400 transition hover:text-white sm:block">
            View all →
          </button>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {redZoneMovies.map((movie) => {
            const isClear =
              movie.status === "No unauthorized copy observed";

            return (
              <article
                key={movie.title}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
              >
                <div className="flex aspect-[2/3] items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                  <span className="text-sm text-zinc-600">
                    Movie poster
                  </span>
                </div>

                <div className="p-5">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isClear ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {movie.status}
                  </p>

                  <h3 className="mt-3 text-lg font-semibold">
                    {movie.title}
                  </h3>

                  <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
                    <span>{movie.year}</span>
                    <span>{movie.firstSeen}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-zinc-900 bg-zinc-950/50">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
              Coming Soon
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Upcoming Releases
            </h2>

            <div className="mt-8 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {upcomingReleases.map((release) => (
                <div
                  key={release.title}
                  className="flex items-center justify-between gap-6 p-5"
                >
                  <div>
                    <p className="font-medium">{release.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {release.type}
                    </p>
                  </div>

                  <p className="text-sm text-zinc-300">
                    {release.date}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
              Intelligence Feed
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Recent Changes
            </h2>

            <div className="mt-8 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {recentChanges.map((item) => (
                <div key={item.title} className="p-5">
                  <p className="font-medium">{item.title}</p>

                  <p className="mt-2 text-sm text-zinc-400">
                    {item.change}
                  </p>

                  <p className="mt-1 text-sm text-zinc-500">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 sm:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
            The Release Lifecycle
          </p>

          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight">
            One movie. Every important release stage.
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-5">
            {[
              "Theatrical",
              "CAM",
              "Digital",
              "WEB",
              "Streaming / Physical",
            ].map((stage, index) => (
              <div
                key={stage}
                className="rounded-xl border border-zinc-800 p-5"
              >
                <p className="text-xs text-zinc-600">
                  0{index + 1}
                </p>

                <p className="mt-3 font-medium">
                  {stage}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ReleaseTrace</p>

          <p>
            Movie release intelligence. No unauthorized links or downloads.
          </p>
        </div>
      </footer>
    </main>
  );
}