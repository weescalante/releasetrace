import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import SiteHeader from "../../../components/SiteHeader";

type Genre = {
  id: number;
  name: string;
};

type Network = {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
};

type TmdbEpisode = {
  id: number;
  name: string;
  overview: string;
  air_date: string | null;
  episode_number: number;
  season_number: number;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  episode_type?: string;
};

type TmdbSeasonSummary = {
  id: number;
  name: string;
  overview: string;
  air_date: string | null;
  episode_count: number;
  season_number: number;
  poster_path: string | null;
  vote_average: number;
};

type TmdbSeasonDetails = {
  id: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
  episodes: TmdbEpisode[];
};

type TmdbTvShow = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  last_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  status: string;
  in_production: boolean;
  genres: Genre[];
  networks: Network[];
  origin_country: string[];
  seasons: TmdbSeasonSummary[];
  last_episode_to_air: TmdbEpisode | null;
  next_episode_to_air: TmdbEpisode | null;
};

type TvShowPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    from?: string;
  }>;
};

async function getTvShow(
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

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${id}?language=en-US`,
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
      `TMDB TV request failed with status ${response.status}.`,
    );
  }

  const show:
    TmdbTvShow =
    await response.json();

  return show;
}

async function getSeason(
  tvId: string,
  seasonNumber: number,
) {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const response =
    await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?language=en-US`,
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
      `TMDB TV season request failed with status ${response.status}.`,
    );
  }

  const season:
    TmdbSeasonDetails =
    await response.json();

  return season;
}

