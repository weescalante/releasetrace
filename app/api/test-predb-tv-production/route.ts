import {
  NextResponse,
} from "next/server";

import {
  ingestPredbTv,
} from "../../../data/predbTvIngestion";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function GET() {
  try {
    const result =
      await ingestPredbTv({
        write:
          false,
      });

    return NextResponse.json({
      ...result,

      databaseChanges:
        false,
    });
  } catch (error) {
    console.error(
      "PreDB TV production dry run failed:",
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
            : "Unknown PreDB TV production dry-run error.",
      },
      {
        status:
          500,
      },
    );
  }
}