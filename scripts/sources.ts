/**
 * Günlük fiyat güncelleme. Örnekler:
 *   npm run sources
 *   npm run sources -- --source=getmobil --model=apple-iphone-15-pro
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { runAll, SOURCES } = await import("../lib/sources/run");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const only = arg("source") as (typeof SOURCES)[number] | undefined;
if (only && !SOURCES.includes(only)) {
  console.error(`Bilinmeyen kaynak: ${only}. Seçenekler: ${SOURCES.join(", ")}`);
  process.exit(1);
}
const model = arg("model");

const started = Date.now();
const results = await runAll({ only, modelIds: model ? model.split(",") : undefined, log: (m) => console.log(m) });
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.source}: ${r.message}`);
console.log(`Bitti (${Math.round((Date.now() - started) / 1000)} sn).`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
