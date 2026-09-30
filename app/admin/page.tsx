import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getCloudAdminDetectionsPage,
  type AdminDetection,
  type DetectionType,
} from "../../lib/cloudDatabase";

import {
  getFeedStatus,
} from "../../lib/feedStatus";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    type?: string;
    page?: string;
  }>;
};

function createAdminSessionToken() {
  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET;

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

function formatUtc(
  value: string | null,
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    },
  ).format(date);
}

function formatCompactUtc(
  value: string,
) {
  const date =
    new Date(value);

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
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    },
  ).format(date);
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
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
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

function formatRegion(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  if (value === "US") {
    return "United States";
  }

  if (value === "CA") {
    return "Canada";
  }

  return value;
}

function getStatus(
  lastSuccessfulAt: string | null,
  lastError: string | null,
) {
  if (lastError) {
    return {
      label: "Error",
      className:
        "text-red-400",
    };
  }

  if (!lastSuccessfulAt) {
    return {
      label: "No Data",
      className:
        "text-zinc-400",
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
      label: "Unknown",
      className:
        "text-zinc-400",
    };
  }

  const ageMinutes =
    (Date.now() -
      date.getTime()) /
    (1000 * 60);

  if (ageMinutes <= 30) {
    return {
      label: "Healthy",
      className:
        "text-emerald-400",
    };
  }

  if (ageMinutes <= 90) {
    return {
      label: "Delayed",
      className:
        "text-amber-300",
    };
  }

  return {
    label: "Stale",
    className:
      "text-red-400",
  };
}

function getDetectionRelease(
  detection: AdminDetection,
) {
  if (
    detection.detectionType ===
    "CAM"
  ) {
    return {
      stage: "Theatrical",
      date:
        detection
          .theatricalReleaseDate,
      region:
        detection
          .theatricalReleaseRegion,
    };
  }

  return {
    stage: "Digital",
    date:
      detection
        .digitalReleaseDate,
    region:
      detection
        .digitalReleaseRegion,
  };
}

function getFilterHref({
  type,
  page,
}: {
  type?: DetectionType;
  page?: number;
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
      String(page),
    );
  }

  const query =
    params.toString();

  return query
    ? `/admin?${query}`
    : "/admin";
}

