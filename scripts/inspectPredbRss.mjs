import fs from "fs";

const PREDB_MOVIES_RSS_URL =
  "https://predb.me/?cats=movies&rss=1";

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
    .replace(
      /<!\[CDATA\[([\s\S]*?)\]\]>/gi,
      "$1",
    )
    .trim();
}

function getTagValue(
  xml,
  tagName,
) {
  const pattern =
    new RegExp(
      `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
      "i",
    );

  const match =
    xml.match(
      pattern,
    );

  if (!match) {
    return null;
  }

  return decodeHtmlEntities(
    match[1],
  );
}

function extractItems(
  xml,
) {
  return [
    ...xml.matchAll(
      /<item\b[^>]*>([\s\S]*?)<\/item>/gi,
    ),
  ].map(
    (
      match,
    ) =>
      match[1],
  );
}

async function main() {
  console.log(
    "Fetching PreDB Movies RSS...",
  );

  console.log(
    PREDB_MOVIES_RSS_URL,
  );

  console.log("");

  const response =
    await fetch(
      PREDB_MOVIES_RSS_URL,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 WatchLeaks-Research/1.0",

          Accept:
            "application/rss+xml, application/xml, text/xml, */*",
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

  if (!response.ok) {
    throw new Error(
      `PreDB RSS request failed with status ${response.status}.`,
    );
  }

  const xml =
    await response.text();

  console.log(
    `Response length: ${xml.length} characters`,
  );

  const outputPath =
    "scripts/predb-movies-rss-sample.xml";

  fs.writeFileSync(
    outputPath,
    xml,
    "utf8",
  );

  console.log(
    `Saved RSS response to ${outputPath}`,
  );

  console.log("");

  const items =
    extractItems(
      xml,
    );

  console.log(
    `RSS items found: ${items.length}`,
  );

  console.log("");

  if (
    items.length ===
    0
  ) {
    console.log(
      "No RSS <item> elements were detected.",
    );

    console.log("");
    console.log(
      "First 1000 response characters:",
    );

    console.log("");

    console.log(
      xml.slice(
        0,
        1000,
      ),
    );

    return;
  }

  console.log(
    "First 10 RSS items:",
  );

  console.log("");

  for (
    const [
      index,
      item,
    ] of items
      .slice(
        0,
        10,
      )
      .entries()
  ) {
    const title =
      getTagValue(
        item,
        "title",
      );

    const link =
      getTagValue(
        item,
        "link",
      );

    const guid =
      getTagValue(
        item,
        "guid",
      );

    const pubDate =
      getTagValue(
        item,
        "pubDate",
      );

    const category =
      getTagValue(
        item,
        "category",
      );

    const description =
      getTagValue(
        item,
        "description",
      );

    console.log(
      `${index + 1}. ${title ?? "NO TITLE"}`,
    );

    console.log(
      `   pubDate: ${pubDate ?? "Unavailable"}`,
    );

    console.log(
      `   category: ${category ?? "Unavailable"}`,
    );

    console.log(
      `   link: ${link ?? "Unavailable"}`,
    );

    console.log(
      `   guid: ${guid ?? "Unavailable"}`,
    );

    if (
      description
    ) {
      console.log(
        `   description: ${description.slice(0, 250)}`,
      );
    }

    console.log("");
  }

  console.log(
    "PreDB RSS inspection completed.",
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