import {
  createClient,
} from "@libsql/client";

const databaseUrl =
  process.env.TURSO_DATABASE_URL;

const authToken =
  process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  throw new Error(
    "TURSO_DATABASE_URL is missing.",
  );
}

if (!authToken) {
  throw new Error(
    "TURSO_AUTH_TOKEN is missing.",
  );
}

const turso =
  createClient({
    url:
      databaseUrl,

    authToken,
  });

const currentYear =
  String(
    new Date()
      .getUTCFullYear(),
  );

const shouldDelete =
  process.argv.includes(
    "--delete",
  );

async function main() {
  console.log(
    "PreDB old-title cleanup",
  );

  console.log(
    `Current release year: ${currentYear}`,
  );

  console.log(
    `Mode: ${
      shouldDelete
        ? "DELETE"
        : "DRY RUN"
    }`,
  );

  console.log("");

  const detectionResult =
    await turso.execute({
      sql: `
        SELECT
          id,
          tmdb_id,
          title,
          year,
          detection_type,
          quality,
          detected_at,
          source_url

        FROM detections

        WHERE
          source = 'PreDB'
          AND COALESCE(
            year,
            ''
          ) <> ?

        ORDER BY
          datetime(
            detected_at
          ) DESC,
          id DESC
      `,

      args: [
        currentYear,
      ],
    });

  const reviewResult =
    await turso.execute({
      sql: `
        SELECT
          id,
          source_title,
          normalized_title,
          year,
          detection_type,
          reason,
          status,
          source_url

        FROM match_reviews

        WHERE
          source = 'PreDB'
          AND COALESCE(
            year,
            ''
          ) <> ?

        ORDER BY
          id DESC
      `,

      args: [
        currentYear,
      ],
    });

  console.log(
    `Old/non-current PreDB detections found: ${detectionResult.rows.length}`,
  );

  console.log("");

  for (
    const row of
    detectionResult.rows
  ) {
    console.log(
      `Detection ID ${row.id}: ${row.title} (${row.year ?? "Unknown"})`,
    );

    console.log(
      `  Type: ${row.detection_type}`,
    );

    console.log(
      `  Quality: ${row.quality ?? "Unknown"}`,
    );

    console.log(
      `  Detected: ${row.detected_at}`,
    );

    console.log(
      `  TMDB: ${row.tmdb_id ?? "Unavailable"}`,
    );

    console.log("");
  }

  console.log(
    `Old/non-current PreDB reviews found: ${reviewResult.rows.length}`,
  );

  console.log("");

  for (
    const row of
    reviewResult.rows
  ) {
    console.log(
      `Review ID ${row.id}: ${row.normalized_title} (${row.year ?? "Unknown"})`,
    );

    console.log(
      `  Source title: ${row.source_title}`,
    );

    console.log(
      `  Type: ${row.detection_type}`,
    );

    console.log(
      `  Reason: ${row.reason}`,
    );

    console.log(
      `  Status: ${row.status}`,
    );

    console.log("");
  }

  if (!shouldDelete) {
    console.log(
      "DRY RUN ONLY.",
    );

    console.log(
      "Nothing was deleted.",
    );

    console.log("");

    console.log(
      "Run again with --delete only after reviewing this output.",
    );

    return;
  }

  const deleteDetections =
    await turso.execute({
      sql: `
        DELETE FROM detections

        WHERE
          source = 'PreDB'
          AND COALESCE(
            year,
            ''
          ) <> ?
      `,

      args: [
        currentYear,
      ],
    });

  const deleteReviews =
    await turso.execute({
      sql: `
        DELETE FROM match_reviews

        WHERE
          source = 'PreDB'
          AND COALESCE(
            year,
            ''
          ) <> ?
      `,

      args: [
        currentYear,
      ],
    });

  console.log(
    `Deleted detections: ${deleteDetections.rowsAffected}`,
  );

  console.log(
    `Deleted reviews: ${deleteReviews.rowsAffected}`,
  );

  console.log("");

  const remainingDetections =
    await turso.execute({
      sql: `
        SELECT
          COUNT(*) AS total

        FROM detections

        WHERE source = 'PreDB'
      `,
    });

  const remainingReviews =
    await turso.execute({
      sql: `
        SELECT
          COUNT(*) AS total

        FROM match_reviews

        WHERE source = 'PreDB'
      `,
    });

  console.log(
    `Remaining PreDB detections: ${
      remainingDetections.rows[0]
        ?.total ??
      0
    }`,
  );

  console.log(
    `Remaining PreDB reviews: ${
      remainingReviews.rows[0]
        ?.total ??
      0
    }`,
  );

  console.log("");

  console.log(
    "PreDB cleanup completed successfully.",
  );
}

main().catch(
  (error) => {
    console.error(
      "PreDB cleanup failed:",
      error,
    );

    process.exitCode =
      1;
  },
);