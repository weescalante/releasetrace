import {
  getPredbMovieReleases,
} from "../data/predb.ts";

async function main() {
  console.log(
    "Testing live PreDB adapter...",
  );

  console.log("");

  const releases =
    await getPredbMovieReleases();

  const web =
    releases.filter(
      (release) =>
        release.signal ===
        "WEB",
    );

  const bluray =
    releases.filter(
      (release) =>
        release.signal ===
        "BLURAY",
    );

  console.log(
    `Watch Leaks releases found: ${releases.length}`,
  );

  console.log("");

  console.log(
    `WEB: ${web.length}`,
  );

  console.log(
    `BLURAY: ${bluray.length}`,
  );

  console.log("");

  if (
    releases.length ===
    0
  ) {
    console.log(
      "No WEB or BLURAY releases were detected in the current PreDB movie page.",
    );

    return;
  }

  console.log(
    "========================================",
  );

  console.log(
    "LATEST MATCHING RELEASES",
  );

  console.log(
    "========================================",
  );

  console.log("");

  for (
    const release of
    releases.slice(
      0,
      20,
    )
  ) {
    console.log(
      `[${release.signal}] ${release.releaseName}`,
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
      `Category: ${release.category}`,
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
    "PreDB adapter test complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "PreDB adapter test failed:",
      error,
    );

    process.exitCode =
      1;
  },
);