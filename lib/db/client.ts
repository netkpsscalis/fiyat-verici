import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof makeDb>;

const globalForDb = globalThis as unknown as { __db?: DrizzleDb };

function makeDb() {
  const client = createClient({
    // Boş değer de dosya veritabanına düşsün: derleme sırasında adres tanımsız olabiliyor
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return drizzle(client, { schema });
}

function instance(): DrizzleDb {
  // Geliştirmede hot-reload sırasında yeni bağlantı açılmasın diye tek örnek tutulur
  globalForDb.__db ??= makeDb();
  return globalForDb.__db;
}

/**
 * Bağlantı ilk sorguda kurulur. Derleme sırasında sayfalar taranırken bağlantı kurulmaz;
 * o anda ortam değişkenleri henüz yoktur.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const value = Reflect.get(instance() as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance()) : value;
  },
});

export type Db = DrizzleDb;
export { schema };
