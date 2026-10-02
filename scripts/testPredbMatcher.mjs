import {
  getPredbMovieReleases,
} from "../data/predb.ts";

import {
  matchMovieSource,
} from "../lib/movieMatchEngine.ts";

async function main() {
  console.log(
    "Testing PreDB through the shared movie matcher...",
  );

  console.log("");

  const releases =
    await getPredbMovieReleases();

  const candidates =
    releases
      .filter(
        (release) =>
          release.signal ===
          "BLURAY" ||
          release.signal ===
          "WEB",
      )
      .slice(
        0,
        5,
      );

  console.log(
    `Testing ${candidates.length} current PreDB release(s).`,
  );

  console.log("");

  for (
    const release of
    candidates
  ) {
    console.log(
      "========================================",
    );

    console.log(
      `[${release.signal}] ${release.releaseName}`,
    );

    console.log(
      `Parsed title: ${release.normalizedTitle}`,
    );

    console.log(
      `Parsed year: ${release.year}`,
    );

    console.log(
      `Quality: ${release.quality}`,
    );

    console.log(
      `Pre time: ${release.publishedAt}`,
    );

    const result =
      await matchMovieSource({
        sourceName:
          "PreDB",

        sourceTitle:
          release.releaseName,

        normalizedTitle:
          release.normalizedTitle,

        year:
          release.year,

        detectionType:
          release.signal,

        quality:
          release.quality,

        description:
          null,

        country:
          null,

        genres:
          [],

        audioLanguage:
          null,
      });

    if (
      result.match
    ) {
      console.log("");
      console.log(
        "RESULT: MATCHED",
      );

      console.log(
        `TMDB ID: ${result.match.id}`,
      );

      console.log(
        `TMDB title: ${result.match.matchedTitle}`,
      );

      console.log(
        `TMDB year: ${result.match.matchedYear ?? "Unavailable"}`,
      );

      console.log(
        `Confidence: ${result.match.confidence}%`,
      );

      console.log(
        `Poster: ${result.match.posterPath ?? "Unavailable"}`,
      );

      console.log(
        `Theatrical: ${result.match.theatricalReleaseDate ?? "Unavailable"} (${result.match.theatricalReleaseRegion ?? "—"})`,
      );

      console.log(
        `Digital: ${result.match.digitalReleaseDate ?? "Unavailable"} (${result.match.digitalReleaseRegion ?? "—"})`,
      );

      console.log(
        `Physical: ${result.match.physicalReleaseDate ?? "Unavailable"} (${result.match.physicalReleaseRegion ?? "—"})`,
      );
    } else if (
      result.reviewReason
    ) {
      console.log("");
      console.log(
        `RESULT: REVIEW REQUIRED — ${result.reviewReason}`,
      );

      console.log(
        `Candidate TMDB ID: ${result.candidateTmdbId ?? "Unavailable"}`,
      );

      console.log(
        `Candidate title: ${result.candidateTitle ?? "Unavailable"}`,
      );

      console.log(
        `Candidate year: ${result.candidateYear ?? "Unavailable"}`,
      );

      console.log(
        `Confidence: ${result.confidence ?? "Unavailable"}`,
      );

      console.log(
        `Candidate options: ${result.candidateOptions?.length ?? 0}`,
      );

      console.log(
        `Details: ${result.details ?? "None"}`,
      );
    } else {
      console.log("");
      console.log(
        "RESULT: NOT ELIGIBLE / NO AUTOMATIC MATCH",
      );

      console.log(
        `Details: ${result.details ?? "None"}`,
      );
    }

    console.log("");
  }

  console.log(
    "========================================",
  );

  console.log(
    "PreDB shared-matcher test complete.",
  );

  console.log(
    "NO database changes were made.",
  );
}

main().catch(
  (error) => {
    console.error(
      "PreDB matcher test failed:",
      error,
    );

    process.exitCode =
      1;
  },
);