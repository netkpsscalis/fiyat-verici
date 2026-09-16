/** Cihaz kataloğunu veritabanına yazar. Tekrar çalıştırmak güvenlidir (var olanı günceller). */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { db, schema } = await import("../lib/db/client");
const { catalog, modelId, parseVariant, variantId } = await import("../data/seed/devices");

let modelCount = 0;
let variantCount = 0;

for (const [bi, brand] of catalog.entries()) {
  await db
    .insert(schema.brands)
    .values({ id: brand.id, name: brand.name, sort: bi })
    .onConflictDoUpdate({ target: schema.brands.id, set: { name: brand.name, sort: bi } });

  for (const [mi, m] of brand.models.entries()) {
    const id = modelId(brand.id, m.name);
    const row = {
      id,
      brandId: brand.id,
      name: m.name,
      series: m.series,
      releaseYear: m.year,
      family: brand.family,
      hasBatteryHealth: brand.hasBatteryHealth,
      sort: mi,
    };
    await db.insert(schema.models).values(row).onConflictDoUpdate({ target: schema.models.id, set: row });
    modelCount++;

    for (const spec of m.variants) {
      const v = parseVariant(spec);
      const vid = variantId(id, v);
      await db
        .insert(schema.variants)
        .values({ id: vid, modelId: id, ...v })
        .onConflictDoUpdate({ target: schema.variants.id, set: v });
      variantCount++;
    }
  }
}

console.log(`Katalog hazır: ${catalog.length} marka, ${modelCount} model, ${variantCount} varyant.`);