export default async function AdminPage({
  searchParams,
}: AdminPageProps) {
  await requireAdminSession();

  const params =
    await searchParams;

  const detectionType:
    DetectionType | undefined =
    params.type === "CAM" ||
    params.type === "WEB"
      ? params.type
      : undefined;

  const requestedPage =
    Number(
      params.page ?? "1",
    );

  const currentPage =
    Number.isFinite(
      requestedPage,
    ) &&
    requestedPage >= 1
      ? Math.floor(
          requestedPage,
        )
      : 1;

  const limit = 50;

  const offset =
    (currentPage - 1) *
    limit;

  const [
    cinemaCityStatus,
    detectionPage,
  ] = await Promise.all([
    getFeedStatus(
      "CinemaCity",
    ),

    getCloudAdminDetectionsPage({
      limit,
      offset,
      detectionType,
    }),
  ]);

  const status =
    getStatus(
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
          limit,
      ),
    );

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-bold">
              ShadowWindow
            </p>

            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500">
              Admin
            </p>
          </div>

          <div className="flex items-center gap-5">
            <a
              href="/shadow-zone"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              Public Site
            </a>

            <form
              action={logoutAdmin}
            >
              <button
                type="submit"
                className="text-sm font-medium text-zinc-300 transition hover:text-white"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-500">
            Internal Intelligence
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Admin Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Internal feed health,
            ingestion diagnostics and
            monitoring-source data.
          </p>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between border-b border-zinc-800 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Detection Source
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                CinemaCity RSS
              </h2>
            </div>

            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Status
              </p>

              <p
                className={`mt-1 text-sm font-bold ${status.className}`}
              >
                {status.label}
              </p>
            </div>
          </div>

          <div className="grid border-b border-zinc-900 md:grid-cols-2 xl:grid-cols-4">
            <StatusItem
              label="Last Checked"
              value={formatUtc(
                cinemaCityStatus
                  ?.lastCheckedAt ??
                  null,
              )}
            />

            <StatusItem
              label="Last Successful"
              value={formatUtc(
                cinemaCityStatus
                  ?.lastSuccessfulAt ??
                  null,
              )}
            />

            <StatusItem
              label="Latest RSS Item"
              value={formatUtc(
                cinemaCityStatus
                  ?.latestItemPublishedAt ??
                  null,
              )}
            />

            <StatusItem
              label="Feed Items"
              value={
                cinemaCityStatus
                  ? String(
                      cinemaCityStatus.itemCount,
                    )
                  : "Not available"
              }
            />
          </div>

          <div className="grid border-b border-zinc-900 md:grid-cols-[180px_1fr]">
            <div className="py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Latest Feed Entry
            </div>

            <div className="py-3 text-sm font-medium text-zinc-200">
              {cinemaCityStatus
                ?.latestItemTitle ??
                "Not available"}
            </div>
          </div>

          <div className="grid border-b border-zinc-900 md:grid-cols-[180px_1fr]">
            <div className="py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Last Error
            </div>

            <div
              className={`py-3 text-sm font-medium ${
                cinemaCityStatus
                  ?.lastError
                  ? "text-red-400"
                  : "text-zinc-400"
              }`}
            >
              {cinemaCityStatus
                ?.lastError ??
                "None"}
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-4 border-b border-zinc-800 pb-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Monitoring
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Detection Intelligence
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                {
                  detectionPage.total
                }{" "}
                internal detection records
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={getFilterHref({})}
                className={`border px-3 py-1.5 text-xs font-semibold ${
                  !detectionType
                    ? "border-zinc-500 bg-zinc-800 text-white"
                    : "border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                All
              </a>

              <a
                href={getFilterHref({
                  type: "CAM",
                })}
                className={`border px-3 py-1.5 text-xs font-semibold ${
                  detectionType ===
                  "CAM"
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                CAM
              </a>

              <a
                href={getFilterHref({
                  type: "WEB",
                })}
                className={`border px-3 py-1.5 text-xs font-semibold ${
                  detectionType ===
                  "WEB"
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                WEB
              </a>
            </div>
          </div>

          {detectionPage
            .detections
            .length === 0 ? (
            <p className="py-6 text-sm text-zinc-400">
              No detection records found.
            </p>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-[minmax(0,2fr)_1fr_1.4fr_1.2fr_1fr_.8fr_.55fr] gap-3 border-b border-zinc-700 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
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
                  Release
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
                        className="grid grid-cols-[minmax(0,2fr)_1fr_1.4fr_1.2fr_1fr_.8fr_.55fr] items-center gap-3 border-b border-zinc-900 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {
                              detection.title
                            }
                          </p>

                          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                            TMDB{" "}
                            {detection.tmdbId ??
                              "—"}

                            {detection.year
                              ? ` · ${detection.year}`
                              : ""}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">
                              {
                                detection.detectionType
                              }
                            </span>

                            <span className="truncate text-[10px] font-semibold text-zinc-300">
                              {detection.quality ??
                                "—"}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] font-medium leading-4 text-zinc-200">
                          {formatCompactUtc(
                            detection.detectedAt,
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-zinc-200">
                            {
                              release.stage
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {formatDate(
                              release.date,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 truncate text-[11px] text-zinc-300">
                          {formatRegion(
                            release.region,
                          )}
                        </div>

                        <div className="truncate text-[11px] font-semibold text-zinc-200">
                          {
                            detection.source
                          }
                        </div>

                        <div className="text-right">
                          {detection.sourceUrl ? (
                            <a
                              href={
                                detection.sourceUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              title={
                                detection.sourceUrl
                              }
                              className="inline-block border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-zinc-600">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between border-t border-zinc-900 pt-4">
              <p className="text-xs text-zinc-500">
                Page{" "}
                {currentPage} of{" "}
                {totalPages}
              </p>

              <div className="flex gap-2">
                {currentPage >
                  1 && (
                  <a
                    href={getFilterHref({
                      type:
                        detectionType,
                      page:
                        currentPage -
                        1,
                    })}
                    className="border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    ← Previous
                  </a>
                )}

                {currentPage <
                  totalPages && (
                  <a
                    href={getFilterHref({
                      type:
                        detectionType,
                      page:
                        currentPage +
                        1,
                    })}
                    className="border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    Next →
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatusItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-zinc-900 py-4 md:border-b-0 md:border-r md:px-4 first:pl-0 last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-200">
        {value}
      </p>
    </div>
  );
}