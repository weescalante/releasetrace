const BLURAY_BASE_URL =
  "https://www.blu-ray.com";

const BLURAY_CALENDAR_URL =
  `${BLURAY_BASE_URL}/movies/releasedates.php`;

const DAY_IN_MS =
  24 *
  60 *
  60 *
  1000;

export type BluRayComFormat =
  | "BLURAY"
  | "4K_BLURAY";

export type BluRayComRelease = {
  productId: number;

  title: string;

  normalizedTitle: string;

  movieYear:
    string | null;

  releaseDate: string;

  releaseDateIso:
    string | null;

  format:
    BluRayComFormat;

  studio:
    string | null;

  edition:
    string | null;

  extended:
    string | null;

  titleKeywords:
    string | null;

  sourceUrl:
    string | null;

  calendarMonth: number;

  calendarYear: number;
};

type CalendarMonth = {
  year: number;

  month: number;
};

function decodeHtml(
  value:
    string | null |
    undefined,
) {
  return String(
    value ?? "",
  )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#039;/gi,
      "'",
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&apos;/gi,
      "'",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&#(\d+);/g,
      (
        _match,
        code,
      ) => {
        const numericCode =
          Number(
            code,
          );

        if (
          Number.isNaN(
            numericCode,
          )
        ) {
          return "";
        }

        return String.fromCodePoint(
          numericCode,
        );
      },
    );
}

function decodeJsString(
  value:
    string | null |
    undefined,
) {
  return decodeHtml(
    String(
      value ?? "",
    )
      .replace(
        /\\'/g,
        "'",
      )
      .replace(
        /\\"/g,
        '"',
      )
      .replace(
        /\\\\/g,
        "\\",
      ),
  ).trim();
}

