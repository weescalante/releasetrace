import fs from "fs";

const INPUT_FILE =
  "scripts/bluray-com-batman-sample.html";

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

function printSnippets({
  html,
  label,
  pattern,
  limit = 8,
}) {
  console.log(
    "========================================",
  );

  console.log(
    label,
  );

  console.log(
    "========================================",
  );

  const matches = [
    ...html.matchAll(
      pattern,
    ),
  ];

  console.log(
    `Matches found: ${matches.length}`,
  );

  console.log("");

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
          500,
      );

    const end =
      Math.min(
        html.length,
        matchIndex +
          900,
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

function extractBluRayLinks(
  html,
) {
  const links =
    new Map();

  const anchorPattern =
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  for (
    const match of
    html.matchAll(
      anchorPattern,
    )
  ) {
    const href =
      decodeHtml(
        match[2],
      );

    const text =
      stripTags(
        match[4],
      );

    const combined =
      `${href} ${text}`
        .toLowerCase();

    if (
      !combined.includes(
        "blu-ray",
      ) &&
      !combined.includes(
        "bluray",
      ) &&
      !combined.includes(
        "4k",
      ) &&
      !combined.includes(
        "uhd",
      )
    ) {
      continue;
    }

    let absoluteUrl =
      href;

    if (
      href.startsWith(
        "//",
      )
    ) {
      absoluteUrl =
        `https:${href}`;
    } else if (
      href.startsWith(
        "/",
      )
    ) {
      absoluteUrl =
        `https://www.blu-ray.com${href}`;
    }

    if (
      !absoluteUrl.startsWith(
        "http",
      )
    ) {
      continue;
    }

    links.set(
      absoluteUrl,
      text,
    );
  }

  return [
    ...links.entries(),
  ].map(
    (
      [
        url,
        text,
      ],
    ) => ({
      url,
      text,
    }),
  );
}

function inspectStructuredData(
  html,
) {
  console.log(
    "========================================",
  );

  console.log(
    "STRUCTURED DATA",
  );

  console.log(
    "========================================",
  );

  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  console.log(
    `JSON-LD blocks found: ${scripts.length}`,
  );

  console.log("");

  if (
    scripts.length ===
    0
  ) {
    console.log(
      "No JSON-LD blocks found.",
    );

    console.log("");

    return;
  }

  for (
    const [
      index,
      script,
    ] of scripts.entries()
  ) {
    const content =
      decodeHtml(
        script[1],
      ).trim();

    console.log(
      `JSON-LD block ${index + 1}:`,
    );

    const dateMatches = [
      ...content.matchAll(
        /"(datePublished|releaseDate|dateCreated|uploadDate)"\s*:\s*"([^"]+)"/gi,
      ),
    ];

    if (
      dateMatches.length ===
      0
    ) {
      console.log(
        "No obvious date fields.",
      );
    } else {
      for (
        const dateMatch of
        dateMatches
      ) {
        console.log(
          `${dateMatch[1]}: ${dateMatch[2]}`,
        );
      }
    }

    console.log("");
  }
}

function main() {
  if (
    !fs.existsSync(
      INPUT_FILE,
    )
  ) {
    throw new Error(
      `Missing input file: ${INPUT_FILE}`,
    );
  }

  const html =
    fs.readFileSync(
      INPUT_FILE,
      "utf8",
    );

  console.log(
    "Inspecting saved Blu-ray.com HTML...",
  );

  console.log(
    INPUT_FILE,
  );

  console.log("");

  console.log(
    `HTML length: ${html.length} characters`,
  );

  console.log("");

  inspectStructuredData(
    html,
  );

  printSnippets({
    html,

    label:
      "RELEASE DATE TEXT",

    pattern:
      /release\s*date/gi,

    limit:
      10,
  });

  printSnippets({
    html,

    label:
      "4K BLU-RAY TEXT",

    pattern:
      /4K\s*Blu-ray/gi,

    limit:
      10,
  });

  printSnippets({
    html,

    label:
      "BLU-RAY TEXT",

    pattern:
      /\bBlu-ray\b/gi,

    limit:
      10,
  });

  printSnippets({
    html,

    label:
      "2026 TEXT",

    pattern:
      /2026/gi,

    limit:
      15,
  });

  const links =
    extractBluRayLinks(
      html,
    );

  console.log(
    "========================================",
  );

  console.log(
    "POSSIBLE BLU-RAY EDITION LINKS",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Candidate links found: ${links.length}`,
  );

  console.log("");

  for (
    const [
      index,
      link,
    ] of links
      .slice(
        0,
        30,
      )
      .entries()
  ) {
    console.log(
      `${index + 1}. ${link.text || "(no link text)"}`,
    );

    console.log(
      `   ${link.url}`,
    );

    console.log("");
  }

  console.log(
    "Blu-ray.com structure inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

try {
  main();
} catch (error) {
  console.error(
    "Blu-ray.com structure inspection failed:",
    error,
  );

  process.exitCode =
    1;
}