import SiteHeader from "../../components/SiteHeader";
import TitleBrowser, {
  type BrowseTitle,
} from "../../components/TitleBrowser";

type TmdbShow = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  origin_country: string[];
};

type TmdbResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbShow[];
};

type TVShowsPageProps = {
  searchParams: Promise<{
    page?: string;
    view?: string;
  }>;
};

const PAGE_SIZE = 32;
const MAX_TMDB_PAGES = 100;

const WESTERN_ORIGINS =
  "US|CA|GB|AU|NZ|IE";

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function parsePage(
  value: string | undefined,
) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return 1;
  }

  return parsed;
}

async function fetchShowPage(
  page: number,
): Promise<TmdbResponse> {
  const token =
    process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const params =
    new URLSearchParams({
      language: "en-US",

      page: String(page),

      sort_by:
        "first_air_date.desc",

      include_adult:
        "false",

      include_null_first_air_dates:
        "false",

      with_original_language:
        "en",

      with_origin_country:
        WESTERN_ORIGINS,

      "vote_count.gte":
        "20",

      "first_air_date.lte":
        getToday(),
    });

  const response = await fetch(
    `https://api.themoviedb.org/3/discover/tv?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },

      next: {
        revalidate: 3600,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `TMDB TV request failed with status ${response.status}.`,
    );
  }

  return response.json();
}

function sortShows(
  shows: TmdbShow[],
) {
  return shows.sort((a, b) => {
    const aTime = new Date(
      `${a.first_air_date}T00:00:00Z`,
    ).getTime();

    const bTime = new Date(
      `${b.first_air_date}T00:00:00Z`,
    ).getTime();

    if (bTime !== aTime) {
      return bTime - aTime;
    }

    return (
      b.vote_count -
      a.vote_count
    );
  });
}

async function getCuratedShows(
  requestedPage: number,
) {
  const requiredCount =
    requestedPage * PAGE_SIZE;

  const showMap = new Map<
    number,
    TmdbShow
  >();

  let tmdbPage = 1;
  let totalResults = 0;
  let reachedEnd = false;

  while (
    showMap.size <
      requiredCount &&
    tmdbPage <=
      MAX_TMDB_PAGES &&
    !reachedEnd
  ) {
    const data =
      await fetchShowPage(
        tmdbPage,
      );

    totalResults =
      data.total_results;

    data.results.forEach(
      (show) => {
        if (
          !show.poster_path ||
          !show.first_air_date
        ) {
          return;
        }

        if (
          !showMap.has(
            show.id,
          )
        ) {
          showMap.set(
            show.id,
            show,
          );
        }
      },
    );

    reachedEnd =
      tmdbPage >=
      Math.min(
        data.total_pages,
        500,
      );

    tmdbPage += 1;
  }

  const allShows =
    sortShows(
      Array.from(
        showMap.values(),
      ),
    );

  const start =
    (requestedPage - 1) *
    PAGE_SIZE;

  const end =
    start + PAGE_SIZE;

  const pageShows =
    allShows.slice(
      start,
      end,
    );

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalResults /
        PAGE_SIZE,
    ),
  );

  return {
    shows: pageShows,
    totalPages,
    totalResults,
  };
}

function formatCountries(
  countries: string[],
) {
  if (!countries.length) {
    return null;
  }

  return countries
    .slice(0, 2)
    .join(" • ");
}

export default async function TVShowsPage({
  searchParams,
}: TVShowsPageProps) {
  const params =
    await searchParams;

  const requestedPage =
    parsePage(params.page);

  const {
    shows,
    totalPages,
    totalResults,
  } = await getCuratedShows(
    requestedPage,
  );

  const page = Math.min(
    requestedPage,
    totalPages,
  );

  const items: BrowseTitle[] =
    shows.map((show) => ({
      id: show.id,

      title: show.name,

      overview:
        show.overview,

      posterPath:
        show.poster_path,

      date:
        show.first_air_date,

      dateLabel:
        "First Aired",

      categoryLabel:
        "TV",

      regionLabel:
        formatCountries(
          show.origin_country,
        ),

      rating:
        show.vote_average,

      voteCount:
        show.vote_count,

      href:
        `/tv-shows/${show.id}?from=tv-shows`,
    }));

  const initialView =
    params.view === "list"
      ? "list"
      : "cards";

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-500">
          Release Intelligence
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          TV Shows
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Recent English-language
          television releases focused
          on the US, Canada and major
          Western markets.
        </p>

        <TitleBrowser
          items={items}
          page={page}
          totalPages={
            totalPages
          }
          totalResults={
            totalResults
          }
          basePath="/tv-shows"
          initialView={
            initialView
          }
        />

        <p className="mt-10 text-xs text-zinc-700">
          TV metadata, ratings and
          images provided by TMDB.
        </p>
      </section>
    </main>
  );
}