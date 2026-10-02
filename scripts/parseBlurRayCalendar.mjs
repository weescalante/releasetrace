import fs from "fs";

const CALENDAR_FILES = [
  {
    label:
      "September 2026",

    path:
      "scripts/bluray-calendar-2026-09.html",
  },

  {
    label:
      "October 2026",

    path:
      "scripts/bluray-calendar-2026-10.html",
  },
];

const TEST_TITLES = [
  "Batman Knightfall",
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
    )
    .replace(
      /&#(\d+);/g,
      (
        _match,
        code,
      ) =>
        String.fromCharCode(
          Number(
            code,
          ),
        ),
    );
}

function decodeJsString(
  value,
) {
  return decodeHtml(
    String(
      value ?? "",
    )
      .replace(
        /\\'/g,
        "'",
      )
      .replace(
        /\\"/g,
        '"',
      )
      .replace(
        /\\\\/g,
        "\\",
      ),
  ).trim();
}

function getStringField(
  objectText,
  fieldName,
) {
  const pattern =
    new RegExp(
      `\\b${fieldName}\\s*:\\s*'((?:\\\\.|[^'])*)'`,
      "i",
    );

  const match =
    objectText.match(
      pattern,
    );

  if (!match) {
    return null;
  }

  return decodeJsString(
    match[1],
  );
}

function getNumberField(
  objectText,
  fieldName,
) {
  const pattern =
    new RegExp(
      `\\b${fieldName}\\s*:\\s*(\\d+)`,
      "i",
    );

  const match =
    objectText.match(
      pattern,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  );
}

function normalizeTitle(
  value,
) {
  return String(
    value ?? "",
  )
    .toLowerCase()
    .replace(
      /\b4k\b/g,
      " ",
    )
    .replace(
      /\buhd\b/g,
      " ",
    )
    .replace(
      /\bblu[\s-]?ray\b/g,
      " ",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function inferFormat(
  title,
  titleKeywords,
) {
  const combined =
    `${title ?? ""} ${titleKeywords ?? ""}`
      .toLowerCase();

  if (
    combined.includes(
      "4k",
    ) ||
    combined.includes(
      "uhd",
    )
  ) {
    return "4K Blu-ray";
  }

  return "Blu-ray";
}

function buildEditionUrl({
  id,
  titleKeywords,
}) {
  if (
    !id ||
    !titleKeywords
  ) {
    return null;
  }

  return (
    `https://www.blu-ray.com/movies/` +
    `${titleKeywords}-Blu-ray/${id}/`
  );
}

function extractCalendarMovies(
  html,
) {
  const movies =
    [];

  const pattern =
    /movies\[(\d+)\]\s*=\s*\{([\s\S]*?)\};/gi;

  for (
    const match of
    html.matchAll(
      pattern,
    )
  ) {
    const index =
      Number(
        match[1],
      );

    const objectText =
      match[2];

    const id =
      getNumberField(
        objectText,
        "id",
      );

    const title =
      getStringField(
        objectText,
        "title",
      );

    const titleSort =
      getStringField(
        objectText,
        "title_sort",
      );

    const titleKeywords =
      getStringField(
        objectText,
        "title_keywords",
      );

    const studio =
      getStringField(
        objectText,
        "studio",
      );

    const year =
      getStringField(
        objectText,
        "year",
      );

    const yearEnd =
      getStringField(
        objectText,
        "yearend",
      );

    const releaseDate =
      getStringField(
        objectText,
        "releasedate",
      );

    const edition =
      getStringField(
        objectText,
        "edition",
      );

    const extended =
      getStringField(
        objectText,
        "extended",
      );

    if (
      !id ||
      !title ||
      !releaseDate
    ) {
      continue;
    }

    movies.push({
      index,

      id,

      title,

      normalizedTitle:
        normalizeTitle(
          title,
        ),

      titleSort,

      titleKeywords,

      studio,

      year,

      yearEnd,

      releaseDate,

      edition,

      extended,

      format:
        inferFormat(
          title,
          titleKeywords,
        ),

      url:
        buildEditionUrl({
          id,

          titleKeywords,
        }),
    });
  }

  return movies;
}

function printMovie(
  movie,
) {
  console.log(
    `${movie.title}`,
  );

  console.log(
    `  ID: ${movie.id}`,
  );

  console.log(
    `  Year: ${movie.year ?? "Unknown"}`,
  );

  console.log(
    `  Release date: ${movie.releaseDate}`,
  );

  console.log(
    `  Format: ${movie.format}`,
  );

  console.log(
    `  Studio: ${movie.studio ?? "Unknown"}`,
  );

  console.log(
    `  Keywords: ${movie.titleKeywords ?? "Unknown"}`,
  );

  console.log(
    `  URL: ${movie.url ?? "Unavailable"}`,
  );

  if (
    movie.edition
  ) {
    console.log(
      `  Edition: ${movie.edition}`,
    );
  }

  if (
    movie.extended
  ) {
    console.log(
      `  Extended: ${movie.extended}`,
    );
  }

  console.log("");
}

function inspectFile(
  calendarFile,
) {
  console.log(
    "========================================",
  );

  console.log(
    calendarFile.label,
  );

  console.log(
    "========================================",
  );

  if (
    !fs.existsSync(
      calendarFile.path,
    )
  ) {
    throw new Error(
      `Missing file: ${calendarFile.path}`,
    );
  }

  const html =
    fs.readFileSync(
      calendarFile.path,
      "utf8",
    );

  const movies =
    extractCalendarMovies(
      html,
    );

  console.log(
    `Calendar records parsed: ${movies.length}`,
  );

  console.log("");

  console.log(
    "First 10 parsed releases:",
  );

  console.log("");

  for (
    const movie of
    movies.slice(
      0,
      10,
    )
  ) {
    printMovie(
      movie,
    );
  }

  console.log(
    "========================================",
  );

  console.log(
    "TEST TITLE MATCHES",
  );

  console.log(
    "========================================",
  );

  console.log("");

  for (
    const testTitle of
    TEST_TITLES
  ) {
    const normalizedTest =
      normalizeTitle(
        testTitle,
      );

    const matches =
      movies.filter(
        (movie) =>
          movie
            .normalizedTitle
            .includes(
              normalizedTest,
            ) ||
          normalizedTest.includes(
            movie.normalizedTitle,
          ),
      );

    console.log(
      `${testTitle}: ${matches.length} matching calendar record(s)`,
    );

    console.log("");

    for (
      const movie of
      matches
    ) {
      printMovie(
        movie,
      );
    }
  }

  return movies;
}

function main() {
  console.log(
    "Parsing Blu-ray.com calendar data...",
  );

  console.log("");

  let total =
    0;

  for (
    const calendarFile of
    CALENDAR_FILES
  ) {
    const movies =
      inspectFile(
        calendarFile,
      );

    total +=
      movies.length;

    console.log("");
  }

  console.log(
    "========================================",
  );

  console.log(
    `Total parsed calendar records: ${total}`,
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    "Blu-ray.com calendar parsing complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

try {
  main();
} catch (error) {
  console.error(
    "Blu-ray.com calendar parsing failed:",
    error,
  );

  process.exitCode =
    1;
}