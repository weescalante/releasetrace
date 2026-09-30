import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  revalidatePath,
} from "next/cache";

import {
  cookies,
} from "next/headers";

import {
  redirect,
} from "next/navigation";

import {
  getCloudAdminDetectionsPage,
  type AdminDetection,
  type DetectionType,
} from "../../lib/cloudDatabase";

import {
  getFeedStatus,
} from "../../lib/feedStatus";

import {
  getAdminMatchReviewsPage,
  markMatchReviewIgnored,
  type MatchReviewReason,
} from "../../lib/matchReviews";

import {
  approveMatchReview,
} from "../../lib/matchReviewApproval";

export const dynamic =
  "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    type?: string;
    page?: string;
    reviewPage?: string;

    reviewMessage?: string;
    reviewError?: string;
  }>;
};

const DETECTION_LIMIT = 50;
const REVIEW_LIMIT = 25;

function createAdminSessionToken() {
  const sessionSecret =
    process.env
      .ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing.",
    );
  }

  return createHmac(
    "sha256",
    sessionSecret,
  )
    .update(
      "shadowwindow-admin-session",
    )
    .digest("hex");
}

async function requireAdminSession() {
  const cookieStore =
    await cookies();

  const sessionCookie =
    cookieStore.get(
      "shadowwindow_admin",
    )?.value;

  if (!sessionCookie) {
    redirect(
      "/admin/login",
    );
  }

  const expectedToken =
    createAdminSessionToken();

  const actualBuffer =
    Buffer.from(
      sessionCookie,
      "utf8",
    );

  const expectedBuffer =
    Buffer.from(
      expectedToken,
      "utf8",
    );

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    redirect(
      "/admin/login",
    );
  }

  if (
    !timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    )
  ) {
    redirect(
      "/admin/login",
    );
  }
}

async function logoutAdmin() {
  "use server";

  const cookieStore =
    await cookies();

  cookieStore.delete(
    "shadowwindow_admin",
  );

  redirect(
    "/admin/login",
  );
}

async function updateMatchReview(
  formData: FormData,
) {
  "use server";

  await requireAdminSession();

  const id =
    Number(
      formData.get(
        "id",
      ),
    );

  const action =
    String(
      formData.get(
        "action",
      ) ?? "",
    );

  if (
    !Number.isInteger(id) ||
    id < 1
  ) {
    redirect(
      "/admin?reviewError=Invalid%20match%20review%20ID#reviews",
    );
  }

  if (
    action ===
    "APPROVE"
  ) {
    let result;

    try {
      result =
        await approveMatchReview(
          id,
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Match approval failed.";

      redirect(
        `/admin?reviewError=${encodeURIComponent(
          message,
        )}#reviews`,
      );
    }

    revalidatePath(
      "/admin",
    );

    revalidatePath(
      "/",
    );

    revalidatePath(
      "/shadow-zone",
    );

    if (!result.success) {
      redirect(
        `/admin?reviewError=${encodeURIComponent(
          result.message,
        )}#reviews`,
      );
    }

    redirect(
      `/admin?reviewMessage=${encodeURIComponent(
        result.message,
      )}#reviews`,
    );
  }

  if (
    action ===
    "IGNORE"
  ) {
    const ignored =
      await markMatchReviewIgnored(
        id,
      );

    revalidatePath(
      "/admin",
    );

    if (!ignored) {
      redirect(
        "/admin?reviewError=Match%20review%20could%20not%20be%20ignored#reviews",
      );
    }

    redirect(
      "/admin?reviewMessage=Match%20review%20ignored#reviews",
    );
  }

  redirect(
    "/admin?reviewError=Unknown%20review%20action#reviews",
  );
}

function parsePage(
  value:
    string | undefined,
) {
  const parsed =
    Number(
      value ??
        "1",
    );

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 1
  ) {
    return 1;
  }

  return Math.floor(
    parsed,
  );
}

function formatDateTime(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}

function formatFullUtc(
  value:
    string | null,
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      second:
        "2-digit",

      timeZone:
        "UTC",

      timeZoneName:
        "short",
    },
  ).format(
    date,
  );
}

