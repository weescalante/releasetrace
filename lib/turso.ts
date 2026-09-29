import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is missing from .env.local",
  );
}

if (!authToken) {
  throw new Error(
    "TURSO_AUTH_TOKEN is missing from .env.local",
  );
}

export const turso = createClient({
  url,
  authToken,
});