function normalizeWhitespace(
  value: string,
) {
  return value
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

export function normalizeBluRayTitle(
  value:
    string | null |
    undefined,
) {
  return normalizeWhitespace(
    decodeHtml(
      value,
    )
      .toLowerCase()

      /*
       * Blu-ray.com commonly appends these
       * format markers to the displayed title.
       *
       * They are not part of the movie title.
       */
      .replace(
        /\b4k\b/g,
        " ",
      )
      .replace(
        /\buhd\b/g,
        " ",
      )
      .replace(
        /\bblu[\s-]?ray\b/g,
        " ",
      )

      /*
       * Normalize punctuation so titles such
       * as:
       *
       * Batman Knightfall: Part 1
       *
       * and
       *
       * Batman.Knightfall.Part.1
       *
       * can later be compared reliably.
       */
      .replace(
        /&/g,
        " and ",
      )
      .replace(
        /[^a-z0-9]+/g,
        " ",
      ),
  );
}

function getStringField(
  objectText: string,
  fieldName: string,
) {
  const pattern =
    new RegExp(
      `\\b${fieldName}\\s*:\\s*'((?:\\\\.|[^'])*)'`,
      "i",
    );

  const match =
    objectText.match(
      pattern,
    );

  if (!match) {
    return null;
  }

  const value =
    decodeJsString(
      match[1],
    );

  return value ||
    null;
}

function getNumberField(
  objectText: string,
  fieldName: string,
) {
  const pattern =
    new RegExp(
      `\\b${fieldName}\\s*:\\s*(\\d+)`,
      "i",
    );

  const match =
    objectText.match(
      pattern,
    );

  if (!match) {
    return null;
  }

  const value =
    Number(
      match[1],
    );

  if (
    Number.isNaN(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function inferFormat({
  title,
  titleKeywords,
}: {
  title:
    string | null;

  titleKeywords:
    string | null;
}): BluRayComFormat {
  const combined =
    `${title ?? ""} ${titleKeywords ?? ""}`
      .toLowerCase();

  if (
    combined.includes(
      "4k",
    ) ||
    combined.includes(
      "uhd",
    )
  ) {
    return "4K_BLURAY";
  }

  return "BLURAY";
}

function buildEditionUrl({
  productId,
  titleKeywords,
}: {
  productId: number;

  titleKeywords:
    string | null;
}) {
  if (
    !titleKeywords
  ) {
    return null;
  }

  return (
    `${BLURAY_BASE_URL}/movies/` +
    `${titleKeywords}-Blu-ray/` +
    `${productId}/`
  );
}

function parseBluRayDate(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  /*
   * Example:
   *
   * September 08, 2026
   *
   * We parse at UTC noon rather than
   * midnight to avoid accidental date
   * shifts when environments use different
   * local time zones.
   */
  const parsed =
    new Date(
      `${value} 12:00:00 UTC`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return parsed
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function parseBluRayCalendarHtml({
  html,
  calendarYear,
  calendarMonth,
}: {
  html: string;

  calendarYear: number;

  calendarMonth: number;
}): BluRayComRelease[] {
  const releases:
    BluRayComRelease[] =
    [];

  const pattern =
    /movies\[(\d+)\]\s*=\s*\{([\s\S]*?)\};/gi;

  for (
    const match of
    html.matchAll(
      pattern,
    )
  ) {
    const objectText =
      match[2];

    const productId =
      getNumberField(
        objectText,
        "id",
      );

    const title =
      getStringField(
        objectText,
        "title",
      );

    const movieYear =
      getStringField(
        objectText,
        "year",
      );

    const releaseDate =
      getStringField(
        objectText,
        "releasedate",
      );

    const studio =
      getStringField(
        objectText,
        "studio",
      );

    const edition =
      getStringField(
        objectText,
        "edition",
      );

    const extended =
      getStringField(
        objectText,
        "extended",
      );

    const titleKeywords =
      getStringField(
        objectText,
        "title_keywords",
      );

    if (
      productId ===
        null ||
      !title ||
      !releaseDate
    ) {
      continue;
    }

    releases.push({
      productId,

      title,

      normalizedTitle:
        normalizeBluRayTitle(
          title,
        ),

      movieYear,

      releaseDate,

      releaseDateIso:
        parseBluRayDate(
          releaseDate,
        ),

      format:
        inferFormat({
          title,

          titleKeywords,
        }),

      studio,

      edition,

      extended,

      titleKeywords,

      sourceUrl:
        buildEditionUrl({
          productId,

          titleKeywords,
        }),

      calendarMonth,

      calendarYear,
    });
  }

  return releases;
}

function buildCalendarUrl({
  year,
  month,
}: CalendarMonth) {
  const params =
    new URLSearchParams({
      month:
        String(
          month,
        ),

      year:
        String(
          year,
        ),
    });

  return (
    `${BLURAY_CALENDAR_URL}?` +
    params.toString()
  );
}

async function fetchCalendarMonth({
  year,
  month,
}: CalendarMonth) {
  const url =
    buildCalendarUrl({
      year,
      month,
    });

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 WatchLeaks/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },

        redirect:
          "follow",

        /*
         * We want the automated ingestion
         * process to receive current calendar
         * data rather than a stale framework
         * cache.
         */
        cache:
          "no-store",
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Blu-ray.com calendar request failed for ${year}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}: HTTP ${response.status}.`,
    );
  }

  const html =
    await response.text();

  if (
    html.includes(
      ">No index.<",
    )
  ) {
    throw new Error(
      `Blu-ray.com returned a no-index response for ${year}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}.`,
    );
  }

  return parseBluRayCalendarHtml({
    html,

    calendarYear:
      year,

    calendarMonth:
      month,
  });
}

function monthKey({
  year,
  month,
}: CalendarMonth) {
  return (
    `${year}-` +
    String(
      month,
    ).padStart(
      2,
      "0",
    )
  );
}

function getCalendarMonthsForWindow({
  now,
  daysBefore,
  daysAfter,
}: {
  now: Date;

  daysBefore: number;

  daysAfter: number;
}) {
  const start =
    new Date(
      now.getTime() -
        daysBefore *
          DAY_IN_MS,
    );

  const end =
    new Date(
      now.getTime() +
        daysAfter *
          DAY_IN_MS,
    );

  /*
   * Work month-by-month in UTC.
   *
   * If today is October 1 and the window
   * reaches 90 days backward and forward,
   * this automatically covers the required
   * calendar months without any hard-coded
   * year.
   */
  const cursor =
    new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        1,
        12,
        0,
        0,
      ),
    );

  const finalMonth =
    new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        1,
        12,
        0,
        0,
      ),
    );

  const months:
    CalendarMonth[] =
    [];

  while (
    cursor.getTime() <=
    finalMonth.getTime()
  ) {
    months.push({
      year:
        cursor
          .getUTCFullYear(),

      month:
        cursor
          .getUTCMonth() +
        1,
    });

    cursor.setUTCMonth(
      cursor.getUTCMonth() +
        1,
    );
  }

  return months;
}

function dedupeCalendarReleases(
  releases:
    BluRayComRelease[],
) {
  const byProductId =
    new Map<
      number,
      BluRayComRelease
    >();

  for (
    const release of
    releases
  ) {
    const existing =
      byProductId.get(
        release.productId,
      );

    if (!existing) {
      byProductId.set(
        release.productId,
        release,
      );

      continue;
    }

    /*
     * If Blu-ray.com happens to expose the
     * same product on overlapping calendar
     * pages, retain the record with the
     * parseable release date.
     */
    if (
      !existing
        .releaseDateIso &&
      release
        .releaseDateIso
    ) {
      byProductId.set(
        release.productId,
        release,
      );
    }
  }

  return [
    ...byProductId.values(),
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        a.releaseDateIso
          ? new Date(
              `${a.releaseDateIso}T12:00:00Z`,
            ).getTime()
          : 0;

      const bTime =
        b.releaseDateIso
          ? new Date(
              `${b.releaseDateIso}T12:00:00Z`,
            ).getTime()
          : 0;

      if (
        aTime !==
        bTime
      ) {
        return (
          aTime -
          bTime
        );
      }

      return a.title
        .localeCompare(
          b.title,
        );
    },
  );
}

export async function getBluRayComReleaseWindow({
  daysBefore = 90,
  daysAfter = 90,
  now = new Date(),
}: {
  daysBefore?: number;

  daysAfter?: number;

  now?: Date;
} = {}) {
  const months =
    getCalendarMonthsForWindow({
      now,

      daysBefore,

      daysAfter,
    });

  const monthResults =
    await Promise.all(
      months.map(
        async (
          month,
        ) => {
          const releases =
            await fetchCalendarMonth(
              month,
            );

          return {
            month:
              monthKey(
                month,
              ),

            releases,
          };
        },
      ),
    );

  const combined =
    monthResults.flatMap(
      (
        result,
      ) =>
        result.releases,
    );

  const deduped =
    dedupeCalendarReleases(
      combined,
    );

  const startTime =
    now.getTime() -
    daysBefore *
      DAY_IN_MS;

  const endTime =
    now.getTime() +
    daysAfter *
      DAY_IN_MS;

  /*
   * Calendar pages include entire months.
   *
   * Trim the result back down to the exact
   * rolling day window requested by
   * Watch Leaks.
   */
  const releases =
    deduped.filter(
      (
        release,
      ) => {
        if (
          !release
            .releaseDateIso
        ) {
          return false;
        }

        const timestamp =
          new Date(
            `${release.releaseDateIso}T12:00:00Z`,
          ).getTime();

        return (
          timestamp >=
            startTime &&
          timestamp <=
            endTime
        );
      },
    );

  return {
    source:
      "Blu-ray.com",

    fetchedAt:
      new Date()
        .toISOString(),

    window: {
      daysBefore,

      daysAfter,

      start:
        new Date(
          startTime,
        ).toISOString(),

      end:
        new Date(
          endTime,
        ).toISOString(),
    },

    months:
      monthResults.map(
        (
          result,
        ) =>
          result.month,
      ),

    total:
      releases.length,

    releases,
  };
}