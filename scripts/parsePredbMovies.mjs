import fs from "fs";

const INPUT_FILE =
  "scripts/predb-movies-sample.html";

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

function classifyRelease(
  releaseName,
) {
  const upper =
    releaseName.toUpperCase();

  /*
   * Camera-source signals.
   */
  if (
    /\bCAM\b/.test(
      upper,
    ) ||
    /\bCAMRIP\b/.test(
      upper,
    ) ||
    /\bHDCAM\b/.test(
      upper,
    ) ||
    /\bHDTS\b/.test(
      upper,
    ) ||
    /\bTELESYNC\b/.test(
      upper,
    ) ||
    /\bTS\b/.test(
      upper,
    )
  ) {
    return "CAM";
  }

  /*
   * Digital-source signals.
   */
  if (
    /\bWEB[-_. ]?DL\b/.test(
      upper,
    ) ||
    /\bWEBDL\b/.test(
      upper,
    ) ||
    /\bWEBRIP\b/.test(
      upper,
    ) ||
    /\bWEB[-_. ]?RIP\b/.test(
      upper,
    ) ||
    /\bWEB\b/.test(
      upper,
    )
  ) {
    return "WEB";
  }

  /*
   * Physical-disc / later-stage
   * releases are intentionally not
   * considered new Watch Leaks
   * CAM/WEB detections.
   */
  if (
    upper.includes(
      "BLURAY",
    ) ||
    upper.includes(
      "BLU-RAY",
    ) ||
    upper.includes(
      "BDRIP",
    ) ||
    upper.includes(
      "BDREMUX",
    ) ||
    upper.includes(
      "REMUX",
    ) ||
    upper.includes(
      "COMPLETE.UHD",
    ) ||
    upper.includes(
      "COMPLETE.BLURAY",
    ) ||
    upper.includes(
      "COMPLETE.BLURAY",
    ) ||
    upper.includes(
      "DVDRIP",
    ) ||
    upper.includes(
      "DVD"
    )
  ) {
    return "PHYSICAL";
  }

  return "OTHER";
}

function parsePosts(
  html,
) {
  /*
   * Each release is wrapped in:
   *
   * <div class="post" id="123456">
   *
   * The next release begins with
   * another div.post.
   */
  const postStarts = [
    ...html.matchAll(
      /<div\s+class=["']post["']\s+id=["'](\d+)["'][^>]*>/gi,
    ),
  ];

  const posts =
    [];

  for (
    let index = 0;
    index <
    postStarts.length;
    index += 1
  ) {
    const current =
      postStarts[index];

    const next =
      postStarts[
        index + 1
      ];

    const postId =
      current[1];

    const start =
      current.index;

    const end =
      next?.index ??
      html.length;

    const block =
      html.slice(
        start,
        end,
      );

    /*
     * Exact PreDB timestamp.
     *
     * Example:
     *
     * <span
     *   class="p-time"
     *   data="1790870047"
     *   title="2026-10-01 @ 15:54:07 ( UTC )"
     * >
     */
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

    /*
     * Release title.
     */
    const titleMatch =
      block.match(
        /<a[^>]*class=["'][^"']*\bp-title\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      );

    const releaseName =
      titleMatch
        ? stripHtml(
            titleMatch[1],
          )
        : null;

    /*
     * Main Movies category.
     */
    const mainCategoryMatch =
      block.match(
        /<a[^>]*href=["'][^"']*\?cats=movies["'][^>]*>([\s\S]*?)<\/a>/i,
      );

    const mainCategory =
      mainCategoryMatch
        ? stripHtml(
            mainCategoryMatch[1],
          )
        : null;

    /*
     * Child category such as:
     *
     * DISC
     * HD
     *
     * etc.
     */
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

    let isoTimestamp =
      null;

    if (
      unixTimestamp &&
      /^\d+$/.test(
        unixTimestamp,
      )
    ) {
      const numericTimestamp =
        Number(
          unixTimestamp,
        );

      const date =
        new Date(
          numericTimestamp *
            1000,
        );

      if (
        !Number.isNaN(
          date.getTime(),
        )
      ) {
        isoTimestamp =
          date.toISOString();
      }
    }

    posts.push({
      postId,

      releaseName,

      unixTimestamp,

      timestampTitle,

      isoTimestamp,

      mainCategory,

      childCategory,

      classification:
        releaseName
          ? classifyRelease(
              releaseName,
            )
          : "OTHER",

      sourceUrl:
        `https://predb.me/?post=${postId}`,
    });
  }

  return posts;
}

function main() {
  if (
    !fs.existsSync(
      INPUT_FILE,
    )
  ) {
    throw new Error(
      `${INPUT_FILE} was not found.`,
    );
  }

  const html =
    fs.readFileSync(
      INPUT_FILE,
      "utf8",
    );

  const posts =
    parsePosts(
      html,
    );

  console.log(
    `Parsed ${posts.length} PreDB movie release(s).`,
  );

  console.log("");

  const counts = {
    CAM: 0,
    WEB: 0,
    PHYSICAL: 0,
    OTHER: 0,
  };

  for (
    const post of
    posts
  ) {
    counts[
      post.classification
    ] += 1;
  }

  console.log(
    "Classification summary:",
  );

  console.log(
    `CAM: ${counts.CAM}`,
  );

  console.log(
    `WEB: ${counts.WEB}`,
  );

  console.log(
    `PHYSICAL: ${counts.PHYSICAL}`,
  );

  console.log(
    `OTHER: ${counts.OTHER}`,
  );

  console.log("");
  console.log(
    "========================================",
  );

  for (
    const post of
    posts
  ) {
    console.log(
      `[${post.classification}] ${post.releaseName ?? "UNKNOWN RELEASE"}`,
    );

    console.log(
      `Post ID: ${post.postId}`,
    );

    console.log(
      `Pre time: ${post.isoTimestamp ?? post.timestampTitle ?? "Unavailable"}`,
    );

    console.log(
      `Category: ${post.mainCategory ?? "Unavailable"} / ${post.childCategory ?? "Unavailable"}`,
    );

    console.log(
      `URL: ${post.sourceUrl}`,
    );

    console.log(
      "----------------------------------------",
    );
  }

  console.log("");
  console.log(
    "Potential Watch Leaks detections:",
  );

  console.log("");

  const relevant =
    posts.filter(
      (
        post,
      ) =>
        post.classification ===
          "CAM" ||
        post.classification ===
          "WEB",
    );

  if (
    relevant.length ===
    0
  ) {
    console.log(
      "None in this 40-release sample.",
    );
  } else {
    for (
      const post of
      relevant
    ) {
      console.log(
        `${post.classification}: ${post.releaseName}`,
      );

      console.log(
        `  ${post.isoTimestamp ?? "Time unavailable"}`,
      );

      console.log(
        `  ${post.sourceUrl}`,
      );
    }
  }

  console.log("");
  console.log(
    "NO database changes were made.",
  );
}

try {
  main();
} catch (
  error
) {
  console.error(
    error,
  );

  process.exitCode =
    1;
}