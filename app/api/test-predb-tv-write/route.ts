import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ingestPredbTv,
} from "../../../data/predbTvIngestion";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function POST(
  request: NextRequest,
) {
  /*
   * This route is only for our controlled
   * local PreDB TV write test.
   *
   * Production must never expose it.
   */
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

  const expectedSecret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !expectedSecret ||
    authorization !==
      `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json(
      {
        success:
          false,

        message:
          "Unauthorized.",
      },
      {
        status:
          401,
      },
    );
  }

  try {
    const body =
      await request.json()
        .catch(
          () => null,
        );

    if (
      body?.confirm !==
      "WRITE_PREDB_TV"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Explicit confirmation is required.",
        },
        {
          status:
            400,
        },
      );
    }

    const result =
      await ingestPredbTv({
        write:
          true,
      });

    return NextResponse.json({
      ...result,

      mode:
        "CONTROLLED_TV_WRITE_TEST",
    });
  } catch (error) {
    console.error(
      "PreDB TV controlled write failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB TV write error.",
      },
      {
        status:
          500,
      },
    );
  }
}