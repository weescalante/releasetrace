const SIGNALS = [
  "WEB-DL",
  "WEBDL",
  "WEBRip",
  "HDCAM",
  "CAMRip",
  "HDTS",
  "TELESYNC",
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

function parseReleaseNames(
  html,
) {
  const matches = [
    ...html.matchAll(
      /<a[^>]*class=["'][^"']*\bp-title\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];

  return matches
    .map(
      (
        match,
      ) =>
        stripHtml(
          match[1],
        ),
    )
    .filter(
      Boolean,
    );
}

async function testSignal(
  signal,
) {
  const url =
    `https://predb.me/?cats=movies&search=${encodeURIComponent(signal)}`;

  console.log(
    "========================================",
  );

  console.log(
    `Signal: ${signal}`,
  );

  console.log(
    `URL: ${url}`,
  );

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

  console.log(
    `HTTP status: ${response.status}`,
  );

  if (
    !response.ok
  ) {
    console.log(
      "Request failed.",
    );

    console.log("");

    return;
  }

  const html =
    await response.text();

  const releases =
    parseReleaseNames(
      html,
    );

  console.log(
    `Release rows found: ${releases.length}`,
  );

  if (
    releases.length ===
    0
  ) {
    console.log(
      "No matching movie releases found.",
    );

    console.log("");

    return;
  }

  console.log(
    "First matches:",
  );

  console.log("");

  for (
    const release of
    releases.slice(
      0,
      8,
    )
  ) {
    console.log(
      `- ${release}`,
    );
  }

  console.log("");
}

async function main() {
  console.log(
    "Testing PreDB for Watch Leaks signal types...",
  );

  console.log("");

  for (
    const signal of
    SIGNALS
  ) {
    await testSignal(
      signal,
    );
  }

  console.log(
    "========================================",
  );

  console.log(
    "Signal inspection complete.",
  );

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