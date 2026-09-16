/**
 * Getmobil'den seri öneki olmadan eklenen Xiaomi modellerini ("14T", "X7 Pro", "MI 10T") doğru ada taşır.
 * Aynı model katalogda zaten varsa hafızaları ve fiyatları ona birleştirilir, fazlalık silinir.
 */
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { eq } = await import("drizzle-orm");
const { db, schema } = await import("../lib/db/client");
const { modelId: buildModelId, variantId: buildVariantId } = await import("../data/seed/devices");
const { guessReleaseYear } = await import("../lib/catalogYear");

function fixedName(name: string): string | null {
  if (/^MI\b/.test(name)) return name.replace(/^MI\b/, "Mi").replace(/(\d+) T\b/, "$1T");
  if (/^\d/.test(name)) return `Xiaomi ${name}`;
  if (/^[XFMC]\d/.test(name)) return `POCO ${name}`;
  return null;
}

const VARIANT_REFS = [
  schema.priceObservations,
  schema.transactions,
  schema.quotes,
  schema.trackedUrls,
  schema.sourcePages,
] as const;

const models = await db.select().from(schema.models).where(eq(schema.models.brandId, "xiaomi"));
let moved = 0;
for (const m of models) {
  const name = fixedName(m.name);
  if (!name) continue;
  const targetId = buildModelId("xiaomi", name);
  if (targetId === m.id) {
    await db.update(schema.models).set({ name }).where(eq(schema.models.id, m.id));
    continue;
  }

  await db
    .insert(schema.models)
    .values({ ...m, id: targetId, name, series: name.split(" ")[0], releaseYear: guessReleaseYear("xiaomi", name) ?? m.releaseYear })
    .onConflictDoNothing();

  const variants = await db.select().from(schema.variants).where(eq(schema.variants.modelId, m.id));
  for (const v of variants) {
    const newId = buildVariantId(targetId, { ramGb: v.ramGb, storageGb: v.storageGb });
    await db.insert(schema.variants).values({ ...v, id: newId, modelId: targetId }).onConflictDoNothing();
    for (const table of VARIANT_REFS) {
      try {
        await db.update(table).set({ variantId: newId }).where(eq(table.variantId, v.id));
      } catch {
        // Benzersizlik çakışması (aynı sayfa/link hedefte zaten var): eskisini sil
        await db.delete(table).where(eq(table.variantId, v.id));
      }
    }
    await db.delete(schema.variants).where(eq(schema.variants.id, v.id));
  }
  await db.update(schema.aliases).set({ modelId: targetId }).where(eq(schema.aliases.modelId, m.id));
  await db.delete(schema.models).where(eq(schema.models.id, m.id));
  console.log(`${m.name} → ${name}`);
  moved++;
}
console.log(`${moved} model düzeltildi.`);
process.exit(0);
