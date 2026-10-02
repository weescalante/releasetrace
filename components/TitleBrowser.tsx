"use client";

import Link from "next/link";
import { useState } from "react";

export type BrowseAvailabilityTone =
  | "official"
  | "cam"
  | "web"
  | "bluray";

export type BrowseAvailabilityBadge = {
  label: string;

  tone:
    BrowseAvailabilityTone;
};

export type BrowseTitle = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;

  date: string;
  dateLabel: string;

  categoryLabel: string;
  regionLabel: string | null;

  rating: number;
  voteCount: number;

  href: string;

  availabilityBadges?:
    BrowseAvailabilityBadge[];
};

type TitleBrowserProps = {
  items: BrowseTitle[];

  page: number;
  totalPages: number;
  totalResults: number;

  basePath: string;
  initialView?: "cards" | "list";
};

function formatDate(
  date: string,
) {
  if (!date) {
    return "—";
  }

  const parsedDate =
    new Date(
      `${date}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return date;
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

      timeZone:
        "UTC",
    },
  ).format(
    parsedDate,
  );
}

function getPageNumbers(
  page: number,
  totalPages: number,
) {
  if (
    totalPages <=
    5
  ) {
    return Array.from(
      {
        length:
          totalPages,
      },

      (
        _,
        index,
      ) =>
        index +
        1,
    );
  }

  let start =
    Math.max(
      1,
      page -
        2,
    );

  const end =
    Math.min(
      totalPages,

      Math.max(
        5,
        start +
          4,
      ),
    );

  if (
    end -
      start <
    4
  ) {
    start =
      Math.max(
        1,
        end -
          4,
      );
  }

  return Array.from(
    {
      length:
        end -
        start +
        1,
    },

    (
      _,
      index,
    ) =>
      start +
      index,
  );
}

function getAvailabilityClass(
  tone:
    BrowseAvailabilityTone,
) {
  if (
    tone ===
    "cam"
  ) {
    return "border-red-400 bg-red-600 text-white shadow-lg";
  }

  if (
    tone ===
    "web"
  ) {
    return "border-amber-300 bg-amber-400 text-black shadow-lg";
  }

  if (
    tone ===
    "bluray"
  ) {
    return "border-sky-300 bg-sky-500 text-white shadow-lg";
  }

  return "border-emerald-300 bg-emerald-500 text-black shadow-lg";
}

export default function TitleBrowser({
  items,
  page,
  totalPages,
  totalResults,
  basePath,
  initialView = "cards",
}: TitleBrowserProps) {
  const [
    viewMode,
    setViewMode,
  ] = useState<
    "cards" | "list"
  >(
    initialView,
  );

  const pageNumbers =
    getPageNumbers(
      page,
      totalPages,
    );

  function getPageHref(
    targetPage:
      number,
  ) {
    return `${basePath}?page=${targetPage}&view=${viewMode}`;
  }

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 border-b border-zinc-900 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-600">
          {totalResults.toLocaleString()} matches
          {" · "}
          Page {page.toLocaleString()} of{" "}
          {totalPages.toLocaleString()}
          {" · "}
          Newest first
        </p>

        <div className="flex w-fit rounded-md border border-zinc-800 p-0.5">
          <button
            type="button"
            onClick={() =>
              setViewMode(
                "cards",
              )
            }
            className={`rounded px-2.5 py-1 text-[11px] font-medium ${
              viewMode ===
              "cards"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Cards
          </button>

          <button
            type="button"
            onClick={() =>
              setViewMode(
                "list",
              )
            }
            className={`rounded px-2.5 py-1 text-[11px] font-medium ${
              viewMode ===
              "list"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewMode ===
      "cards" ? (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {items.map(
            (item) => (
              <TitleCard
                key={
                  item.id
                }
                item={
                  item
                }
              />
            ),
          )}
        </div>
      ) : (
        <TitleList
          items={
            items
          }
        />
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5 border-t border-zinc-900 pt-5">
        {page >
          1 && (
          <Link
            href={getPageHref(
              page -
                1,
            )}
            className="border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            ← Previous
          </Link>
        )}

        {pageNumbers.map(
          (
            pageNumber,
          ) => (
            <Link
              key={
                pageNumber
              }
              href={getPageHref(
                pageNumber,
              )}
              className={`flex h-7 min-w-7 items-center justify-center border px-2 text-xs ${
                pageNumber ===
                page
                  ? "border-zinc-600 bg-zinc-800 text-white"
                  : "border-zinc-800 text-zinc-500 hover:text-white"
              }`}
            >
              {
                pageNumber
              }
            </Link>
          ),
        )}

        {page <
          totalPages && (
          <Link
            href={getPageHref(
              page +
                1,
            )}
            className="border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            Next →
          </Link>
        )}
      </div>
    </>
  );
}

function TitleCard({
  item,
}: {
  item:
    BrowseTitle;
}) {
  const posterUrl =
    item.posterPath
      ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
      : null;

  const availabilityBadges =
    item.availabilityBadges ??
    [];

  return (
    <Link
      href={
        item.href
      }
      className="group overflow-hidden border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
    >
      <div className="relative">
        {posterUrl ? (
          <img
            src={
              posterUrl
            }
            alt={`${item.title} poster`}
            loading="lazy"
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center bg-zinc-900 text-[10px] text-zinc-600">
            No poster
          </div>
        )}

        {availabilityBadges.length >
          0 && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
            {availabilityBadges.map(
              (
                badge,
                index,
              ) => (
                <span
                  key={`${badge.label}-${index}`}
                  className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide backdrop-blur-sm ${getAvailabilityClass(
                    badge.tone,
                  )}`}
                >
                  {
                    badge.label
                  }
                </span>
              ),
            )}
          </div>
        )}
      </div>

      <div className="p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[8px] uppercase tracking-wider text-zinc-600">
            {
              item.categoryLabel
            }
          </span>

          {item.regionLabel && (
            <span className="truncate text-[8px] font-medium text-red-400">
              {
                item.regionLabel
              }
            </span>
          )}
        </div>

        <h2 className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white">
          {
            item.title
          }
        </h2>

        <div className="mt-2 flex items-end justify-between gap-1">
          <div>
            <p className="text-[7px] uppercase tracking-wider text-zinc-700">
              {
                item.dateLabel
              }
            </p>

            <p className="mt-0.5 text-[9px] text-zinc-400">
              {
                formatDate(
                  item.date,
                )
              }
            </p>
          </div>

          {item.rating >
            0 && (
            <span className="text-[10px] font-semibold text-zinc-300">
              {
                item.rating.toFixed(
                  1,
                )
              }
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function TitleList({
  items,
}: {
  items:
    BrowseTitle[];
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <div className="min-w-[950px]">
        <div className="grid h-7 grid-cols-[minmax(280px,1fr)_240px_150px_120px_90px] items-center border-b border-zinc-800 text-[8px] font-medium uppercase tracking-[0.15em] text-zinc-600">
          <div>
            Title
          </div>

          <div>
            Availability
          </div>

          <div>
            Release
          </div>

          <div>
            Region
          </div>

          <div className="text-right">
            Rating
          </div>
        </div>

        {items.map(
          (item) => {
            const availabilityBadges =
              item.availabilityBadges ??
              [];

            return (
              <Link
                key={
                  item.id
                }
                href={
                  item.href
                }
                className="grid min-h-10 grid-cols-[minmax(280px,1fr)_240px_150px_120px_90px] items-center border-b border-zinc-900 py-1 text-xs transition hover:bg-zinc-950"
              >
                <div className="min-w-0 pr-3">
                  <span className="truncate font-medium text-zinc-100">
                    {
                      item.title
                    }
                  </span>

                  <span className="ml-2 text-[8px] uppercase text-zinc-700">
                    {
                      item.categoryLabel
                    }
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 pr-3">
                  {availabilityBadges.length >
                  0 ? (
                    availabilityBadges.map(
                      (
                        badge,
                        index,
                      ) => (
                        <span
                          key={`${badge.label}-${index}`}
                          className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide ${getAvailabilityClass(
                            badge.tone,
                          )}`}
                        >
                          {
                            badge.label
                          }
                        </span>
                      ),
                    )
                  ) : (
                    <span className="text-[9px] text-zinc-700">
                      —
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-zinc-400">
                  {
                    formatDate(
                      item.date,
                    )
                  }
                </div>

                <div className="truncate text-[10px] text-zinc-500">
                  {
                    item.regionLabel ??
                    "—"
                  }
                </div>

                <div className="text-right">
                  {item.rating >
                  0 ? (
                    <>
                      <span className="font-semibold text-zinc-300">
                        {
                          item.rating.toFixed(
                            1,
                          )
                        }
                      </span>

                      <span className="ml-1 text-[9px] text-zinc-700">
                        /10
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-700">
                      —
                    </span>
                  )}
                </div>
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}