import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof makeDb> };

function makeDb() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return drizzle(client, { schema });
}

/** Geliştirmede hot-reload sırasında yeni bağlantı açılmasın diye tek örnek tutulur. */
export const db = globalForDb.__db ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export type Db = typeof db;
export { schema };
