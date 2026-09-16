/** Veritabanına sabitlenmiş eski varsayılan ayarları temizler; kullanıcının değiştirdiği değerler kalır. */
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { eq } = await import("drizzle-orm");
const { db, schema } = await import("../lib/db/client");

const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "pricing"));
if (!row) {
  console.log("Kayıtlı ayar yok, varsayılanlar kullanılıyor.");
  process.exit(0);
}
const v = { ...(row.value as Record<string, any>) };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const removed: string[] = [];

// Eski varsayılanlarla aynı olan alanlar silinir → yeni varsayılanlar devreye girer
if (same(v.buyMargins, { max: 10, mid: 17, min: 25 })) { delete v.buyMargins; removed.push("buyMargins"); }
if (v.sourceAdjust?.used_listing?.factor === 0.93) { delete v.sourceAdjust; removed.push("sourceAdjust"); }
for (const k of ["listingDiscount", "refurbFactor"]) if (k in v) { delete v[k]; removed.push(k); }
for (const [k, def] of Object.entries({ minProfit: 750, buybackRatio: 0.78, windowDays: 30, freshDays: 7 })) {
  if (v[k] === def) { delete v[k]; removed.push(k); }
}
if (same(v.newSale, { margin: 6, minProfit: 1000, wholesaleFromRetail: 0.93 })) { delete v.newSale; removed.push("newSale"); }
if (same(v.depreciation, [0.82, 0.72, 0.62, 0.53, 0.45, 0.38, 0.32])) { delete v.depreciation; removed.push("depreciation"); }

await db.update(schema.settings).set({ value: v }).where(eq(schema.settings.key, "pricing"));
console.log("Temizlenen alanlar:", removed.join(", ") || "yok");
console.log("Kalan kayıt:", JSON.stringify(v));
process.exit(0);
