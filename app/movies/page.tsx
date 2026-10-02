import SiteHeader from "../../components/SiteHeader";

import TitleBrowser, {
  type BrowseAvailabilityBadge,
  type BrowseTitle,
} from "../../components/TitleBrowser";

import {
  getCloudPublicDetections,
  type DetectionType,
} from "../../lib/cloudDatabase";

type Region =
  | "US"
  | "CA";

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
};

type TmdbResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
};

type MovieWithRegions =
  TmdbMovie & {
    regions:
      Region[];
  };

type MoviesPageProps = {
  searchParams: Promise<{
    page?: string;
    view?: string;
  }>;
};

const PAGE_SIZE =
  32;

const MAX_TMDB_PAGES =
  100;

const WESTERN_ORIGINS =
  "US|CA|GB|AU|NZ|IE";

function getToday() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function parsePage(
  value:
    string | undefined,
) {
  const parsed =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 1
  ) {
    return 1;
  }

  return parsed;
}

async function fetchMoviePage(
  region:
    Region,

  page:
    number,
): Promise<
  TmdbResponse
> {
  const token =
    process.env
      .TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is missing.",
    );
  }

  const params =
    new URLSearchParams({
      language:
        "en-US",

      page:
        String(
          page,
        ),

      region,

      sort_by:
        "primary_release_date.desc",

      include_adult:
        "false",

      include_video:
        "false",

      with_release_type:
        "2|3",

      with_original_language:
        "en",

      with_origin_country:
        WESTERN_ORIGINS,

      "vote_count.gte":
        "20",

      "release_date.lte":
        getToday(),
    });

  const response =
    await fetch(
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          accept:
            "application/json",
        },

        next: {
          revalidate:
            3600,
        },
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `TMDB movie request for ${region} failed with status ${response.status}.`,
    );
  }

  return response.json();
}

function addMoviesToMap(
  map: Map<
    number,
    MovieWithRegions
  >,

  movies:
    TmdbMovie[],

  region:
    Region,
) {
  movies.forEach(
    (movie) => {
      if (
        !movie.poster_path ||
        !movie.release_date
      ) {
        return;
      }

      const existing =
        map.get(
          movie.id,
        );

      if (
        existing
      ) {
        if (
          !existing.regions.includes(
            region,
          )
        ) {
          existing.regions.push(
            region,
          );
        }

        return;
      }

      map.set(
        movie.id,
        {
          ...movie,

          regions: [
            region,
          ],
        },
      );
    },
  );
}

function sortMovies(
  movies:
    MovieWithRegions[],
) {
  return movies.sort(
    (
      a,
      b,
    ) => {
      const aTime =
        new Date(
          `${a.release_date}T00:00:00Z`,
        ).getTime();

      const bTime =
        new Date(
          `${b.release_date}T00:00:00Z`,
        ).getTime();

      if (
        bTime !==
        aTime
      ) {
        return (
          bTime -
          aTime
        );
      }

      return (
        b.vote_count -
        a.vote_count
      );
    },
  );
}

async function getCuratedMovies(
  requestedPage:
    number,
) {
  const requiredCount =
    requestedPage *
    PAGE_SIZE;

  const movieMap =
    new Map<
      number,
      MovieWithRegions
    >();

  let tmdbPage =
    1;

  let totalResults =
    0;

  let reachedEnd =
    false;

  while (
    movieMap.size <
      requiredCount &&
    tmdbPage <=
      MAX_TMDB_PAGES &&
    !reachedEnd
  ) {
    const [
      usData,
      canadaData,
    ] =
      await Promise.all([
        fetchMoviePage(
          "US",
          tmdbPage,
        ),

        fetchMoviePage(
          "CA",
          tmdbPage,
        ),
      ]);

    totalResults =
      Math.max(
        totalResults,

        usData
          .total_results,

        canadaData
          .total_results,
      );

    addMoviesToMap(
      movieMap,
      usData.results,
      "US",
    );

    addMoviesToMap(
      movieMap,
      canadaData.results,
      "CA",
    );

    const lastUsPage =
      tmdbPage >=
      Math.min(
        usData
          .total_pages,

        500,
      );

    const lastCanadaPage =
      tmdbPage >=
      Math.min(
        canadaData
          .total_pages,

        500,
      );

    reachedEnd =
      lastUsPage &&
      lastCanadaPage;

    tmdbPage +=
      1;
  }

  const allMovies =
    sortMovies(
      Array.from(
        movieMap.values(),
      ),
    );

  const start =
    (
      requestedPage -
      1
    ) *
    PAGE_SIZE;

  const end =
    start +
    PAGE_SIZE;

  const pageMovies =
    allMovies.slice(
      start,
      end,
    );

  const totalPages =
    Math.max(
      1,

      Math.ceil(
        totalResults /
          PAGE_SIZE,
      ),
    );

  return {
    movies:
      pageMovies,

    totalPages,

    totalResults,
  };
}

function formatRegions(
  regions:
    Region[],
) {
  return regions
    .map(
      (
        region,
      ) =>
        region ===
        "US"
          ? "US"
          : "Canada",
    )
    .join(
      " • ",
    );
}

function buildDetectionMap(
  detections:
    Awaited<
      ReturnType<
        typeof getCloudPublicDetections
      >
    >,
) {
  const detectionMap =
    new Map<
      number,
      Set<
        DetectionType
      >
    >();

  for (
    const detection of
    detections
  ) {
    if (
      detection.tmdbId ===
      null
    ) {
      continue;
    }

    const existing =
      detectionMap.get(
        detection.tmdbId,
      ) ??
      new Set<
        DetectionType
      >();

    existing.add(
      detection
        .detectionType,
    );

    detectionMap.set(
      detection.tmdbId,
      existing,
    );
  }

  return detectionMap;
}

function getAvailabilityBadges(
  movieId:
    number,

  detectionMap:
    Map<
      number,
      Set<
        DetectionType
      >
    >,
): BrowseAvailabilityBadge[] {
  const badges:
    BrowseAvailabilityBadge[] =
      [
        {
          label:
            "Theatrical",

          tone:
            "official",
        },
      ];

  const detectionTypes =
    detectionMap.get(
      movieId,
    );

  if (
    !detectionTypes
  ) {
    return badges;
  }

  if (
    detectionTypes.has(
      "CAM",
    )
  ) {
    badges.push({
      label:
        "CAM Detected",

      tone:
        "cam",
    });
  }

  if (
    detectionTypes.has(
      "WEB",
    )
  ) {
    badges.push({
      label:
        "WEB Detected",

      tone:
        "web",
    });
  }

  if (
    detectionTypes.has(
      "BLURAY",
    )
  ) {
    badges.push({
      label:
        "Blu-ray Detected",

      tone:
        "bluray",
    });
  }

  return badges;
}

export default async function MoviesPage({
  searchParams,
}: MoviesPageProps) {
  const params =
    await searchParams;

  const requestedPage =
    parsePage(
      params.page,
    );

  const [
    moviePage,
    publicDetections,
  ] =
    await Promise.all([
      getCuratedMovies(
        requestedPage,
      ),

      getCloudPublicDetections(),
    ]);

  const {
    movies,
    totalPages,
    totalResults,
  } =
    moviePage;

  const detectionMap =
    buildDetectionMap(
      publicDetections,
    );

  const page =
    Math.min(
      requestedPage,
      totalPages,
    );

  const items:
    BrowseTitle[] =
    movies.map(
      (movie) => ({
        id:
          movie.id,

        title:
          movie.title,

        overview:
          movie.overview,

        posterPath:
          movie.poster_path,

        date:
          movie.release_date,

        dateLabel:
          "Theatrical",

        categoryLabel:
          "Movie",

        regionLabel:
          formatRegions(
            movie.regions,
          ),

        rating:
          movie.vote_average,

        voteCount:
          movie.vote_count,

        href:
          `/movies/${movie.id}`,

        availabilityBadges:
          getAvailabilityBadges(
            movie.id,
            detectionMap,
          ),
      }),
    );

  const initialView =
    params.view ===
    "list"
      ? "list"
      : "cards";

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-500">
          Latest Theatrical Releases
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Latest Movies in Theaters
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          The latest English-language
          movies released in theaters
          across the US, Canada and
          major Western markets.
        </p>

        <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-600">
          Availability indicators show
          official theatrical releases
          alongside CAM, WEB and Blu-ray
          detections recorded by
          Watch Leaks.
        </p>

        <TitleBrowser
          items={
            items
          }
          page={
            page
          }
          totalPages={
            totalPages
          }
          totalResults={
            totalResults
          }
          basePath="/movies"
          initialView={
            initialView
          }
        />

        <p className="mt-10 text-xs text-zinc-700">
          Movie metadata, ratings
          and images provided by
          TMDB. Detection indicators
          are provided by Watch Leaks.
        </p>
      </section>
    </main>
  );
}