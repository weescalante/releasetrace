import { turso } from "./turso";

export type FeedStatus = {
  source: string;

  lastCheckedAt: string | null;
  lastSuccessfulAt: string | null;

  latestItemPublishedAt: string | null;
  latestItemTitle: string | null;

  itemCount: number;

  lastError: string | null;
};

async function ensureFeedStatusTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS feed_status (
      source TEXT PRIMARY KEY,

      last_checked_at TEXT,

      last_successful_at TEXT,

      latest_item_published_at TEXT,

      latest_item_title TEXT,

      item_count INTEGER NOT NULL DEFAULT 0,

      last_error TEXT,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function recordFeedSuccess({
  source,
  checkedAt,
  latestItemPublishedAt,
  latestItemTitle,
  itemCount,
}: {
  source: string;

  checkedAt: string;

  latestItemPublishedAt: string | null;
  latestItemTitle: string | null;

  itemCount: number;
}) {
  await ensureFeedStatusTable();

  await turso.execute({
    sql: `
      INSERT INTO feed_status (
        source,

        last_checked_at,
        last_successful_at,

        latest_item_published_at,
        latest_item_title,

        item_count,

        last_error,

        updated_at
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        NULL,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT(source) DO UPDATE SET
        last_checked_at = excluded.last_checked_at,

        last_successful_at = excluded.last_successful_at,

        latest_item_published_at =
          excluded.latest_item_published_at,

        latest_item_title =
          excluded.latest_item_title,

        item_count =
          excluded.item_count,

        last_error = NULL,

        updated_at =
          CURRENT_TIMESTAMP
    `,
    args: [
      source,

      checkedAt,
      checkedAt,

      latestItemPublishedAt,
      latestItemTitle,

      itemCount,
    ],
  });
}

export async function recordFeedFailure({
  source,
  checkedAt,
  error,
}: {
  source: string;

  checkedAt: string;

  error: string;
}) {
  await ensureFeedStatusTable();

  await turso.execute({
    sql: `
      INSERT INTO feed_status (
        source,

        last_checked_at,

        last_successful_at,

        latest_item_published_at,
        latest_item_title,

        item_count,

        last_error,

        updated_at
      )
      VALUES (
        ?,
        ?,
        NULL,
        NULL,
        NULL,
        0,
        ?,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT(source) DO UPDATE SET
        last_checked_at =
          excluded.last_checked_at,

        last_error =
          excluded.last_error,

        updated_at =
          CURRENT_TIMESTAMP
    `,
    args: [
      source,
      checkedAt,
      error,
    ],
  });
}

export async function getFeedStatus(
  source: string,
): Promise<FeedStatus | null> {
  await ensureFeedStatusTable();

  const result = await turso.execute({
    sql: `
      SELECT
        source,

        last_checked_at,
        last_successful_at,

        latest_item_published_at,
        latest_item_title,

        item_count,

        last_error

      FROM feed_status

      WHERE source = ?

      LIMIT 1
    `,
    args: [source],
  });

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    source: String(row.source),

    lastCheckedAt:
      row.last_checked_at === null
        ? null
        : String(row.last_checked_at),

    lastSuccessfulAt:
      row.last_successful_at === null
        ? null
        : String(row.last_successful_at),

    latestItemPublishedAt:
      row.latest_item_published_at === null
        ? null
        : String(row.latest_item_published_at),

    latestItemTitle:
      row.latest_item_title === null
        ? null
        : String(row.latest_item_title),

    itemCount: Number(
      row.item_count ?? 0,
    ),

    lastError:
      row.last_error === null
        ? null
        : String(row.last_error),
  };
}