import fs from "fs";

const PAGES = [
  {
    label:
      "September 2026",

    url:
      "https://www.blu-ray.com/movies/releasedates.php?month=9&year=2026",

    output:
      "scripts/bluray-calendar-2026-09.html",
  },

  {
    label:
      "October 2026",

    url:
      "https://www.blu-ray.com/movies/releasedates.php?month=10&year=2026",

    output:
      "scripts/bluray-calendar-2026-10.html",
  },
];

const TEST_TITLES = [
  "Batman",
  "Knightfall",
  "Harbinger",
];

function decodeHtml(
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
    .replace(
      /&nbsp;/gi,
      " ",
    );
}

function stripTags(
  value,
) {
  return decodeHtml(
    value,
  )
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " ",
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " ",
    )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeUrl(
  href,
) {
  const decoded =
    decodeHtml(
      href,
    );

  if (
    decoded.startsWith(
      "//",
    )
  ) {
    return `https:${decoded}`;
  }

  if (
    decoded.startsWith(
      "/",
    )
  ) {
    return `https://www.blu-ray.com${decoded}`;
  }

  return decoded;
}

function extractMovieLinks(
  html,
) {
  const results =
    new Map();

  const pattern =
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  for (
    const match of
    html.matchAll(
      pattern,
    )
  ) {
    const url =
      normalizeUrl(
        match[2],
      );

    /*
     * Blu-ray.com physical edition pages
     * normally look like:
     *
     * /movies/Title-Blu-ray/123456/
     *
     * or:
     *
     * /movies/Title-4K-Blu-ray/123456/
     */
    if (
      !/^https:\/\/www\.blu-ray\.com\/movies\/[^?#]+\/\d+\/?(?:[?#].*)?$/i.test(
        url,
      )
    ) {
      continue;
    }

    const text =
      stripTags(
        match[4],
      );

    const productIdMatch =
      url.match(
        /\/(\d+)\/?(?:[?#].*)?$/,
      );

    const productId =
      productIdMatch
        ? productIdMatch[1]
        : null;

    const key =
      productId ??
      url;

    if (
      results.has(
        key,
      )
    ) {
      continue;
    }

    results.set(
      key,
      {
        productId,
        text,
        url,
      },
    );
  }

  return [
    ...results.values(),
  ];
}

function findPossibleDates(
  html,
) {
  const patterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/gi,

    /\b20\d{2}-\d{2}-\d{2}\b/g,

    /\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g,
  ];

  const dates =
    new Set();

  for (
    const pattern of
    patterns
  ) {
    const matches =
      html.match(
        pattern,
      ) ?? [];

    for (
      const match of
      matches
    ) {
      dates.add(
        match,
      );
    }
  }

  return [
    ...dates,
  ];
}

function printTitleSnippet(
  html,
  title,
) {
  const index =
    html
      .toLowerCase()
      .indexOf(
        title.toLowerCase(),
      );

  console.log(
    `${title}: ${
      index >= 0
        ? "FOUND"
        : "NOT FOUND"
    }`,
  );

  if (
    index < 0
  ) {
    return;
  }

  const start =
    Math.max(
      0,
      index -
        600,
    );

  const end =
    Math.min(
      html.length,
      index +
        1200,
    );

  console.log(
    stripTags(
      html.slice(
        start,
        end,
      ),
    ),
  );

  console.log("");
}

async function inspectPage(
  page,
) {
  console.log(
    "========================================",
  );

  console.log(
    page.label,
  );

  console.log(
    "========================================",
  );

  console.log(
    page.url,
  );

  console.log("");

  const response =
    await fetch(
      page.url,
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

  console.log(
    `HTTP status: ${response.status}`,
  );

  console.log(
    `Final URL: ${response.url}`,
  );

  console.log(
    `Content-Type: ${
      response.headers.get(
        "content-type",
      ) ??
      "Unknown"
    }`,
  );

  if (
    !response.ok
  ) {
    throw new Error(
      `${page.label} failed with HTTP ${response.status}.`,
    );
  }

  const html =
    await response.text();

  console.log(
    `HTML length: ${html.length} characters`,
  );

  console.log(
    `No-index response: ${
      html.includes(
        ">No index.<",
      )
        ? "YES"
        : "NO"
    }`,
  );

  fs.writeFileSync(
    page.output,
    html,
    "utf8",
  );

  console.log(
    `Saved: ${page.output}`,
  );

  console.log("");

  const dates =
    findPossibleDates(
      html,
    );

  console.log(
    `Possible dates found: ${dates.length}`,
  );

  for (
    const date of
    dates.slice(
      0,
      30,
    )
  ) {
    console.log(
      `- ${date}`,
    );
  }

  console.log("");

  const movieLinks =
    extractMovieLinks(
      html,
    );

  console.log(
    `Blu-ray movie/edition links found: ${movieLinks.length}`,
  );

  console.log("");

  console.log(
    "First 20 movie links:",
  );

  console.log("");

  for (
    const [
      index,
      movie,
    ] of movieLinks
      .slice(
        0,
        20,
      )
      .entries()
  ) {
    console.log(
      `${index + 1}. ${
        movie.text ||
        "Untitled"
      }`,
    );

    console.log(
      `   Product ID: ${
        movie.productId ??
        "Unknown"
      }`,
    );

    console.log(
      `   ${movie.url}`,
    );

    console.log("");
  }

  console.log(
    "Test-title checks:",
  );

  console.log("");

  for (
    const title of
    TEST_TITLES
  ) {
    printTitleSnippet(
      html,
      title,
    );
  }

  console.log("");
}

async function main() {
  console.log(
    "Testing Blu-ray.com release calendar...",
  );

  console.log("");

  for (
    const page of
    PAGES
  ) {
    await inspectPage(
      page,
    );
  }

  console.log(
    "Blu-ray.com release-calendar inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "Blu-ray.com release-calendar inspection failed:",
      error,
    );

    process.exitCode =
      1;
  },
);