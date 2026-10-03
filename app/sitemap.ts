import type { MetadataRoute } from "next";

const BASE_URL =
  "https://watchleaks.com";

const TMDB_PAGES_TO_INDEX =
  5;

const WESTERN_ORIGINS =
  "US|CA|GB|AU|NZ|IE";

type TmdbMovie = {
  id: number;
  release_date?: string;
  poster_path?: string | null;
};

type TmdbShow = {
  id: number;
  first_air_date?: string;
  poster_path?: string | null;
};

type TmdbResponse<T> = {
  results: T[];
};

function getToday() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

async function fetchTmdb<T>(
  path: string,
  params: URLSearchParams,
): Promise<TmdbResponse<T>> {
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
      `https://api.themoviedb.org/3/${path}?${params.toString()}`,
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

  if (!response.ok) {
    throw new Error(
      `TMDB sitemap request failed with status ${response.status}.`,
    );
  }

  return response.json();
}

async function getMovieIds() {
  const movieIds =
    new Set<number>();

  for (
    let page = 1;
    page <=
      TMDB_PAGES_TO_INDEX;
    page += 1
  ) {
    const regions = [
      "US",
      "CA",
    ];

    for (
      const region of regions
    ) {
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

      const data =
        await fetchTmdb<
          TmdbMovie
        >(
          "discover/movie",
          params,
        );

      for (
        const movie of
        data.results
      ) {
        if (
          !movie.poster_path ||
          !movie.release_date
        ) {
          continue;
        }

        movieIds.add(
          movie.id,
        );
      }
    }
  }

  return Array.from(
    movieIds,
  );
}

async function getTvIds() {
  const tvIds =
    new Set<number>();

  for (
    let page = 1;
    page <=
      TMDB_PAGES_TO_INDEX;
    page += 1
  ) {
    const params =
      new URLSearchParams({
        language:
          "en-US",

        page:
          String(
            page,
          ),

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

    const data =
      await fetchTmdb<
        TmdbShow
      >(
        "discover/tv",
        params,
      );

    for (
      const show of
      data.results
    ) {
      if (
        !show.poster_path ||
        !show.first_air_date
      ) {
        continue;
      }

      tvIds.add(
        show.id,
      );
    }
  }

  return Array.from(
    tvIds,
  );
}

export default async function sitemap():
Promise<MetadataRoute.Sitemap> {
  const staticPages:
    MetadataRoute.Sitemap =
    [
      {
        url:
          BASE_URL,

        changeFrequency:
          "daily",

        priority:
          1,
      },
      {
        url:
          `${BASE_URL}/leak-detections`,

        changeFrequency:
          "hourly",

        priority:
          0.9,
      },
      {
        url:
          `${BASE_URL}/latest-cams`,

        changeFrequency:
          "hourly",

        priority:
          0.9,
      },
      {
        url:
          `${BASE_URL}/latest-web`,

        changeFrequency:
          "hourly",

        priority:
          0.9,
      },
      {
        url:
          `${BASE_URL}/latest-blurays`,

        changeFrequency:
          "hourly",

        priority:
          0.9,
      },
      {
        url:
          `${BASE_URL}/movies`,

        changeFrequency:
          "daily",

        priority:
          0.8,
      },
      {
        url:
          `${BASE_URL}/tv-shows`,

        changeFrequency:
          "daily",

        priority:
          0.8,
      },
      {
        url:
          `${BASE_URL}/calendar`,

        changeFrequency:
          "daily",

        priority:
          0.7,
      },
    ];

  try {
    const [
      movieIds,
      tvIds,
    ] =
      await Promise.all([
        getMovieIds(),
        getTvIds(),
      ]);

    const moviePages:
      MetadataRoute.Sitemap =
      movieIds.map(
        (id) => ({
          url:
            `${BASE_URL}/movies/${id}`,

          changeFrequency:
            "daily",

          priority:
            0.7,
        }),
      );

    const tvPages:
      MetadataRoute.Sitemap =
      tvIds.map(
        (id) => ({
          url:
            `${BASE_URL}/tv-shows/${id}`,

          changeFrequency:
            "daily",

          priority:
            0.7,
        }),
      );

    return [
      ...staticPages,
      ...moviePages,
      ...tvPages,
    ];
  } catch (error) {
    console.error(
      "Dynamic sitemap title discovery failed:",
      error,
    );

    return staticPages;
  }
}