function formatReleaseDate(
  value:
    string | null,
) {
  if (!value) {
    return "Unavailable";
  }

  const date =
    new Date(
      `${value}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}

function formatRegion(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  if (
    value ===
    "US"
  ) {
    return "United States";
  }

  if (
    value ===
    "CA"
  ) {
    return "Canada";
  }

  return value;
}

function getFeedHealth(
  lastSuccessfulAt:
    string | null,

  lastError:
    string | null,
) {
  if (lastError) {
    return {
      label:
        "Error",

      className:
        "text-red-400",
    };
  }

  if (!lastSuccessfulAt) {
    return {
      label:
        "No Data",

      className:
        "text-zinc-500",
    };
  }

  const date =
    new Date(
      lastSuccessfulAt,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return {
      label:
        "Unknown",

      className:
        "text-zinc-500",
    };
  }

  const ageMinutes =
    (
      Date.now() -
      date.getTime()
    ) /
    (
      1000 *
      60
    );

  if (
    ageMinutes <=
    30
  ) {
    return {
      label:
        "Healthy",

      className:
        "text-emerald-400",
    };
  }

  if (
    ageMinutes <=
    90
  ) {
    return {
      label:
        "Delayed",

      className:
        "text-amber-300",
    };
  }

  return {
    label:
      "Stale",

    className:
      "text-red-400",
  };
}

function getDetectionRelease(
  detection:
    AdminDetection,
) {
  if (
    detection
      .detectionType ===
    "CAM"
  ) {
    return {
      stage:
        "Theatrical",

      date:
        detection
          .theatricalReleaseDate,

      region:
        detection
          .theatricalReleaseRegion,
    };
  }

  return {
    stage:
      "Digital",

    date:
      detection
        .digitalReleaseDate,

    region:
      detection
        .digitalReleaseRegion,
  };
}

function getDetectionHref({
  type,
  page,
  reviewPage,
}: {
  type?:
    DetectionType;

  page?:
    number;

  reviewPage?:
    number;
}) {
  const params =
    new URLSearchParams();

  if (type) {
    params.set(
      "type",
      type,
    );
  }

  if (
    page &&
    page > 1
  ) {
    params.set(
      "page",
      String(
        page,
      ),
    );
  }

  if (
    reviewPage &&
    reviewPage > 1
  ) {
    params.set(
      "reviewPage",
      String(
        reviewPage,
      ),
    );
  }

  const query =
    params.toString();

  return query
    ? `/admin?${query}`
    : "/admin";
}

function getReviewHref({
  type,
  page,
  reviewPage,
}: {
  type?:
    DetectionType;

  page?:
    number;

  reviewPage:
    number;
}) {
  const params =
    new URLSearchParams();

  if (type) {
    params.set(
      "type",
      type,
    );
  }

  if (
    page &&
    page > 1
  ) {
    params.set(
      "page",
      String(
        page,
      ),
    );
  }

  if (
    reviewPage >
    1
  ) {
    params.set(
      "reviewPage",
      String(
        reviewPage,
      ),
    );
  }

  const query =
    params.toString();

  const href =
    query
      ? `/admin?${query}`
      : "/admin";

  return `${href}#reviews`;
}

function formatReviewReason(
  reason:
    MatchReviewReason,
) {
  if (
    reason ===
    "UNMATCHED"
  ) {
    return "Unmatched";
  }

  if (
    reason ===
    "AMBIGUOUS"
  ) {
    return "Ambiguous";
  }

  if (
    reason ===
    "TITLE_MISMATCH"
  ) {
    return "Title mismatch";
  }

  return "No release date";
}

function getReviewReasonClass(
  reason:
    MatchReviewReason,
) {
  if (
    reason ===
    "UNMATCHED"
  ) {
    return "border-red-500/40 text-red-300";
  }

  if (
    reason ===
    "AMBIGUOUS"
  ) {
    return "border-amber-400/40 text-amber-300";
  }

  if (
    reason ===
    "TITLE_MISMATCH"
  ) {
    return "border-orange-400/40 text-orange-300";
  }

  return "border-blue-400/40 text-blue-300";
}

function formatConfidence(
  value:
    number | null,
) {
  if (
    value === null ||
    !Number.isFinite(
      value,
    )
  ) {
    return "—";
  }

  return `${Math.round(
    value,
  )}%`;
}

export default async function AdminPage({
  searchParams,
}: AdminPageProps) {
  await requireAdminSession();

  const params =
    await searchParams;

  const reviewMessage =
    params.reviewMessage;

  const reviewError =
    params.reviewError;

  const detectionType:
    DetectionType | undefined =
    params.type ===
      "CAM" ||
    params.type ===
      "WEB"
      ? params.type
      : undefined;

  const currentPage =
    parsePage(
      params.page,
    );

  const currentReviewPage =
    parsePage(
      params.reviewPage,
    );

  const detectionOffset =
    (
      currentPage -
      1
    ) *
    DETECTION_LIMIT;

  const reviewOffset =
    (
      currentReviewPage -
      1
    ) *
    REVIEW_LIMIT;

  const [
    cinemaCityStatus,
    detectionPage,
    reviewPage,
  ] = await Promise.all([
    getFeedStatus(
      "CinemaCity",
    ),

    getCloudAdminDetectionsPage({
      limit:
        DETECTION_LIMIT,

      offset:
        detectionOffset,

      detectionType,
    }),

    getAdminMatchReviewsPage({
      limit:
        REVIEW_LIMIT,

      offset:
        reviewOffset,

      status:
        "PENDING",
    }),
  ]);

  const feedHealth =
    getFeedHealth(
      cinemaCityStatus
        ?.lastSuccessfulAt ??
        null,

      cinemaCityStatus
        ?.lastError ??
        null,
    );

  const totalPages =
    Math.max(
      1,

      Math.ceil(
        detectionPage.total /
          DETECTION_LIMIT,
      ),
    );

  const reviewTotalPages =
    Math.max(
      1,

      Math.ceil(
        reviewPage.total /
          REVIEW_LIMIT,
      ),
    );

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">
              ShadowWindow
            </span>

            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-500">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="/shadow-zone"
              className="text-zinc-400 transition hover:text-white"
            >
              Public Site
            </a>

            <form
              action={
                logoutAdmin
              }
            >
              <button
                type="submit"
                className="text-zinc-400 transition hover:text-white"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold">
                Operations
              </h1>

              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                CinemaCity RSS
              </span>
            </div>

            <span
              className={`text-xs font-bold ${feedHealth.className}`}
            >
              {
                feedHealth.label
              }
            </span>
          </div>

          <div className="grid border-y border-zinc-800 lg:grid-cols-[1fr_1fr_1fr_.45fr_2fr]">
            <CompactMetric
              label="Last Checked"
              value={formatDateTime(
                cinemaCityStatus
                  ?.lastCheckedAt ??
                  null,
              )}
            />

            <CompactMetric
              label="Last Successful"
              value={formatDateTime(
                cinemaCityStatus
                  ?.lastSuccessfulAt ??
                  null,
              )}
            />

            <CompactMetric
              label="Latest RSS"
              value={formatDateTime(
                cinemaCityStatus
                  ?.latestItemPublishedAt ??
                  null,
              )}
            />

            <CompactMetric
              label="Items"
              value={
                cinemaCityStatus
                  ? String(
                      cinemaCityStatus
                        .itemCount,
                    )
                  : "—"
              }
            />

            <CompactMetric
              label="Latest Entry"
              value={
                cinemaCityStatus
                  ?.latestItemTitle ??
                "—"
              }
            />
          </div>

          {cinemaCityStatus
            ?.lastError && (
            <div className="border-b border-red-500/30 py-1.5 text-xs text-red-400">
              <span className="mr-2 font-bold">
                Last Error:
              </span>

              {
                cinemaCityStatus
                  .lastError
              }
            </div>
          )}

          <details className="border-b border-zinc-900 py-1.5 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none hover:text-zinc-300">
              Feed diagnostics
            </summary>

            <div className="mt-2 grid gap-2 pb-1 md:grid-cols-3">
              <div>
                <span className="text-zinc-600">
                  Checked:
                </span>{" "}

                {
                  formatFullUtc(
                    cinemaCityStatus
                      ?.lastCheckedAt ??
                      null,
                  )
                }
              </div>

              <div>
                <span className="text-zinc-600">
                  Successful:
                </span>{" "}

                {
                  formatFullUtc(
                    cinemaCityStatus
                      ?.lastSuccessfulAt ??
                      null,
                  )
                }
              </div>

              <div>
                <span className="text-zinc-600">
                  Latest item:
                </span>{" "}

                {
                  formatFullUtc(
                    cinemaCityStatus
                      ?.latestItemPublishedAt ??
                      null,
                  )
                }
              </div>
            </div>
          </details>
        </section>

        <section
          id="reviews"
          className="mt-5"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold">
                Match Review
              </h2>

              <span
                className={`text-xs font-bold ${
                  reviewPage.total >
                  0
                    ? "text-amber-300"
                    : "text-emerald-400"
                }`}
              >
                {
                  reviewPage.total
                }{" "}
                pending
              </span>
            </div>

            {reviewTotalPages >
              1 && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-zinc-500">
                  {
                    currentReviewPage
                  }
                  /
                  {
                    reviewTotalPages
                  }
                </span>

                {currentReviewPage >
                  1 && (
                  <a
                    href={getReviewHref({
                      type:
                        detectionType,

                      page:
                        currentPage,

                      reviewPage:
                        currentReviewPage -
                        1,
                    })}
                    className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
                  >
                    ←
                  </a>
                )}

                {currentReviewPage <
                  reviewTotalPages && (
                  <a
                    href={getReviewHref({
                      type:
                        detectionType,

                      page:
                        currentPage,

                      reviewPage:
                        currentReviewPage +
                        1,
                    })}
                    className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
                  >
                    →
                  </a>
                )}
              </div>
            )}
          </div>

          {reviewMessage && (
            <div className="mb-2 border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-300">
              {
                reviewMessage
              }
            </div>
          )}

          {reviewError && (
            <div className="mb-2 border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-xs text-red-300">
              {
                reviewError
              }
            </div>
          )}

          {reviewPage
            .reviews
            .length ===
          0 ? (
            <div className="border-y border-zinc-900 py-2 text-xs text-emerald-400">
              No pending match reviews.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-zinc-800">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[115px_minmax(210px,1.4fr)_85px_95px_minmax(180px,1.1fr)_70px_110px_minmax(180px,1.2fr)_210px] items-center gap-2 border-b border-zinc-700 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  <div>
                    Issue
                  </div>

                  <div>
                    Title
                  </div>

                  <div>
                    Type
                  </div>

                  <div>
                    Year
                  </div>

                  <div>
                    TMDB Candidate
                  </div>

                  <div>
                    Match
                  </div>

                  <div>
                    Published
                  </div>

                  <div>
                    Diagnostic
                  </div>

                  <div className="text-right">
                    Actions
                  </div>
                </div>

                {reviewPage
                  .reviews
                  .map(
                    (
                      review,
                    ) => (
                      <div
                        key={
                          review.id
                        }
                        className="grid min-h-11 grid-cols-[115px_minmax(210px,1.4fr)_85px_95px_minmax(180px,1.1fr)_70px_110px_minmax(180px,1.2fr)_210px] items-center gap-2 border-b border-zinc-900 py-1.5 text-[11px]"
                      >
                        <div>
                          <span
                            className={`inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${getReviewReasonClass(
                              review.reason,
                            )}`}
                          >
                            {
                              formatReviewReason(
                                review.reason,
                              )
                            }
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {
                              review
                                .normalizedTitle
                            }
                          </p>

                          {review.sourceTitle !==
                            review.normalizedTitle && (
                            <p
                              className="truncate text-[9px] text-zinc-600"
                              title={
                                review.sourceTitle
                              }
                            >
                              {
                                review
                                  .sourceTitle
                              }
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="rounded-full border border-red-500/40 px-1.5 py-0.5 text-[8px] font-bold text-red-400">
                            {
                              review
                                .detectionType
                            }
                          </span>

                          <span
                            className="truncate text-[9px] text-zinc-500"
                            title={
                              review.quality ??
                              undefined
                            }
                          >
                            {
                              review.quality ??
                              "—"
                            }
                          </span>
                        </div>

                        <div className="text-zinc-300">
                          {
                            review.year ??
                            "—"
                          }
                        </div>

                        <div className="min-w-0">
                          {review
                            .candidateTmdbId ? (
                            <>
                              <p
                                className="truncate font-medium text-zinc-100"
                                title={
                                  review
                                    .candidateTitle ??
                                  undefined
                                }
                              >
                                {
                                  review
                                    .candidateTitle ??
                                  "Unknown"
                                }
                              </p>

                              <p className="text-[9px] text-zinc-600">
                                TMDB{" "}
                                {
                                  review
                                    .candidateTmdbId
                                }

                                {
                                  review
                                    .candidateYear
                                    ? ` · ${review.candidateYear}`
                                    : ""
                                }
                              </p>
                            </>
                          ) : (
                            <span className="text-zinc-600">
                              No candidate
                            </span>
                          )}
                        </div>

                        <div className="font-semibold text-zinc-200">
                          {
                            formatConfidence(
                              review.confidence,
                            )
                          }
                        </div>

                        <div className="text-[10px] leading-4 text-zinc-400">
                          {
                            formatDateTime(
                              review
                                .publishedAt,
                            )
                          }
                        </div>

                        <div
                          className="truncate text-[10px] text-zinc-500"
                          title={
                            review.details ??
                            undefined
                          }
                        >
                          {
                            review.details ??
                            "—"
                          }
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          {review
                            .sourceUrl && (
                            <a
                              href={
                                review
                                  .sourceUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="border border-zinc-700 px-2 py-1 text-[9px] font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                            >
                              Source
                            </a>
                          )}

                          {review
                            .candidateTmdbId && (
                            <form
                              action={
                                updateMatchReview
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  review.id
                                }
                              />

                              <input
                                type="hidden"
                                name="action"
                                value="APPROVE"
                              />

                              <button
                                type="submit"
                                className="border border-emerald-500/50 px-2 py-1 text-[9px] font-bold text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200"
                              >
                                Approve
                              </button>
                            </form>
                          )}

                          <form
                            action={
                              updateMatchReview
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                review.id
                              }
                            />

                            <input
                              type="hidden"
                              name="action"
                              value="IGNORE"
                            />

                            <button
                              type="submit"
                              className="border border-zinc-800 px-2 py-1 text-[9px] font-semibold text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                            >
                              Ignore
                            </button>
                          </form>
                        </div>
                      </div>
                    ),
                  )}
              </div>
            </div>
          )}
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold">
                Detection Intelligence
              </h2>

              <span className="text-xs text-zinc-500">
                {
                  detectionPage.total
                }{" "}
                records
              </span>
            </div>

            <div className="flex items-center gap-1">
              <a
                href={getDetectionHref({
                  reviewPage:
                    currentReviewPage,
                })}
                className={`border px-2 py-1 text-[9px] font-bold ${
                  !detectionType
                    ? "border-zinc-500 bg-zinc-900 text-white"
                    : "border-zinc-800 text-zinc-500 hover:text-white"
                }`}
              >
                ALL
              </a>

              <a
                href={getDetectionHref({
                  type:
                    "CAM",

                  reviewPage:
                    currentReviewPage,
                })}
                className={`border px-2 py-1 text-[9px] font-bold ${
                  detectionType ===
                  "CAM"
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-zinc-800 text-zinc-500 hover:text-white"
                }`}
              >
                CAM
              </a>

              <a
                href={getDetectionHref({
                  type:
                    "WEB",

                  reviewPage:
                    currentReviewPage,
                })}
                className={`border px-2 py-1 text-[9px] font-bold ${
                  detectionType ===
                  "WEB"
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-zinc-800 text-zinc-500 hover:text-white"
                }`}
              >
                WEB
              </a>
            </div>
          </div>

          {detectionPage
            .detections
            .length ===
          0 ? (
            <div className="border-y border-zinc-900 py-2 text-xs text-zinc-500">
              No detection records found.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-zinc-800">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-[minmax(210px,1.5fr)_135px_140px_145px_125px_90px_55px] items-center gap-2 border-b border-zinc-700 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  <div>
                    Title
                  </div>

                  <div>
                    Availability
                  </div>

                  <div>
                    Detected
                  </div>

                  <div>
                    Official Release
                  </div>

                  <div>
                    Region
                  </div>

                  <div>
                    Source
                  </div>

                  <div className="text-right">
                    Link
                  </div>
                </div>

                {detectionPage
                  .detections
                  .map(
                    (
                      detection,
                    ) => {
                      const release =
                        getDetectionRelease(
                          detection,
                        );

                      return (
                        <div
                          key={
                            detection.id
                          }
                          className="grid min-h-10 grid-cols-[minmax(210px,1.5fr)_135px_140px_145px_125px_90px_55px] items-center gap-2 border-b border-zinc-900 py-1 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {
                                detection
                                  .title
                              }
                            </p>

                            <p className="text-[9px] text-zinc-600">
                              TMDB{" "}
                              {
                                detection
                                  .tmdbId ??
                                "—"
                              }

                              {
                                detection
                                  .year
                                  ? ` · ${detection.year}`
                                  : ""
                              }
                            </p>
                          </div>

                          <div className="flex min-w-0 items-center gap-1">
                            <span className="rounded-full border border-red-500/40 px-1.5 py-0.5 text-[8px] font-bold text-red-400">
                              {
                                detection
                                  .detectionType
                              }
                            </span>

                            <span className="truncate text-[9px] text-zinc-400">
                              {
                                detection
                                  .quality ??
                                "—"
                              }
                            </span>
                          </div>

                          <div className="text-[10px] text-zinc-300">
                            {
                              formatDateTime(
                                detection
                                  .detectedAt,
                              )
                            }
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold text-zinc-200">
                              {
                                formatReleaseDate(
                                  release.date,
                                )
                              }
                            </p>

                            <p className="text-[9px] text-zinc-600">
                              {
                                release.stage
                              }
                            </p>
                          </div>

                          <div className="truncate text-[10px] text-zinc-400">
                            {
                              formatRegion(
                                release.region,
                              )
                            }
                          </div>

                          <div className="truncate text-[10px] text-zinc-300">
                            {
                              detection
                                .source
                            }
                          </div>

                          <div className="text-right">
                            {detection
                              .sourceUrl ? (
                              <a
                                href={
                                  detection
                                    .sourceUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-zinc-700">
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
              </div>
            </div>
          )}

          {totalPages >
            1 && (
            <div className="mt-2 flex items-center justify-end gap-2 text-[10px]">
              <span className="text-zinc-500">
                Page{" "}
                {
                  currentPage
                }
                /
                {
                  totalPages
                }
              </span>

              {currentPage >
                1 && (
                <a
                  href={getDetectionHref({
                    type:
                      detectionType,

                    page:
                      currentPage -
                      1,

                    reviewPage:
                      currentReviewPage,
                  })}
                  className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
                >
                  ←
                </a>
              )}

              {currentPage <
                totalPages && (
                <a
                  href={getDetectionHref({
                    type:
                      detectionType,

                    page:
                      currentPage +
                      1,

                    reviewPage:
                      currentReviewPage,
                  })}
                  className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
                >
                  →
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="min-w-0 border-b border-zinc-900 px-2 py-2 first:pl-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {
          label
        }
      </p>

      <p
        className="mt-0.5 truncate text-[11px] font-semibold text-zinc-200"
        title={
          value
        }
      >
        {
          value
        }
      </p>
    </div>
  );
}