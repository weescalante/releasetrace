import {
  NextResponse,
} from "next/server";

import {
  getPredbMovieReleases,
} from "../../../data/predb";

import {
  dedupePredbReleases,
} from "../../../lib/predbDeduper";

export const dynamic =
  "force-dynamic";

export async function GET() {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        success:
          false,

        message:
          "Not available in production.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const releases =
      await getPredbMovieReleases();

    const deduped =
      dedupePredbReleases(
        releases,
      );

    const originalWeb =
      releases.filter(
        (release) =>
          release.signal ===
          "WEB",
      ).length;

    const originalBluray =
      releases.filter(
        (release) =>
          release.signal ===
          "BLURAY",
      ).length;

    const dedupedWeb =
      deduped.filter(
        (release) =>
          release.signal ===
          "WEB",
      ).length;

    const dedupedBluray =
      deduped.filter(
        (release) =>
          release.signal ===
          "BLURAY",
      ).length;

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      before: {
        total:
          releases.length,

        web:
          originalWeb,

        bluray:
          originalBluray,
      },

      after: {
        total:
          deduped.length,

        web:
          dedupedWeb,

        bluray:
          dedupedBluray,
      },

      duplicatesCollapsed:
        releases.length -
        deduped.length,

      releases:
        deduped.map(
          (release) => ({
            signal:
              release.signal,

            title:
              release.normalizedTitle,

            year:
              release.year,

            firstPreTime:
              release.publishedAt,

            quality:
              release.quality,

            releaseName:
              release.releaseName,

            postId:
              release.postId,
          }),
        ),
    });
  } catch (error) {
    console.error(
      "PreDB dedupe test failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        databaseChanges:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown test error.",
      },
      {
        status:
          500,
      },
    );
  }
}