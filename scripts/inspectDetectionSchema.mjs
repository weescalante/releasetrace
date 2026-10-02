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

function printRows(
  title,
  rows,
) {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    title,
  );

  console.log(
    "========================================",
  );

  if (
    rows.length ===
    0
  ) {
    console.log(
      "No rows found.",
    );

    return;
  }

  for (
    const row of
    rows
  ) {
    console.log(
      JSON.stringify(
        row,
        null,
        2,
      ),
    );
  }
}

async function main() {
  console.log(
    "Inspecting live Turso detections schema...",
  );

  console.log(
    "READ ONLY — no database changes will be made.",
  );

  const tableDefinition =
    await turso.execute({
      sql: `
        SELECT
          name,
          sql

        FROM sqlite_master

        WHERE
          type = 'table'
          AND name = 'detections'
      `,

      args: [],
    });

  printRows(
    "DETECTIONS TABLE DEFINITION",
    tableDefinition.rows,
  );

  const columns =
    await turso.execute(
      `
        PRAGMA table_info(
          detections
        )
      `,
    );

  printRows(
    "DETECTIONS COLUMNS",
    columns.rows,
  );

  const indexes =
    await turso.execute(
      `
        PRAGMA index_list(
          detections
        )
      `,
    );

  printRows(
    "DETECTIONS INDEXES",
    indexes.rows,
  );

  for (
    const index of
    indexes.rows
  ) {
    const indexName =
      String(
        index.name ??
        "",
      );

    if (!indexName) {
      continue;
    }

    const safeIndexName =
      indexName.replace(
        /'/g,
        "''",
      );

    const indexColumns =
      await turso.execute(
        `
          PRAGMA index_info(
            '${safeIndexName}'
          )
        `,
      );

    printRows(
      `INDEX COLUMNS: ${indexName}`,
      indexColumns.rows,
    );

    const indexDefinition =
      await turso.execute({
        sql: `
          SELECT
            name,
            sql

          FROM sqlite_master

          WHERE
            type = 'index'
            AND name = ?
        `,

        args: [
          indexName,
        ],
      });

    printRows(
      `INDEX DEFINITION: ${indexName}`,
      indexDefinition.rows,
    );
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "Inspection complete.",
  );

  console.log(
    "NO database changes were made.",
  );

  console.log(
    "========================================",
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
  )
  .finally(
    () => {
      turso.close();
    },
  );