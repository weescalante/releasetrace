import {
  ingestPredbTv,
} from "../../../../data/predbTvIngestion";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function GET(
  request:
    Request,
) {
  const cronSecret =
    process.env
      .CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is missing.",
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Server configuration error.",
      },
      {
        status:
          500,
      },
    );
  }

  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return Response.json(
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
    const result =
      await ingestPredbTv({
        write:
          true,
      });

    return Response.json({
      success:
        true,

      message:
        "PreDB TV ingestion completed.",

      checkedAt:
        new Date()
          .toISOString(),

      summary:
        result.summary,
    });
  } catch (error) {
    console.error(
      "PreDB TV ingestion failed:",
      error,
    );

    return Response.json(
      {
        success:
          false,

        message:
          "PreDB TV ingestion failed.",

        checkedAt:
          new Date()
            .toISOString(),
      },
      {
        status:
          500,
      },
    );
  }
}