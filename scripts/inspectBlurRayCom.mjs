import fs from "fs";

const TEST_URL =
  "https://www.blu-ray.com/Batman-Knightfall-Part-1-Knightfall/2127158/";

async function main() {
  console.log(
    "Testing Blu-ray.com access...",
  );

  console.log(
    TEST_URL,
  );

  console.log("");

  const response =
    await fetch(
      TEST_URL,
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
      ) ?? "Unknown"
    }`,
  );

  const html =
    await response.text();

  console.log(
    `HTML length: ${html.length} characters`,
  );

  const outputPath =
    "scripts/bluray-com-batman-sample.html";

  fs.writeFileSync(
    outputPath,
    html,
    "utf8",
  );

  console.log(
    `Saved raw HTML to ${outputPath}`,
  );

  console.log("");

  const checks = [
    "Batman",
    "Knightfall",
    "Blu-ray",
    "4K Blu-ray",
    "Release",
    "Sep 8",
    "September 8",
    "2026",
  ];

  console.log(
    "HTML checks:",
  );

  console.log("");

  for (
    const value of
    checks
  ) {
    console.log(
      `${value}: ${
        html
          .toLowerCase()
          .includes(
            value.toLowerCase(),
          )
          ? "FOUND"
          : "NOT FOUND"
      }`,
    );
  }

  console.log("");

  const datePatterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+2026\b/gi,

    /\b2026-\d{2}-\d{2}\b/g,

    /\b\d{1,2}\/\d{1,2}\/2026\b/g,
  ];

  const discoveredDates =
    new Set();

  for (
    const pattern of
    datePatterns
  ) {
    const matches =
      html.match(
        pattern,
      ) ?? [];

    for (
      const match of
      matches
    ) {
      discoveredDates.add(
        match,
      );
    }
  }

  console.log(
    "Possible 2026 dates found:",
  );

  console.log("");

  if (
    discoveredDates.size ===
    0
  ) {
    console.log(
      "None found in raw HTML.",
    );
  } else {
    for (
      const date of
      discoveredDates
    ) {
      console.log(
        `- ${date}`,
      );
    }
  }

  console.log("");

  console.log(
    "Blu-ray.com inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "Blu-ray.com inspection failed:",
      error,
    );

    process.exitCode =
      1;
  },
);