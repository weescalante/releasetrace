import {
  NextResponse,
} from "next/server";

import {
  resolveTvSplitSeries,
} from "../../../lib/tvSplitSeriesResolver";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function GET() {
  try {
    const result =
      await resolveTvSplitSeries({
        sourceTitle:
          "Icons Unearthed",

        sourceSeasonNumber:
          14,

        sourceEpisodeNumber:
          5,

        detectedAt:
          "2026-10-02T04:31:35.000Z",
      });

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      result,
    });
  } catch (error) {
    console.error(
      "TV split-series resolver test failed:",
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
            : "Unknown TV split-series resolver error.",
      },
      {
        status:
          500,
      },
    );
  }
}