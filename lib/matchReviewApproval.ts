import {
  saveCloudDetection,
} from "./cloudDatabase";

import {
  approveRelatedMatchReviews,
  getMatchReviewById,
} from "./matchReviews";

type ReleaseRegion =
  | "US"
  | "CA";

type TmdbMovieDetails = {
  id: number;

  title: string;
  original_title?: string;

  release_date?: string;

  poster_path:
    string | null;
};

type TmdbReleaseDatesResponse = {
  results: {
    iso_3166_1:
      string;

    release_dates: {
      release_date:
        string;

      type:
        number;
    }[];
  }[];
};

type ReleaseMatch = {
  date: string;

  region:
    ReleaseRegion;
};

export type MatchReviewApprovalResult = {
  success: boolean;

  message: string;

  reviewId:
    number;

  tmdbId:
    number | null;

  relatedReviewsApproved:
    number;
};

function firstReleaseForType(
  releaseData:
    TmdbReleaseDatesResponse,

  type:
    number,
): ReleaseMatch | null {
  const preferredRegions:
    ReleaseRegion[] = [
      "US",
      "CA",
    ];

  for (
    const regionCode of
    preferredRegions
  ) {
    const region =
      releaseData.results.find(
        (result) =>
          result.iso_3166_1 ===
          regionCode,
      );

    if (!region) {
      continue;
    }

    const matchingDates =
      region.release_dates
        .filter(
          (release) =>
            release.type ===
            type,
        )
        .map(
          (release) =>
            release.release_date,
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(
              a,
            ).getTime() -
            new Date(
              b,
            ).getTime(),
        );

    if (
      matchingDates.length >
      0
    ) {
      return {
        date:
          matchingDates[0]
            .slice(
              0,
              10,
            ),

        region:
          regionCode,
      };
    }
  }

  return null;
}

async function getTmdbMovieDetails(
  tmdbId: number,
): Promise<
  TmdbMovieDetails
> {
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
      `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          accept:
            "application/json",
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `TMDB movie lookup failed with status ${response.status}.`,
    );
  }

  return response.json();
}

async function getTmdbReleaseDates(
  tmdbId: number,
): Promise<
  TmdbReleaseDatesResponse | null
> {
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
      `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          accept:
            "application/json",
        },

        cache:
          "no-store",
      },
    );

  /*
   * Release metadata is enrichment.
   *
   * Failure to retrieve it must not
   * prevent an otherwise verified
   * detection from being approved.
   */
  if (!response.ok) {
    console.error(
      `TMDB release-date lookup failed for movie ${tmdbId} with status ${response.status}.`,
    );

    return null;
  }

  return response.json();
}

function getYearFromDate(
  value:
    string | undefined,
) {
  if (
    !value ||
    !/^\d{4}/.test(
      value,
    )
  ) {
    return null;
  }

  return value.slice(
    0,
    4,
  );
}

/*
 * Approve one stored Match Review.
 *
 * This workflow does NOT depend on
 * the CinemaCity item still being
 * present in the live RSS feed.
 *
 * The review row already preserves:
 * - source
 * - source URL
 * - source title
 * - normalized title
 * - source year
 * - quality
 * - detection type
 * - source publication time
 * - chosen TMDB candidate
 *
 * Approval therefore means:
 *
 * 1. Read the stored review.
 * 2. Trust the human-confirmed
 *    candidate TMDB ID.
 * 3. Refresh current TMDB metadata.
 * 4. Create/update the detection.
 * 5. Mark related stale review rows
 *    APPROVED.
 */
export async function approveMatchReview(
  reviewId: number,
): Promise<
  MatchReviewApprovalResult
