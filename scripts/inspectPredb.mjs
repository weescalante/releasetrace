import fs from "fs";

const PREDB_MOVIES_URL =
  "https://predb.me/?cats=movies";

function decodeHtmlEntities(
  value,
) {
  return value
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
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    );
}

function stripHtml(
  value,
) {
  return decodeHtmlEntities(
    value
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

async function main() {
  console.log(
    "Fetching PreDB Movies page...",
  );

  console.log(
    PREDB_MOVIES_URL,
  );

  console.log("");

  const response =
    await fetch(
      PREDB_MOVIES_URL,
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
    `Content-Type: ${response.headers.get("content-type") ?? "Unknown"}`,
  );

  if (
    !response.ok
  ) {
    throw new Error(
      `PreDB request failed with status ${response.status}.`,
    );
  }

  const html =
    await response.text();

  console.log(
    `HTML length: ${html.length} characters`,
  );

  /*
   * Save the raw HTML so we can inspect
   * the exact structure without repeatedly
   * hitting PreDB.
   */
  const outputPath =
    "scripts/predb-movies-sample.html";

  fs.writeFileSync(
    outputPath,
    html,
    "utf8",
  );

  console.log(
    `Saved raw HTML to ${outputPath}`,
  );

  console.log("");

  /*
   * PreDB release-detail links currently
   * use:
   *
   * ?post=<numeric ID>
   *
   * This diagnostic extracts those links
   * without making any database changes.
   */
  const releasePattern =
    /<a[^>]+href=["']([^"']*\?post=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  const releases =
    [];

  const seenIds =
    new Set();

  let match;

  while (
    (
      match =
        releasePattern.exec(
          html,
        )
    ) !==
    null
  ) {
    const href =
      match[1];

    const postId =
      match[2];

    const title =
      stripHtml(
        match[3],
      );

    if (
      !title ||
      seenIds.has(
        postId,
      )
    ) {
      continue;
    }

    seenIds.add(
      postId,
    );

    releases.push({
      postId,
      title,
      href,
    });
  }

  console.log(
    `Release links found: ${releases.length}`,
  );

  console.log("");

  if (
    releases.length ===
    0
  ) {
    console.log(
      "No ?post= release links were found.",
    );

    console.log(
      "Do not build an ingestion parser yet — we need to inspect the saved HTML.",
    );

    return;
  }

  console.log(
    "First 10 releases:",
  );

  console.log("");

  for (
    const [
      index,
      release,
    ] of releases
      .slice(
        0,
        10,
      )
      .entries()
  ) {
    console.log(
      `${index + 1}. ${release.title}`,
    );

    console.log(
      `   Post ID: ${release.postId}`,
    );

    console.log(
      `   Link: ${release.href}`,
    );

    console.log("");
  }

  /*
   * Fetch exactly ONE detail page so we can
   * determine whether PreDB exposes an exact
   * pre timestamp, category, NFO metadata,
   * or other useful fields.
   */
  const firstRelease =
    releases[0];

  const detailUrl =
    new URL(
      firstRelease.href,
      PREDB_MOVIES_URL,
    ).toString();

  console.log(
    "Fetching one release detail page...",
  );

  console.log(
    detailUrl,
  );

  const detailResponse =
    await fetch(
      detailUrl,
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
    `Detail HTTP status: ${detailResponse.status}`,
  );

  if (
    !detailResponse.ok
  ) {
    console.log(
      "Detail page could not be fetched.",
    );

    console.log(
      "The Movies listing itself was still captured successfully.",
    );

    return;
  }

  const detailHtml =
    await detailResponse.text();

  const detailOutputPath =
    "scripts/predb-detail-sample.html";

  fs.writeFileSync(
    detailOutputPath,
    detailHtml,
    "utf8",
  );

  console.log(
    `Saved detail HTML to ${detailOutputPath}`,
  );

  console.log(
    `Detail HTML length: ${detailHtml.length} characters`,
  );

  console.log("");

  console.log(
    "PreDB inspection completed.",
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