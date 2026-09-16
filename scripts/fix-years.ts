/** Otomatik eklenen modellerin çıkış yılını adından tahmin edip düzeltir. */
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { eq } = await import("drizzle-orm");
const { db, schema } = await import("../lib/db/client");
const { guessReleaseYear } = await import("../lib/catalogYear");

const models = await db.select().from(schema.models);
let fixed = 0;
for (const m of models) {
  const guess = guessReleaseYear(m.brandId, m.name);
  if (guess && guess !== m.releaseYear) {
    await db.update(schema.models).set({ releaseYear: guess }).where(eq(schema.models.id, m.id));
    fixed++;
  }
}
console.log(`${models.length} modelden ${fixed} tanesinin yılı düzeltildi.`);
process.exit(0);
