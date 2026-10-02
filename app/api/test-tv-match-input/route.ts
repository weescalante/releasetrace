import {
  NextResponse,
} from "next/server";

import {
  matchTvSource,
} from "../../../lib/tvMatchEngine";

import type {
  TvMatchInput,
} from "../../../lib/tvMatchEngine";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function POST(
  request: Request,
) {
  try {
    const input =
      await request.json() as
        TvMatchInput;

    const match =
      await matchTvSource(
        input,
      );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      input,

      match,
    });
  } catch (error) {
    console.error(
      "TV matcher input diagnostic failed:",
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
            : "Unknown TV matcher input diagnostic error.",
      },
      {
        status:
          500,
      },
    );
  }
}