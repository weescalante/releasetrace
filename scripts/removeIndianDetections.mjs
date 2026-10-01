import fs from "fs";

import {
  createClient,
} from "@libsql/client";

function loadEnvFile() {
  const envPath =
    ".env.local";

  if (
    !fs.existsSync(
      envPath,
    )
  ) {
    throw new Error(
      ".env.local was not found.",
    );
  }

  const contents =
    fs.readFileSync(
      envPath,
      "utf8",
    );

  for (
    const rawLine of
    contents.split(
      /\r?\n/,
    )
  ) {
    const line =
      rawLine.trim();

    if (
      !line ||
      line.startsWith(
        "#",
      )
    ) {
      continue;
    }

    const separatorIndex =
      line.indexOf(
        "=",
      );

    if (
      separatorIndex ===
      -1
    ) {
      continue;
    }

    const key =
      line
        .slice(
          0,
          separatorIndex,
        )
        .trim();

    let value =
      line
        .slice(
          separatorIndex +
            1,
        )
        .trim();

    if (
      (
        value.startsWith(
          '"',
        ) &&
        value.endsWith(
          '"',
        )
      ) ||
      (
        value.startsWith(
          "'",
        ) &&
        value.endsWith(
          "'",
        )
      )
    ) {
      value =
        value.slice(
          1,
          -1,
        );
    }

    if (
      key &&
      process.env[key] ===
        undefined
    ) {
      process.env[key] =
        value;
    }
  }
}

loadEnvFile();

const databaseUrl =
  process.env
    .TURSO_DATABASE_URL;

const authToken =
  process.env
    .TURSO_AUTH_TOKEN;

const tmdbToken =
  process.env
    .TMDB_READ_ACCESS_TOKEN;

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

if (!tmdbToken) {
  throw new Error(
    "TMDB_READ_ACCESS_TOKEN is missing.",
  );
}

const db =
  createClient({
    url:
      databaseUrl,

    authToken,
  });

async function getTmdbMovie(
  tmdbId,
) {
  const response =
    await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
      {
        headers: {
          Authorization:
            `Bearer ${tmdbToken}`,

          accept:
            "application/json",
        },
      },
    );

  if (!response.ok) {
    console.warn(
      `TMDB ${tmdbId}: lookup failed with ${response.status}.`,
    );

    return null;
  }

  return response.json();
}

function isIndianMovie(
  movie,
) {
  const originCountries =
    movie.origin_country ??
    [];

  const productionCountries =
    movie.production_countries ??
    [];

  if (
    originCountries.includes(
      "IN",
    )
  ) {
    return true;
  }

  return productionCountries.some(
    (
      country,
    ) =>
      country
        ?.iso_3166_1 ===
      "IN",
  );
}

async function main() {
  console.log(
    "Scanning stored Watch Leaks detections...",
  );

  const result =
    await db.execute(`
      SELECT
        id,
        tmdb_id,
        title,
        year,
        detection_type
      FROM detections
      WHERE tmdb_id IS NOT NULL
      ORDER BY detected_at DESC
    `);

  const indianDetections =
    [];

  for (
    const row of
    result.rows
  ) {
    const tmdbId =
      Number(
        row.tmdb_id,
      );

    if (
      !Number.isInteger(
        tmdbId,
      ) ||
      tmdbId < 1
    ) {
      continue;
    }

    const movie =
      await getTmdbMovie(
        tmdbId,
      );

    if (!movie) {
      continue;
    }

    if (
      !isIndianMovie(
        movie,
      )
    ) {
      continue;
    }

    indianDetections.push({
      id:
        Number(
          row.id,
        ),

      tmdbId,

      title:
        String(
          row.title ??
            "",
        ),

      year:
        String(
          row.year ??
            "",
        ),

      detectionType:
        String(
          row.detection_type ??
            "",
        ),
    });
  }

  console.log("");
  console.log(
    `Found ${indianDetections.length} Indian detection(s).`,
  );
  console.log("");

  if (
    indianDetections.length ===
    0
  ) {
    console.log(
      "Nothing needs to be removed.",
    );

    return;
  }

  for (
    const detection of
    indianDetections
  ) {
    console.log(
      `Removing: ${detection.title} (${detection.year}) [${detection.detectionType}] · TMDB ${detection.tmdbId} · DB ID ${detection.id}`,
    );

    await db.execute({
      sql: `
        DELETE FROM detections
        WHERE id = ?
      `,

      args: [
        detection.id,
      ],
    });
  }

  console.log("");
  console.log(
    `Deleted ${indianDetections.length} Indian detection(s).`,
  );

  const verification =
    await db.execute(`
      SELECT COUNT(*) AS count
      FROM detections
    `);

  console.log(
    `Remaining detections in database: ${verification.rows[0]?.count ?? "Unknown"}`,
  );

  console.log("");
  console.log(
    "Cleanup completed successfully.",
  );
}

main()
  .catch(
    (
      error,
    ) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );