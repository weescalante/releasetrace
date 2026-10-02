import fs from "fs";

const EDITIONS = [
  {
    label:
      "Blu-ray",

    url:
      "https://www.blu-ray.com/movies/Batman-Knightfall-Part-1-Blu-ray/415327/",

    output:
      "scripts/bluray-com-batman-bluray-edition.html",
  },

  {
    label:
      "4K Blu-ray",

    url:
      "https://www.blu-ray.com/movies/Batman-Knightfall-Part-1-4K-Blu-ray/415328/",

    output:
      "scripts/bluray-com-batman-4k-edition.html",
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

function printMatches(
  html,
  pattern,
  label,
  limit = 10,
) {
  console.log(
    `--- ${label} ---`,
  );

  const matches = [
    ...html.matchAll(
      pattern,
    ),
  ];

  console.log(
    `Matches: ${matches.length}`,
  );

  if (
    matches.length ===
    0
  ) {
    console.log(
      "None found.",
    );

    console.log("");

    return;
  }

  for (
    const [
      index,
      match,
    ] of matches
      .slice(
        0,
        limit,
      )
      .entries()
  ) {
    const matchIndex =
      match.index ??
      0;

    const start =
      Math.max(
        0,
        matchIndex -
          700,
      );

    const end =
      Math.min(
        html.length,
        matchIndex +
          1200,
      );

    const snippet =
      stripTags(
        html.slice(
          start,
          end,
        ),
      );

    console.log(
      `${index + 1}. ${snippet}`,
    );

    console.log("");
  }
}

function findPossibleDates(
  html,
) {
  const patterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/gi,

    /\b20\d{2}-\d{2}-\d{2}\b/g,

    /\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g,

    /\b\d{1,2}-\d{1,2}-20\d{2}\b/g,
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

async function inspectEdition(
  edition,
) {
  console.log(
    "========================================",
  );

  console.log(
    edition.label,
  );

  console.log(
    "========================================",
  );

  console.log(
    edition.url,
  );

  console.log("");

  const response =
    await fetch(
      edition.url,
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
      `${edition.label} request failed with ${response.status}.`,
    );
  }

  const html =
    await response.text();

  console.log(
    `HTML length: ${html.length} characters`,
  );

  fs.writeFileSync(
    edition.output,
    html,
    "utf8",
  );

  console.log(
    `Saved: ${edition.output}`,
  );

  console.log("");

  const possibleDates =
    findPossibleDates(
      html,
    );

  console.log(
    "Possible dates:",
  );

  if (
    possibleDates.length ===
    0
  ) {
    console.log(
      "None found.",
    );
  } else {
    for (
      const date of
      possibleDates
    ) {
      console.log(
        `- ${date}`,
      );
    }
  }

  console.log("");

  printMatches(
    html,
    /release\s*date/gi,
    "RELEASE DATE",
  );

  printMatches(
    html,
    /\brelease\b/gi,
    "RELEASE",
    15,
  );

  printMatches(
    html,
    /\bSep(?:t(?:ember)?)?\.?\s+\d{1,2}/gi,
    "SEPTEMBER DATE TEXT",
  );

  printMatches(
    html,
    /\b2026\b/gi,
    "2026",
    15,
  );

  printMatches(
    html,
    /United States|USA|U\.S\./gi,
    "US REGION",
    10,
  );
}

async function main() {
  console.log(
    "Inspecting Blu-ray.com edition pages...",
  );

  console.log("");

  for (
    const edition of
    EDITIONS
  ) {
    await inspectEdition(
      edition,
    );

    console.log("");
  }

  console.log(
    "Blu-ray.com edition inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "Blu-ray.com edition inspection failed:",
      error,
    );

    process.exitCode =
      1;
  },
);