function formatDate(
  date:
    | string
    | null
    | undefined,
) {
  if (!date) {
    return "Unavailable";
  }

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

function getYear(
  date:
    | string
    | null
    | undefined,
) {
  if (!date) {
    return "Unavailable";
  }

  return date.slice(
    0,
    4,
  );
}

function formatRuntime(
  runtime: number | null,
) {
  if (!runtime) {
    return "—";
  }

  if (runtime < 60) {
    return `${runtime}m`;
  }

  const hours =
    Math.floor(
      runtime / 60,
    );

  const minutes =
    runtime % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function padNumber(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    "0",
  );
}

function formatEpisodeCode(
  episode: TmdbEpisode,
) {
  return `S${padNumber(
    episode.season_number,
  )}E${padNumber(
    episode.episode_number,
  )}`;
}

function formatEpisodeType(
  episode:
    TmdbEpisode,
) {
  if (
    episode.episode_type ===
    "finale"
  ) {
    return "Season Finale";
  }

  if (
    episode.episode_type ===
    "mid_season"
  ) {
    return "Midseason Finale";
  }

  return "Episode";
}

function formatRating(
  rating: number,
  voteCount: number,
) {
  if (
    rating <= 0 ||
    voteCount <= 0
  ) {
    return "—";
  }

  return `${rating.toFixed(
    1,
  )} / 10`;
}

function formatCountries(
  countries: string[],
) {
  if (
    countries.length === 0
  ) {
    return "Unavailable";
  }

  return countries.join(
    ", ",
  );
}

function formatNetworks(
  networks: Network[],
) {
  if (
    networks.length === 0
  ) {
    return "Unavailable";
  }

  return networks
    .map(
      (network) =>
        network.name,
    )
    .join(", ");
}

function getBackDestination(
  from: string | undefined,
  referer: string,
) {
  if (
    from ===
      "leak-detections" ||
    referer.includes(
      "/leak-detections",
    )
  ) {
    return {
      href:
        "/leak-detections",

      label:
        "Back to Shadow Zone",
    };
  }

  if (
    from ===
      "calendar" ||
    referer.includes(
      "/calendar",
    )
  ) {
    return {
      href:
        "/calendar",

      label:
        "Back to Release Calendar",
    };
  }

  return {
    href:
      "/tv-shows",

    label:
      "Back to TV Shows",
  };
}

function getRelevantSeasonNumber(
  show: TmdbTvShow,
) {
  if (
    show.next_episode_to_air &&
    show.next_episode_to_air
      .season_number > 0
  ) {
    return show
      .next_episode_to_air
      .season_number;
  }

  if (
    show.last_episode_to_air &&
    show.last_episode_to_air
      .season_number > 0
  ) {
    return show
      .last_episode_to_air
      .season_number;
  }

  const regularSeasons =
    show.seasons
      .filter(
        (season) =>
          season.season_number >
          0,
      )
      .sort(
        (a, b) =>
          b.season_number -
          a.season_number,
      );

  return (
    regularSeasons[0]
      ?.season_number ??
    null
  );
}

function getSeasonState(
  season:
    TmdbSeasonSummary,
) {
  if (!season.air_date) {
    return "Date unavailable";
  }

  const today =
    new Date();

  const airDate =
    new Date(
      `${season.air_date}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      airDate.getTime(),
    )
  ) {
    return "Date unavailable";
  }

  const todayUtc =
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

  const seasonUtc =
    Date.UTC(
      airDate.getUTCFullYear(),
      airDate.getUTCMonth(),
      airDate.getUTCDate(),
    );

  if (
    seasonUtc >
    todayUtc
  ) {
    return "Upcoming";
  }

  return "Released";
}

export default async function TvShowPage({
  params,
  searchParams,
}: TvShowPageProps) {
  const [
    routeParams,
    query,
    requestHeaders,
  ] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);

  const show =
    await getTvShow(
      routeParams.id,
    );

  if (!show) {
    notFound();
  }

  const relevantSeasonNumber =
    getRelevantSeasonNumber(
      show,
    );

  const season =
    relevantSeasonNumber !==
    null
      ? await getSeason(
          routeParams.id,
          relevantSeasonNumber,
        )
      : null;

  const posterUrl =
    show.poster_path
      ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
      : null;

  const backdropUrl =
    show.backdrop_path
      ? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
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

  const regularSeasons =
    show.seasons
      .filter(
        (item) =>
          item.season_number >
          0,
      )
      .sort(
        (a, b) =>
          b.season_number -
          a.season_number,
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
          href={
            back.href
          }
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
                alt={`${show.name} poster`}
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
              Series Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {show.name}
            </h1>

            <div className="mt-5 grid max-w-5xl grid-cols-2 border-y border-zinc-800 sm:grid-cols-4">
              <MetadataItem
                label="First Air Year"
                value={getYear(
                  show.first_air_date,
                )}
              />

              <MetadataItem
                label="First Air Date"
                value={formatDate(
                  show.first_air_date,
                )}
              />

              <MetadataItem
                label="Seasons"
                value={
                  show.number_of_seasons ===
                    null
                    ? "Unavailable"
                    : String(
                        show.number_of_seasons,
                      )
                }
              />

              <MetadataItem
                label="Episodes"
                value={
                  show.number_of_episodes ===
                    null
                    ? "Unavailable"
                    : String(
                        show.number_of_episodes,
                      )
                }
              />
            </div>

            <div className="grid max-w-5xl grid-cols-2 border-b border-zinc-800 sm:grid-cols-4">
              <MetadataItem
                label="Status"
                value={
                  show.status ||
                  "Unavailable"
                }
              />

              <MetadataItem
                label="Network"
                value={formatNetworks(
                  show.networks,
                )}
              />

              <MetadataItem
                label="TMDB Rating"
                value={
                  show.vote_average >
                  0
                    ? `${show.vote_average.toFixed(
                        1,
                      )} / 10`
                    : "Unrated"
                }
              />

              <MetadataItem
                label="Rating Votes"
                value={
                  show.vote_count >
                  0
                    ? show.vote_count.toLocaleString()
                    : "—"
                }
              />
            </div>

            <div className="grid max-w-5xl grid-cols-2 border-b border-zinc-800 sm:grid-cols-4">
              <MetadataItem
                label="Origin"
                value={formatCountries(
                  show.origin_country,
                )}
              />

              <MetadataItem
                label="Last Air Date"
                value={formatDate(
                  show.last_air_date,
                )}
              />

              <MetadataItem
                label="Production"
                value={
                  show.in_production
                    ? "In Production"
                    : "Not In Production"
                }
              />

              <MetadataItem
                label="Current Season"
                value={
                  relevantSeasonNumber ===
                  null
                    ? "Unavailable"
                    : `Season ${relevantSeasonNumber}`
                }
              />
            </div>

            {show.genres.length >
              0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {show.genres.map(
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

            <div className="mt-7 max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Overview
              </p>

              <p className="mt-2 text-sm leading-7 text-zinc-200">
                {show.overview ||
                  "No overview is currently available."}
              </p>
            </div>
          </div>
        </div>

        <EpisodeStatusSection
          lastEpisode={
            show.last_episode_to_air
          }
          nextEpisode={
            show.next_episode_to_air
          }
        />

        <SeasonHistory
          seasons={
            regularSeasons
          }
          relevantSeasonNumber={
            relevantSeasonNumber
          }
        />

        <EpisodeTimeline
          season={
            season
          }
        />

        <p className="mt-12 border-t border-zinc-900 pt-5 text-xs text-zinc-500">
          Television metadata, ratings,
          season information and episode
          information provided by TMDB.
          Watch Leaks does not currently
          publish TV unauthorized-availability
          detections until a dedicated TV
          detection source is connected.
        </p>
      </section>
    </main>
  );
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="py-3 pr-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function EpisodeStatusSection({
  lastEpisode,
  nextEpisode,
}: {
  lastEpisode:
    TmdbEpisode | null;

  nextEpisode:
    TmdbEpisode | null;
}) {
  return (
    <section className="mt-12">
      <div className="border-b border-zinc-800 pb-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
          Release Intelligence
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          Episode Status
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Most recently aired and next
          scheduled episodes reported by
          TMDB.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <EpisodeStatusCard
          label="Last Episode"
          episode={
            lastEpisode
          }
        />

        <EpisodeStatusCard
          label="Next Episode"
          episode={
            nextEpisode
          }
        />
      </div>
    </section>
  );
}

function EpisodeStatusCard({
  label,
  episode,
}: {
  label: string;

  episode:
    TmdbEpisode | null;
}) {
  if (!episode) {
    return (
      <div className="border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </p>

        <p className="mt-3 text-sm font-semibold text-zinc-400">
          No episode information is
          currently available.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
              {formatEpisodeCode(
                episode,
              )}
            </span>

            <span className="text-xs font-semibold text-zinc-400">
              {formatEpisodeType(
                episode,
              )}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Air Date
          </p>

          <p className="mt-1 text-sm font-bold text-white">
            {formatDate(
              episode.air_date,
            )}
          </p>
        </div>
      </div>

      <h3 className="mt-4 text-lg font-bold text-white">
        {episode.name ||
          "Untitled Episode"}
      </h3>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <InfoItem
          label="Runtime"
          value={formatRuntime(
            episode.runtime,
          )}
        />

        <InfoItem
          label="TMDB Rating"
          value={formatRating(
            episode.vote_average,
            episode.vote_count,
          )}
        />

        <InfoItem
          label="Votes"
          value={
            episode.vote_count >
            0
              ? episode.vote_count.toLocaleString()
              : "—"
          }
        />
      </div>

      {episode.overview && (
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {
            episode.overview
          }
        </p>
      )}
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
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function SeasonHistory({
  seasons,
  relevantSeasonNumber,
}: {
  seasons:
    TmdbSeasonSummary[];

  relevantSeasonNumber:
    number | null;
}) {
  return (
    <section className="mt-12">
      <div className="border-b border-zinc-800 pb-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
          Series Release History
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          Seasons
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Reported season premiere dates
          and episode counts.
        </p>
      </div>

      {seasons.length ===
      0 ? (
        <p className="mt-5 text-sm text-zinc-400">
          No season information is
          currently available.
        </p>
      ) : (
        <div className="mt-3">
          <div className="hidden grid-cols-[110px_1.6fr_180px_140px_130px] gap-4 border-b border-zinc-700 py-2 text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 md:grid">
            <div>
              Season
            </div>

            <div>
              Name
            </div>

            <div>
              Premiere
            </div>

            <div>
              Episodes
            </div>

            <div>
              Status
            </div>
          </div>

          {seasons.map(
            (season) => {
              const isRelevant =
                season.season_number ===
                relevantSeasonNumber;

              return (
                <div
                  key={
                    season.id
                  }
                  className={`grid gap-2 border-b py-3 text-sm md:grid-cols-[110px_1.6fr_180px_140px_130px] md:items-center md:gap-4 ${
                    isRelevant
                      ? "border-red-500/30 bg-red-500/[0.04]"
                      : "border-zinc-900"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                      Season
                    </p>

                    <p className="font-bold text-white">
                      Season{" "}
                      {
                        season.season_number
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                      Name
                    </p>

                    <p className="font-medium text-zinc-200">
                      {
                        season.name
                      }
                    </p>

                    {isRelevant && (
                      <p className="mt-0.5 text-xs font-semibold text-red-400">
                        Current / latest relevant season
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                      Premiere
                    </p>

                    <p className="font-medium text-zinc-300">
                      {formatDate(
                        season.air_date,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                      Episodes
                    </p>

                    <p className="font-medium text-zinc-300">
                      {
                        season.episode_count
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                      Status
                    </p>

                    <p
                      className={`font-semibold ${
                        getSeasonState(
                          season,
                        ) ===
                        "Upcoming"
                          ? "text-amber-300"
                          : "text-zinc-300"
                      }`}
                    >
                      {getSeasonState(
                        season,
                      )}
                    </p>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

function EpisodeTimeline({
  season,
}: {
  season:
    TmdbSeasonDetails | null;
}) {
  if (!season) {
    return (
      <section className="mt-12">
        <div className="border-b border-zinc-800 pb-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
            Episode Intelligence
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Episode Timeline
          </h2>
        </div>

        <p className="mt-5 text-sm text-zinc-400">
          No detailed episode information
          is currently available.
        </p>
      </section>
    );
  }

  const episodes =
    [...season.episodes].sort(
      (a, b) =>
        a.episode_number -
        b.episode_number,
    );

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
            Episode Intelligence
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Season{" "}
            {
              season.season_number
            }{" "}
            Episode Timeline
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Episode-level release dates,
            runtimes and ratings for the
            latest relevant season.
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Episodes
          </p>

          <p className="mt-1 text-sm font-bold text-white">
            {
              episodes.length
            }
          </p>
        </div>
      </div>

      {season.overview && (
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-400">
          {
            season.overview
          }
        </p>
      )}

      {episodes.length ===
      0 ? (
        <p className="mt-5 text-sm text-zinc-400">
          No episodes are currently
          listed for this season.
        </p>
      ) : (
        <div className="mt-4">
          <div className="hidden grid-cols-[90px_1.7fr_170px_120px_120px_140px] gap-4 border-b border-zinc-700 py-2 text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 md:grid">
            <div>
              Episode
            </div>

            <div>
              Title
            </div>

            <div>
              Air Date
            </div>

            <div>
              Runtime
            </div>

            <div>
              Rating
            </div>

            <div>
              Event
            </div>
          </div>

          {episodes.map(
            (episode) => (
              <div
                key={
                  episode.id
                }
                className="grid gap-2 border-b border-zinc-900 py-3 text-sm md:grid-cols-[90px_1.7fr_170px_120px_120px_140px] md:items-center md:gap-4"
              >
                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Episode
                  </p>

                  <span className="inline-block border border-zinc-700 px-2 py-0.5 text-xs font-bold text-zinc-200">
                    {formatEpisodeCode(
                      episode,
                    )}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Title
                  </p>

                  <p className="font-semibold text-white">
                    {episode.name ||
                      "Untitled Episode"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Air Date
                  </p>

                  <p className="font-medium text-zinc-300">
                    {formatDate(
                      episode.air_date,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Runtime
                  </p>

                  <p className="font-medium text-zinc-300">
                    {formatRuntime(
                      episode.runtime,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Rating
                  </p>

                  <p className="font-medium text-zinc-300">
                    {formatRating(
                      episode.vote_average,
                      episode.vote_count,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 md:hidden">
                    Event
                  </p>

                  <p
                    className={`font-semibold ${
                      episode.episode_type ===
                      "finale"
                        ? "text-red-400"
                        : episode.episode_type ===
                            "mid_season"
                          ? "text-amber-300"
                          : "text-zinc-400"
                    }`}
                  >
                    {formatEpisodeType(
                      episode,
                    )}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}