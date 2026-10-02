import {
  createClient,
} from "@libsql/client";

const url =
  process.env
    .TURSO_DATABASE_URL;

const authToken =
  process.env
    .TURSO_AUTH_TOKEN;

if (!url) {
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
    url,
    authToken,
  });

const applyChanges =
  process.argv.includes(
    "--apply",
  );

const REQUIRED_COLUMNS = [
  {
    name:
      "media_type",

    sql:
      "ALTER TABLE detections ADD COLUMN media_type TEXT NOT NULL DEFAULT 'MOVIE'",
  },

  {
    name:
      "season_number",

    sql:
      "ALTER TABLE detections ADD COLUMN season_number INTEGER",
  },

  {
    name:
      "episode_number",

    sql:
      "ALTER TABLE detections ADD COLUMN episode_number INTEGER",
  },

  {
    name:
      "episode_title",

    sql:
      "ALTER TABLE detections ADD COLUMN episode_title TEXT",
  },

  {
    name:
      "episode_air_date",

    sql:
      "ALTER TABLE detections ADD COLUMN episode_air_date TEXT",
  },
];

async function getExistingColumns() {
  const result =
    await turso.execute(
      `
        PRAGMA table_info(
          detections
        )
      `,
    );

  return new Set(
    result.rows.map(
      (
        row,
      ) =>
        String(
          row.name,
        ),
    ),
  );
}

async function printCurrentSchema() {
  const result =
    await turso.execute(
      `
        PRAGMA table_info(
          detections
        )
      `,
    );

  console.log("");
  console.log(
    "Current detections columns:",
  );

  for (
    const row of
    result.rows
  ) {
    console.log(
      `- ${String(
        row.name,
      )} (${String(
        row.type,
      )})`,
    );
  }
}

async function main() {
  console.log(
    "Watch Leaks TV detection schema migration",
  );

  console.log(
    applyChanges
      ? "Mode: APPLY"
      : "Mode: DRY RUN",
  );

  console.log("");

  const existingColumns =
    await getExistingColumns();

  const missingColumns =
    REQUIRED_COLUMNS.filter(
      (
        column,
      ) =>
        !existingColumns.has(
          column.name,
        ),
    );

  console.log(
    `Required TV columns: ${REQUIRED_COLUMNS.length}`,
  );

  console.log(
    `Already present: ${
      REQUIRED_COLUMNS.length -
      missingColumns.length
    }`,
  );

  console.log(
    `Missing: ${missingColumns.length}`,
  );

  console.log("");

  if (
    missingColumns.length ===
    0
  ) {
    console.log(
      "TV detection columns are already installed.",
    );

    await printCurrentSchema();

    return;
  }

  console.log(
    "Columns to add:",
  );

  for (
    const column of
    missingColumns
  ) {
    console.log(
      `- ${column.name}`,
    );
  }

  console.log("");

  /*
   * Important:
   *
   * We are NOT changing:
   *
   * - existing detection IDs
   * - existing movie records
   * - existing unique constraint
   * - existing source URLs
   * - existing detection timestamps
   *
   * Existing rows receive:
   *
   * media_type = MOVIE
   *
   * because that column uses a safe default.
   *
   * Episode-specific fields remain NULL.
   */

  if (
    !applyChanges
  ) {
    console.log(
      "DRY RUN ONLY.",
    );

    console.log(
      "No database changes were made.",
    );

    console.log("");

    console.log(
      "Planned SQL:",
    );

    for (
      const column of
      missingColumns
    ) {
      console.log("");
      console.log(
        column.sql,
      );
    }

    console.log("");

    console.log(
      "Run with --apply only after reviewing this output.",
    );

    return;
  }

  for (
    const column of
    missingColumns
  ) {
    console.log(
      `Adding ${column.name}...`,
    );

    await turso.execute(
      column.sql,
    );

    console.log(
      `Added ${column.name}.`,
    );
  }

  /*
   * Add an index for the TV logical identity
   * that we will use in the PreDB first-seen
   * storage layer:
   *
   * source
   * media_type
   * tmdb_id
   * detection_type
   * season_number
   * episode_number
   *
   * This is NOT UNIQUE.
   *
   * The existing source-observation unique
   * constraint remains untouched.
   */
  console.log("");
  console.log(
    "Creating TV identity lookup index...",
  );

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS
      idx_detections_tv_identity

    ON detections (
      source,
      media_type,
      tmdb_id,
      detection_type,
      season_number,
      episode_number
    )
  `);

  console.log(
    "TV identity lookup index ready.",
  );

  await printCurrentSchema();

  console.log("");
  console.log(
    "Migration completed successfully.",
  );
}

main()
  .catch(
    (
      error,
    ) => {
      console.error(
        "TV detection schema migration failed:",
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    () => {
      turso.close();
    },
  );