> {
  if (
    !Number.isInteger(
      reviewId,
    ) ||
    reviewId < 1
  ) {
    return {
      success:
        false,

      message:
        "Invalid match review ID.",

      reviewId,

      tmdbId:
        null,

      relatedReviewsApproved:
        0,
    };
  }

  const review =
    await getMatchReviewById(
      reviewId,
    );

  if (!review) {
    return {
      success:
        false,

      message:
        "Match review was not found.",

      reviewId,

      tmdbId:
        null,

      relatedReviewsApproved:
        0,
    };
  }

  if (
    review.status ===
    "IGNORED"
  ) {
    return {
      success:
        false,

      message:
        "Ignored reviews cannot be approved without first being returned to Pending.",

      reviewId,

      tmdbId:
        review.candidateTmdbId,

      relatedReviewsApproved:
        0,
    };
  }

  if (
    review.status ===
    "APPROVED"
  ) {
    return {
      success:
        true,

      message:
        "This match review is already approved.",

      reviewId,

      tmdbId:
        review.candidateTmdbId,

      relatedReviewsApproved:
        0,
    };
  }

  if (
    !review.candidateTmdbId
  ) {
    return {
      success:
        false,

      message:
        "This review does not have a TMDB candidate to approve.",

      reviewId,

      tmdbId:
        null,

      relatedReviewsApproved:
        0,
    };
  }

  /*
   * A real source publication
   * timestamp is required.
   *
   * Do not substitute review creation
   * time because that would fabricate
   * the detection timestamp.
   */
  if (
    !review.publishedAt
  ) {
    return {
      success:
        false,

      message:
        "This review has no source publication timestamp, so a detection cannot be created safely.",

      reviewId,

      tmdbId:
        review.candidateTmdbId,

      relatedReviewsApproved:
        0,
    };
  }

  const tmdbId =
    review.candidateTmdbId;

  const movie =
    await getTmdbMovieDetails(
      tmdbId,
    );

  const releaseData =
    await getTmdbReleaseDates(
      tmdbId,
    );

  /*
   * TMDB release types:
   *
   * 2 = Theatrical (Limited)
   * 3 = Theatrical
   * 4 = Digital
   * 5 = Physical
   */
  const theatricalRelease =
    releaseData
      ? (
          firstReleaseForType(
            releaseData,
            3,
          ) ??
          firstReleaseForType(
            releaseData,
            2,
          )
        )
      : null;

  const digitalRelease =
    releaseData
      ? firstReleaseForType(
          releaseData,
          4,
        )
      : null;

  const physicalRelease =
    releaseData
      ? firstReleaseForType(
          releaseData,
          5,
        )
      : null;

  const year =
    review.year ??
    review.candidateYear ??
    getYearFromDate(
      movie.release_date,
    ) ??
    "Unknown";

  /*
   * A manually approved identity is
   * now considered a valid detection.
   *
   * Missing release milestones do not
   * invalidate that detection.
   */
  await saveCloudDetection({
    tmdbId:

      movie.id,

    title:
      review.normalizedTitle,

    year,

    detectionType:
      review.detectionType,

    quality:
      review.quality ??
      "Unknown",

    detectedAt:
      review.publishedAt,

    theatricalReleaseDate:
      theatricalRelease
        ?.date ??
      null,

    theatricalReleaseRegion:
      theatricalRelease
        ?.region ??
      null,

    digitalReleaseDate:
      digitalRelease
        ?.date ??
      null,

    digitalReleaseRegion:
      digitalRelease
        ?.region ??
      null,

    physicalReleaseDate:
      physicalRelease
        ?.date ??
      null,

    physicalReleaseRegion:
      physicalRelease
        ?.region ??
      null,

    posterPath:
      movie.poster_path ??
      null,

    source:
      review.source,

    sourceUrl:
      review.sourceUrl,
  });

  /*
   * Reconcile all stale PENDING or
   * legacy RESOLVED reviews belonging
   * to this same source detection.
   */
  const relatedReviewsApproved =
    await approveRelatedMatchReviews({
      source:
        review.source,

      sourceUrl:
        review.sourceUrl,

      normalizedTitle:
        review.normalizedTitle,

      year:
        review.year,

      detectionType:
        review.detectionType,
    });

  return {
    success:
      true,

    message:
      theatricalRelease ||
      digitalRelease
        ? "Match approved and detection saved."
        : "Match approved and detection saved. Official release metadata is currently unavailable.",

    reviewId,

    tmdbId,

    relatedReviewsApproved,
  };
}