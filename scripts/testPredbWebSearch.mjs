import {
  parsePredbMoviesHtml,
} from "../data/predb.ts";

const URL =
  "https://predb.me/?cats=movies&search=WEB";

async function main() {
  console.log(
    "Testing PreDB WEB search...",
  );

  console.log(URL);
  console.log("");

  const response =
    await fetch(
      URL,
      {
        headers: {
          "User-Agent":
            "WatchLeaks/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },

        cache:
          "no-store",
      },
    );

  console.log(
    `HTTP status: ${response.status}`,
  );

  if (!response.ok) {
    throw new Error(
      `PreDB request failed with status ${response.status}.`,
    );
  }

  const html =
    await response.text();

  const all =
    parsePredbMoviesHtml(
      html,
    );

  const web =
    all.filter(
      (release) =>
        release.signal ===
        "WEB",
    );

  const bluray =
    all.filter(
      (release) =>
        release.signal ===
        "BLURAY",
    );

  const other =
    all.filter(
      (release) =>
        release.signal ===
        "OTHER",
    );

  console.log("");
  console.log(
    `Rows parsed: ${all.length}`,
  );

  console.log(
    `WEB: ${web.length}`,
  );

  console.log(
    `BLURAY: ${bluray.length}`,
  );

  console.log(
    `OTHER: ${other.length}`,
  );

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "LATEST WEB RELEASES",
  );

  console.log(
    "========================================",
  );

  console.log("");

  for (
    const release of
    web.slice(
      0,
      20,
    )
  ) {
    console.log(
      `[WEB] ${release.releaseName}`,
    );

    console.log(
      `Title: ${release.normalizedTitle}`,
    );

    console.log(
      `Year: ${release.year}`,
    );

    console.log(
      `Quality: ${release.quality}`,
    );

    console.log(
      `Pre time: ${release.publishedAt}`,
    );

    console.log(
      `Post ID: ${release.postId}`,
    );

    console.log(
      `URL: ${release.sourceUrl}`,
    );

    console.log(
      "----------------------------------------",
    );
  }

  console.log("");

  console.log(
    "PreDB WEB search test complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "PreDB WEB search test failed:",
      error,
    );

    process.exitCode =
      1;
  },
);