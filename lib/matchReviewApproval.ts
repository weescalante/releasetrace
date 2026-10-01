import {
  saveCloudDetection,
} from "./cloudDatabase";

import {
  getLiveMatchReviewCandidates,
} from "./matchReviewCandidates";

import {
  approveRelatedMatchReviews,
  getMatchReviewById,
  recordApprovedMatchReviewCandidate,
  type MatchReviewCandidate,
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

function mergeCandidates(
  stored:
    MatchReviewCandidate[],

  live:
    MatchReviewCandidate[],
) {
  const candidates =
    new Map<
      number,
      MatchReviewCandidate
    >();

  /*
   * Stored candidates go in first.
   *
   * Live TMDB candidates then replace
   * matching IDs so Admin approval uses
   * the newest/richer metadata.
   */
  for (
    const candidate of
    stored
  ) {
    candidates.set(
      candidate.tmdbId,
      candidate,
    );
  }

  for (
    const candidate of
    live
  ) {
    candidates.set(
      candidate.tmdbId,
      candidate,
    );
  }

  return Array.from(
    candidates.values(),
  );
}

/*
 * Build the candidate set that Admin
 * is actually allowed to approve.
 *
 * New reviews already preserve detailed
 * candidateOptions.
 *
 * Older reviews may contain only one
 * legacy candidate even though the
 * original match was AMBIGUOUS.
 *
 * For that reason we refresh TMDB here
 * as well as on the Admin page.
 *
 * This has two benefits:
 *
 * 1. Admin can approve newly discovered
 *    candidate choices safely.
 *
 * 2. A forged arbitrary TMDB ID still
 *    cannot be approved just because it
 *    was posted to the server.
 */
async function getApprovalCandidates({
  normalizedTitle,

  year,

  sourceDescription,

  candidateTmdbId,

  storedCandidates,
}: {
  normalizedTitle:
    string;

  year:
    string | null;

  sourceDescription:
    string | null;

  candidateTmdbId:
    number | null;

  storedCandidates:
    MatchReviewCandidate[];
}) {
  let liveCandidates:
    MatchReviewCandidate[] =
    [];

  try {
    liveCandidates =
      await getLiveMatchReviewCandidates({
        normalizedTitle,

        year,

        sourceDescription,

        candidateTmdbId,
      });
  } catch (error) {
    /*
     * TMDB refresh failure should not
     * destroy backward compatibility for
     * old review rows.
     *
     * We can still use stored candidates,
     * but we log the refresh failure.
     */
    console.error(
      "Unable to refresh TMDB candidates during match approval.",

      error,
    );
  }

  return mergeCandidates(
    storedCandidates,

    liveCandidates,
  );
}

/*
 * Approve one stored Match Review.
 *
 * selectedTmdbId is the exact candidate
 * chosen by the administrator.
 *
 * The CinemaCity RSS entry does NOT need
 * to remain in the live feed because all
 * source information required to create
 * the detection lives in the review row.
 */
export async function approveMatchReview(
  reviewId: number,

  selectedTmdbId?:
    number,
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

  if (
    selectedTmdbId !==
      undefined &&
    (
      !Number.isInteger(
        selectedTmdbId,
      ) ||
      selectedTmdbId <
        1
    )
  ) {
    return {
      success:
        false,

      message:
        "Invalid selected TMDB ID.",

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
        selectedTmdbId ??
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
        review
          .approvedCandidateTmdbId ??
        review
          .candidateTmdbId,

      relatedReviewsApproved:
        0,
    };
  }

  /*
   * Refresh candidates from TMDB.
   *
   * This is especially important for
   * legacy AMBIGUOUS rows such as the
   * current Runner and The Nice Ones
   * reviews, which originally preserved
   * only one candidate.
   */
  const candidateOptions =
    await getApprovalCandidates({
      normalizedTitle:
        review.normalizedTitle,

      year:
        review.year,

      sourceDescription:
        review.sourceDescription ??
        null,

      candidateTmdbId:
        review.candidateTmdbId,

      storedCandidates:
        review.candidateOptions ??
        [],
    });

  let tmdbId:
    number | null =
    null;

  let selectedCandidateYear:
    string | null =
    null;

  let selectedCandidateTitle:
    string | null =
    null;

  if (
    selectedTmdbId !==
    undefined
  ) {
    const selectedOption =
      candidateOptions.find(
        (candidate) =>
          candidate.tmdbId ===
          selectedTmdbId,
      );

    /*
     * Do not accept arbitrary TMDB IDs.
     *
     * The selected movie must exist in
     * either the stored review candidates
     * or the refreshed live TMDB candidate
     * set.
     */
    if (!selectedOption) {
      return {
        success:
          false,

        message:
          "The selected TMDB movie is not one of the valid candidates for this review.",

        reviewId,

        tmdbId:
          selectedTmdbId,

        relatedReviewsApproved:
          0,
      };
    }

    tmdbId =
      selectedOption.tmdbId;

    selectedCandidateYear =
      selectedOption.year ??
      null;

    selectedCandidateTitle =
      selectedOption.title ??
      null;
  } else if (
    candidateOptions.length >
    1
  ) {
    /*
     * Multiple choices means the human
     * administrator must decide.
     *
     * Never silently approve candidate #1.
     */
    return {
      success:
        false,

      message:
        "This review has multiple TMDB candidates. Choose the correct candidate before approving.",

      reviewId,

      tmdbId:
        null,

      relatedReviewsApproved:
        0,
    };
  } else if (
    candidateOptions.length ===
    1
  ) {
    tmdbId =
      candidateOptions[0]
        .tmdbId;

    selectedCandidateYear =
      candidateOptions[0]
        .year ??
      null;

    selectedCandidateTitle =
      candidateOptions[0]
        .title ??
      null;
  } else if (
    review.candidateTmdbId
  ) {
    /*
     * Final backward-compatible fallback.
     *
     * This matters if TMDB candidate
     * refreshing temporarily fails and an
     * older row does not have candidateOptions.
     */
    tmdbId =
      review.candidateTmdbId;

    selectedCandidateYear =
      review.candidateYear ??
      null;

    selectedCandidateTitle =
      review.candidateTitle ??
      null;
  }

  if (!tmdbId) {
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
   * A genuine source publication
   * timestamp is required.
   *
   * Never substitute the review creation
   * timestamp because that would fabricate
   * when the detection occurred.
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

      tmdbId,

      relatedReviewsApproved:
        0,
    };
  }

  /*
   * Refresh authoritative metadata for
   * the exact movie selected by Admin.
   */
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

  /*
   * Prefer CinemaCity's reported year.
   *
   * If unavailable, use the year belonging
   * to the exact candidate selected by the
   * administrator.
   */
  const year =
    review.year ??
    selectedCandidateYear ??
    getYearFromDate(
      movie.release_date,
    ) ??
    "Unknown";

  /*
   * A manually confirmed identity is a
   * valid detection even when TMDB does
   * not currently have the applicable
   * official release milestone.
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
   * Preserve exactly which candidate the
   * human administrator approved.
   */
  await recordApprovedMatchReviewCandidate({
    id:
      reviewId,

    candidate: {
      tmdbId:
        movie.id,

      title:
        selectedCandidateTitle ??
        movie.title,

      year:
        selectedCandidateYear ??
        getYearFromDate(
          movie.release_date,
        ),
    },
  });

  /*
   * Reconcile other stale pending or
   * legacy resolved reviews representing
   * this same CinemaCity detection.
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
        ? `TMDB ${tmdbId} approved and detection saved.`
        : `TMDB ${tmdbId} approved and detection saved. Official release metadata is currently unavailable.`,

    reviewId,

    tmdbId,

    relatedReviewsApproved,
  };
}