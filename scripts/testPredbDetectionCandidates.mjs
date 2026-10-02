const SEARCH_TERMS = [
  "WEB",
  "WEBRip",
  "WEB-DL",
  "HDCAM",
  "CAMRip",
  "TELESYNC",
  "HDTS",
];

function decodeHtmlEntities(
  value,
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
    .trim();
}

function stripHtml(
  value,
) {
  return decodeHtmlEntities(
    String(
      value ?? "",
    )
      .replace(
        /<[^>]+>/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim(),
  );
}

function getAttribute(
  html,
  attributeName,
) {
  const pattern =
    new RegExp(
      `${attributeName}=["']([^"']*)["']`,
      "i",
    );

  const match =
    html.match(
      pattern,
    );

  return match
    ? decodeHtmlEntities(
        match[1],
      )
    : null;
}

function getYearAndSuffix(
  releaseName,
) {
  /*
   * We classify only the technical
   * portion AFTER the movie year.
   *
   * This prevents false positives like:
   *
   * Madame.Web.2024.1080p.BluRay...
   *
   * "Web" is part of that movie title,
   * not its source quality.
   */
  const matches = [
    ...releaseName.matchAll(
      /(?:^|[._(\[\s-])((?:19|20)\d{2})(?=$|[._)\]\s-])/g,
    ),
  ];

  if (
    matches.length ===
    0
  ) {
    return {
      year:
        null,

      suffix:
        releaseName,
    };
  }

  const match =
    matches[
      matches.length -
        1
    ];

  const year =
    match[1];

  const matchIndex =
    match.index ??
    0;

  const yearPosition =
    releaseName.indexOf(
      year,
      matchIndex,
    );

  const suffix =
    releaseName.slice(
      yearPosition +
        year.length,
    );

  return {
    year,
    suffix,
  };
}

function normalizeTechnicalText(
  value,
) {
  return value
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function classifyRelease(
  releaseName,
) {
  const {
    year,
    suffix,
  } =
    getYearAndSuffix(
      releaseName,
    );

  const technical =
    normalizeTechnicalText(
      suffix,
    );

  const padded =
    ` ${technical} `;

  /*
   * Strong camera-source indicators.
   */
  const camSignals = [
    " HDCAM ",
    " CAMRIP ",
    " CAM RIP ",
    " TELESYNC ",
    " TELE SYNC ",
    " HDTS ",
    " HD TS ",
    " CAM ",
  ];

  if (
    camSignals.some(
      (
        signal,
      ) =>
        padded.includes(
          signal,
        ),
    )
  ) {
    return {
      detectionType:
        "CAM",

      year,

      technical,
    };
  }

  /*
   * Strong WEB indicators.
   */
  const webSignals = [
    " WEB DL ",
    " WEBDL ",
    " WEBRIP ",
    " WEB RIP ",
    " WEB ",
  ];

  if (
    webSignals.some(
      (
        signal,
      ) =>
        padded.includes(
          signal,
        ),
    )
  ) {
    return {
      detectionType:
        "WEB",

      year,

      technical,
    };
  }

  return {
    detectionType:
      null,

    year,

    technical,
  };
}

function parsePosts(
  html,
  searchTerm,
) {
  const starts = [
    ...html.matchAll(
      /<div\s+class=["']post["']\s+id=["'](\d+)["'][^>]*>/gi,
    ),
  ];

  const results =
    [];

  for (
    let index = 0;
    index <
    starts.length;
    index += 1
  ) {
    const current =
      starts[index];

    const next =
      starts[
        index + 1
      ];

    const postId =
      current[1];

    const start =
      current.index ??
      0;

    const end =
      next?.index ??
      html.length;

    const block =
      html.slice(
        start,
        end,
      );

    const titleMatch =
      block.match(
        /<a[^>]*class=["'][^"']*\bp-title\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      );

    if (
      !titleMatch
    ) {
      continue;
    }

    const releaseName =
      stripHtml(
        titleMatch[1],
      );

    if (
      !releaseName
    ) {
      continue;
    }

    const classification =
      classifyRelease(
        releaseName,
      );

    /*
     * Ignore PreDB search false
     * positives completely.
     */
    if (
      !classification
        .detectionType
    ) {
      continue;
    }

    const timeMatch =
      block.match(
        /<span[^>]*class=["'][^"']*\bp-time\b[^"']*["'][^>]*>/i,
      );

    const timeTag =
      timeMatch?.[0] ??
      "";

    const unixTimestamp =
      getAttribute(
        timeTag,
        "data",
      );

    const timestampTitle =
      getAttribute(
        timeTag,
        "title",
      );

    let detectedAt =
      null;

    if (
      unixTimestamp &&
      /^\d+$/.test(
        unixTimestamp,
      )
    ) {
      const date =
        new Date(
          Number(
            unixTimestamp,
          ) *
            1000,
        );

      if (
        !Number.isNaN(
          date.getTime(),
        )
      ) {
        detectedAt =
          date.toISOString();
      }
    }

    const childCategoryMatch =
      block.match(
        /<a[^>]*href=["'][^"']*\?cats=movies-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i,
      );

    const childCategory =
      childCategoryMatch
        ? stripHtml(
            childCategoryMatch[1],
          )
        : null;

    results.push({
      postId,

      searchTerm,

      releaseName,

      detectionType:
        classification
          .detectionType,

      year:
        classification
          .year,

      detectedAt,

      timestampTitle,

      childCategory,

      sourceUrl:
        `https://predb.me/?post=${postId}`,
    });
  }

  return results;
}

async function fetchSearch(
  searchTerm,
) {
  const url =
    `https://predb.me/?cats=movies&search=${encodeURIComponent(searchTerm)}`;

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 WatchLeaks-Research/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },

        redirect:
          "follow",
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `PreDB search "${searchTerm}" failed with HTTP ${response.status}.`,
    );
  }

  return response.text();
}

async function main() {
  console.log(
    "Finding strict PreDB CAM/WEB candidates...",
  );

  console.log("");

  const candidatesById =
    new Map();

  for (
    const searchTerm of
    SEARCH_TERMS
  ) {
    console.log(
      `Searching: ${searchTerm}`,
    );

    const html =
      await fetchSearch(
        searchTerm,
      );

    const candidates =
      parsePosts(
        html,
        searchTerm,
      );

    console.log(
      `Strict candidates: ${candidates.length}`,
    );

    for (
      const candidate of
      candidates
    ) {
      /*
       * The same PreDB post can appear
       * in several searches.
       *
       * Post ID gives us a stable
       * deduplication key.
       */
      if (
        !candidatesById.has(
          candidate.postId,
        )
      ) {
        candidatesById.set(
          candidate.postId,
          candidate,
        );
      }
    }

    console.log("");
  }

  const candidates = [
    ...candidatesById.values(),
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        a.detectedAt
          ? new Date(
              a.detectedAt,
            ).getTime()
          : 0;

      const bTime =
        b.detectedAt
          ? new Date(
              b.detectedAt,
            ).getTime()
          : 0;

      return (
        bTime -
        aTime
      );
    },
  );

  const camCandidates =
    candidates.filter(
      (
        candidate,
      ) =>
        candidate
          .detectionType ===
        "CAM",
    );

  const webCandidates =
    candidates.filter(
      (
        candidate,
      ) =>
        candidate
          .detectionType ===
        "WEB",
    );

  console.log(
    "========================================",
  );

  console.log(
    "STRICT RESULT SUMMARY",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Unique candidates: ${candidates.length}`,
  );

  console.log(
    `CAM: ${camCandidates.length}`,
  );

  console.log(
    `WEB: ${webCandidates.length}`,
  );

  console.log("");

  if (
    candidates.length ===
    0
  ) {
    console.log(
      "No strict CAM/WEB candidates found.",
    );

    console.log(
      "NO database changes were made.",
    );

    return;
  }

  for (
    const candidate of
    candidates
  ) {
    console.log(
      `[${candidate.detectionType}] ${candidate.releaseName}`,
    );

    console.log(
      `Year: ${candidate.year ?? "Unknown"}`,
    );

    console.log(
      `Pre time: ${candidate.detectedAt ?? candidate.timestampTitle ?? "Unavailable"}`,
    );

    console.log(
      `Category: Movies / ${candidate.childCategory ?? "Unavailable"}`,
    );

    console.log(
      `Found via search: ${candidate.searchTerm}`,
    );

    console.log(
      `Post ID: ${candidate.postId}`,
    );

    console.log(
      `URL: ${candidate.sourceUrl}`,
    );

    console.log(
      "----------------------------------------",
    );
  }

  console.log("");

  console.log(
    "NO database changes were made.",
  );
}

main()
  .catch(
    (
      error,
    ) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );