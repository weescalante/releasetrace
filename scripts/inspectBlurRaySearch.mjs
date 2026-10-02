import fs from "fs";

const TEST_MOVIES = [
  {
    title:
      "Batman Knightfall Part 1 Knightfall",

    year:
      "2026",
  },

  {
    title:
      "Harbinger",

    year:
      "2026",
  },
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

function makeSlug(
  value,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function buildSearchUrl({
  title,
  year,
}) {
  const keyword =
    `${title} ${year}`;

  const params =
    new URLSearchParams({
      quicksearch:
        "1",

      quicksearch_country:
        "US",

      quicksearch_keyword:
        keyword,

      section:
        "bluraymovies",
    });

  return (
    "https://www.blu-ray.com/search/?" +
    params.toString()
  );
}

function normalizeUrl(
  href,
) {
  if (
    href.startsWith(
      "//",
    )
  ) {
    return `https:${href}`;
  }

  if (
    href.startsWith(
      "/",
    )
  ) {
    return `https://www.blu-ray.com${href}`;
  }

  return href;
}

function extractEditionCandidates(
  html,
) {
  const candidates =
    new Map();

  const anchorPattern =
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  for (
    const match of
    html.matchAll(
      anchorPattern,
    )
  ) {
    const attributes =
      `${match[1]} ${match[3]}`;

    const href =
      decodeHtml(
        match[2],
      );

    const url =
      normalizeUrl(
        href,
      );

    /*
     * We only care about individual
     * Blu-ray.com movie edition pages.
     *
     * Example:
     *
     * /movies/Movie-Title-Blu-ray/123456/
     *
     * This excludes generic navigation,
     * news, reviews, DVD, digital, etc.
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

    const titleAttributeMatch =
      attributes.match(
        /\btitle=["']([^"']+)["']/i,
      );

    const titleAttribute =
      titleAttributeMatch
        ? decodeHtml(
            titleAttributeMatch[1],
          ).trim()
        : "";

    const combined =
      `${url} ${text} ${titleAttribute}`
        .toLowerCase();

    /*
     * Restrict the candidates to physical
     * Blu-ray / UHD editions.
     */
    if (
      !combined.includes(
        "blu-ray",
      ) &&
      !combined.includes(
        "bluray",
      )
    ) {
      continue;
    }

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
      !candidates.has(
        key,
      )
    ) {
      candidates.set(
        key,
        {
          productId,

          url,

          text,

          titleAttribute,
        },
      );
    }
  }

  return [
    ...candidates.values(),
  ];
}

async function inspectMovie(
  movie,
) {
  const searchUrl =
    buildSearchUrl(
      movie,
    );

  console.log(
    "========================================",
  );

  console.log(
    `${movie.title} (${movie.year})`,
  );

  console.log(
    "========================================",
  );

  console.log(
    `Search URL: ${searchUrl}`,
  );

  console.log("");

  const response =
    await fetch(
      searchUrl,
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
      `Blu-ray.com search failed with ${response.status}.`,
    );
  }

  const html =
    await response.text();

  console.log(
    `HTML length: ${html.length} characters`,
  );

  const slug =
    makeSlug(
      `${movie.title}-${movie.year}`,
    );

  const output =
    `scripts/bluray-com-search-${slug}.html`;

  fs.writeFileSync(
    output,
    html,
    "utf8",
  );

  console.log(
    `Saved: ${output}`,
  );

  console.log("");

  const candidates =
    extractEditionCandidates(
      html,
    );

  console.log(
    `Physical edition candidates found: ${candidates.length}`,
  );

  console.log("");

  if (
    candidates.length ===
    0
  ) {
    console.log(
      "No Blu-ray edition candidates detected.",
    );

    console.log("");

    return;
  }

  for (
    const [
      index,
      candidate,
    ] of candidates
      .slice(
        0,
        20,
      )
      .entries()
  ) {
    console.log(
      `${index + 1}. ${
        candidate.titleAttribute ||
        candidate.text ||
        "Untitled edition"
      }`,
    );

    console.log(
      `   Product ID: ${
        candidate.productId ??
        "Unknown"
      }`,
    );

    console.log(
      `   Text: ${
        candidate.text ||
        "Unavailable"
      }`,
    );

    console.log(
      `   URL: ${candidate.url}`,
    );

    console.log("");
  }
}

async function main() {
  console.log(
    "Testing Blu-ray.com title search...",
  );

  console.log("");

  for (
    const movie of
    TEST_MOVIES
  ) {
    await inspectMovie(
      movie,
    );

    console.log("");
  }

  console.log(
    "Blu-ray.com search inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "Blu-ray.com search inspection failed:",
      error,
    );

    process.exitCode =
      1;
  },
);