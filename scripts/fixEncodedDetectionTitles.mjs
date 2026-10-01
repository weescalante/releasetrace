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

function decodeHtmlEntities(
  value,
) {
  return value
    /*
     * Named HTML entities.
     */
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&apos;/gi,
      "'",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )

    /*
     * Decimal numeric entities.
     *
     * Example:
     *
     * &#039;
     *
     * becomes:
     *
     * '
     */
    .replace(
      /&#(\d+);/g,
      (
        match,
        decimal,
      ) => {
        const codePoint =
          Number(
            decimal,
          );

        if (
          !Number.isInteger(
            codePoint,
          )
        ) {
          return match;
        }

        try {
          return String.fromCodePoint(
            codePoint,
          );
        } catch {
          return match;
        }
      },
    )

    /*
     * Hexadecimal numeric entities.
     *
     * Example:
     *
     * &#x27;
     *
     * becomes:
     *
     * '
     */
    .replace(
      /&#x([0-9a-f]+);/gi,
      (
        match,
        hexadecimal,
      ) => {
        const codePoint =
          Number.parseInt(
            hexadecimal,
            16,
          );

        if (
          !Number.isInteger(
            codePoint,
          )
        ) {
          return match;
        }

        try {
          return String.fromCodePoint(
            codePoint,
          );
        } catch {
          return match;
        }
      },
    )

    /*
     * Normalize accidental extra spaces
     * after entity replacement.
     */
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

loadEnvFile();

const databaseUrl =
  process.env
    .TURSO_DATABASE_URL;

const authToken =
  process.env
    .TURSO_AUTH_TOKEN;

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

const db =
  createClient({
    url:
      databaseUrl,

    authToken,
  });

async function main() {
  console.log(
    "Scanning stored Watch Leaks detection titles...",
  );

  const result =
    await db.execute(`
      SELECT
        id,
        title,
        year,
        detection_type
      FROM detections
      ORDER BY detected_at DESC
    `);

  const changes =
    [];

  for (
    const row of
    result.rows
  ) {
    const id =
      Number(
        row.id,
      );

    const oldTitle =
      String(
        row.title ??
          "",
      );

    const newTitle =
      decodeHtmlEntities(
        oldTitle,
      );

    if (
      newTitle ===
      oldTitle
    ) {
      continue;
    }

    changes.push({
      id,

      oldTitle,

      newTitle,

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
    `Found ${changes.length} encoded detection title(s).`,
  );
  console.log("");

  if (
    changes.length ===
    0
  ) {
    console.log(
      "No title cleanup is needed.",
    );

    return;
  }

  for (
    const change of
    changes
  ) {
    console.log(
      `Fixing DB ID ${change.id}:`,
    );

    console.log(
      `  OLD: ${change.oldTitle}`,
    );

    console.log(
      `  NEW: ${change.newTitle}`,
    );

    console.log("");

    await db.execute({
      sql: `
        UPDATE detections
        SET title = ?
        WHERE id = ?
      `,

      args: [
        change.newTitle,
        change.id,
      ],
    });
  }

  console.log(
    `Updated ${changes.length} detection title(s).`,
  );

  /*
   * Verification pass.
   */
  const verification =
    await db.execute(`
      SELECT
        id,
        title
      FROM detections
      ORDER BY detected_at DESC
    `);

  const remainingEncoded =
    verification.rows.filter(
      (
        row,
      ) => {
        const title =
          String(
            row.title ??
              "",
          );

        return (
          decodeHtmlEntities(
            title,
          ) !==
          title
        );
      },
    );

  console.log(
    `Remaining encoded detection titles: ${remainingEncoded.length}`,
  );

  console.log("");
  console.log(
    "Title cleanup completed successfully.",
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