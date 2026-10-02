import {
  getPredbMovieReleases,
  getPredbWebReleases,
} from "../data/predb.ts";

function getTimestamp(
  value,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return Number.isNaN(
    timestamp,
  )
    ? null
    : timestamp;
}

function formatAge(
  value,
) {
  const timestamp =
    getTimestamp(
      value,
    );

  if (
    timestamp === null
  ) {
    return "Unknown";
  }

  const difference =
    Date.now() -
    timestamp;

  const minutes =
    Math.floor(
      difference /
        (1000 * 60),
    );

  if (
    minutes < 60
  ) {
    return `${Math.max(
      0,
      minutes,
    )} min`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (
    hours < 24
  ) {
    return `${hours} hr`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  return `${days} days`;
}

function sortNewestFirst(
  releases,
) {
  return [
    ...releases,
  ].sort(
    (
      a,
      b,
    ) => {
      const aTime =
        getTimestamp(
          a.publishedAt,
        );

      const bTime =
        getTimestamp(
          b.publishedAt,
        );

      if (
        aTime === null &&
        bTime === null
      ) {
        return 0;
      }

      if (
        aTime === null
      ) {
        return 1;
      }

      if (
        bTime === null
      ) {
        return -1;
      }

      return (
        bTime -
        aTime
      );
    },
  );
}

async function main() {
  console.log(
    "Testing combined PreDB stream...",
  );

  console.log("");

  const [
    latestMovieReleases,
    webSearchReleases,
  ] =
    await Promise.all([
      getPredbMovieReleases(),
      getPredbWebReleases(),
    ]);

  console.log(
    `Latest Movies source: ${latestMovieReleases.length}`,
  );

  console.log(
    `WEB search source: ${webSearchReleases.length}`,
  );

  console.log("");

  const combinedBeforeDedupe = [
    ...latestMovieReleases,
    ...webSearchReleases,
  ];

  const byPostId =
    new Map();

  for (
    const release of
    combinedBeforeDedupe
  ) {
    if (
      !byPostId.has(
        release.postId,
      )
    ) {
      byPostId.set(
        release.postId,
        release,
      );
    }
  }

  const combined =
    sortNewestFirst(
      [
        ...byPostId.values(),
      ],
    );

  const duplicateCount =
    combinedBeforeDedupe.length -
    combined.length;

  const web =
    combined.filter(
      (release) =>
        release.signal ===
        "WEB",
    );

  const bluray =
    combined.filter(
      (release) =>
        release.signal ===
        "BLURAY",
    );

  console.log(
    `Combined before dedupe: ${combinedBeforeDedupe.length}`,
  );

  console.log(
    `Duplicates removed: ${duplicateCount}`,
  );

  console.log(
    `Combined unique releases: ${combined.length}`,
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
    web.length >
    0
  ) {
    const newestWeb =
      web[0];

    console.log(
      "Newest WEB:",
    );

    console.log(
      newestWeb.releaseName,
    );

    console.log(
      `Pre time: ${newestWeb.publishedAt}`,
    );

    console.log(
      `Age: ${formatAge(
        newestWeb.publishedAt,
      )}`,
    );

    console.log("");
  }

  if (
    bluray.length >
    0
  ) {
    const newestBluray =
      bluray[0];

    console.log(
      "Newest BLURAY:",
    );

    console.log(
      newestBluray.releaseName,
    );

    console.log(
      `Pre time: ${newestBluray.publishedAt}`,
    );

    console.log(
      `Age: ${formatAge(
        newestBluray.publishedAt,
      )}`,
    );

    console.log("");
  }

  console.log(
    "========================================",
  );

  console.log(
    "30 NEWEST COMBINED RELEASES",
  );

  console.log(
    "========================================",
  );

  console.log("");

  for (
    const release of
    combined.slice(
      0,
      30,
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
      `Pre time: ${release.publishedAt}`,
    );

    console.log(
      `Age: ${formatAge(
        release.publishedAt,
      )}`,
    );

    console.log(
      `Post ID: ${release.postId}`,
    );

    console.log(
      "----------------------------------------",
    );
  }

  console.log("");

  console.log(
    "Combined PreDB test complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "Combined PreDB test failed:",
      error,
    );

    process.exitCode =
      1;
  },
);