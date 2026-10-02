import {
  NextResponse,
} from "next/server";

import {
  ingestPredbMovies,
} from "../../../data/predbIngestion";

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
    const result =
      await ingestPredbMovies({
        write:
          false,
      });

    return NextResponse.json({
      ...result,

      mode:
        "DRY_RUN",

      databaseChanges:
        false,
    });
  } catch (error) {
    console.error(
      "PreDB dry-run ingestion failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        mode:
          "DRY_RUN",

        databaseChanges:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB ingestion test error.",
      },
      {
        status:
          500,
      },
    );
  }
}