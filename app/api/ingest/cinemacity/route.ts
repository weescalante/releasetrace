import { getCinemaCityMovies } from "../../../../data/cinemacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is missing.");

    return Response.json(
      {
        success: false,
        message: "Server configuration error.",
      },
      {
        status: 500,
      },
    );
  }

  const authorization = request.headers.get(
    "authorization",
  );

  if (authorization !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    await getCinemaCityMovies();

    return Response.json({
      success: true,
      message: "CinemaCity ingestion completed.",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "CinemaCity ingestion failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        message: "CinemaCity ingestion failed.",
        checkedAt: new Date().toISOString(),
      },
      {
        status: 500,
      },
    );
  }
}