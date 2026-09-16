/**
 * Kaynak çalıştırıcı: Getmobil'deki 2. el (yenilenmiş) fiyatları okur, sonuçları piyasa fiyatı olarak yazar.
 * Aynı gün tekrar çalışırsa o günün kaydını günceller (çift kayıt olmaz).
 */
import { and, eq, gte } from "drizzle-orm";
import { modelId as buildModelId, variantId as buildVariantId } from "@/data/seed/devices";
import { guessReleaseYear } from "@/lib/catalogYear";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { filterOutliers, median } from "@/lib/pricing/stats";
import { BRAND_NAMES } from "./catalogAuto";
import { fetchGetmobil, GETMOBIL_SITEMAP, modelsFromSitemap } from "./getmobil";
import { politeFetch } from "./http";

export const SOURCES = ["getmobil"] as const;
export type SourceId = string;

export interface RunSummary {
  source: SourceId;
  ok: boolean;
  count: number;
  message: string;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Bir varyant için bir kaynaktan günde tek kayıt: aynı günün eski kaydı silinip yenisi yazılır. */
async function writeDaily(row: {
  variantId: string;
  kind: typeof schema.priceObservations.$inferInsert.kind;
  source: string;
  price: number;
  url: string | null;
  note: string | null;
  warranty?: typeof schema.priceObservations.$inferInsert.warranty;
  sampleSize?: number;
}) {
  await db
    .delete(schema.priceObservations)
    .where(
      and(
        eq(schema.priceObservations.variantId, row.variantId),
        eq(schema.priceObservations.source, row.source),
        eq(schema.priceObservations.kind, row.kind),
        gte(schema.priceObservations.observedAt, startOfDay()),
      ),
    );
  await db.insert(schema.priceObservations).values({ ...row, warranty: row.warranty ?? null, observedAt: new Date() });
}

/** Modeli (ve markasını) kataloğa ekler; varyantı yoksa sonra oluşur. */
async function ensureModel(brandId: string, name: string): Promise<string> {
  const id = buildModelId(brandId, name);
  await db.insert(schema.brands).values({ id: brandId, name: BRAND_NAMES[brandId] ?? brandId, sort: 90 }).onConflictDoNothing();
  await db
    .insert(schema.models)
    .values({
      id,
      brandId,
      name,
      series: name.split(" ")[0],
      releaseYear: guessReleaseYear(brandId, name) ?? new Date().getFullYear() - 1,
      family: brandId === "apple" ? "iphone" : "android",
      hasBatteryHealth: brandId === "apple",
      sort: 0,
    })
    .onConflictDoNothing();
  return id;
}

/** Katalogda olmayan bir telefonu kataloğa ekler ve varyant kimliğini döndürür. */
async function ensureVariant(c: { brandId: string; name: string; ramGb: number | null; storageGb: number }): Promise<string> {
  const modelId = await ensureModel(c.brandId, c.name);
  const variant = { ramGb: c.ramGb, storageGb: c.storageGb };
  const vId = buildVariantId(modelId, variant);
  await db.insert(schema.variants).values({ id: vId, modelId, ...variant }).onConflictDoNothing();
  return vId;
}

async function setStatus(source: string, ok: boolean, count: number, error: string | null) {
  const now = new Date();
  const values = { source, lastRunAt: now, lastCount: count, lastError: error, ...(ok ? { lastOkAt: now } : {}) };
  await db.insert(schema.sourceStatus).values(values).onConflictDoUpdate({ target: schema.sourceStatus.source, set: values });
}

async function enabledSources(): Promise<Set<string>> {
  const rows = await db.select().from(schema.sourceStatus);
  const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.source));
  return new Set(SOURCES.filter((s) => !disabled.has(s)));
}

export async function runGetmobil(opts: { modelIds?: string[]; log?: (m: string) => void } = {}): Promise<RunSummary> {
  const log = opts.log ?? (() => {});
  try {
    let sitemapXml: string | undefined;
    let addedModels = 0;
    // Tüm katalog taranıyorsa önce Getmobil'deki modeller kataloğa eklenir
    if (!opts.modelIds) {
      sitemapXml = await politeFetch(GETMOBIL_SITEMAP);
      const existing = new Set((await getCatalog()).flatMap((b) => b.models).map((m) => m.id));
      for (const entry of modelsFromSitemap(sitemapXml)) {
        const id = buildModelId(entry.brandId, entry.name);
        if (existing.has(id)) continue;
        await ensureModel(entry.brandId, entry.name);
        existing.add(id);
        addedModels++;
      }
      if (addedModels) log(`  kataloğa eklenen model: ${addedModels}`);
    }
    const catalog = await getCatalog();
    const models = catalog.flatMap((b) => b.models).filter((m) => !opts.modelIds || opts.modelIds.includes(m.id));
    const { results, missing, missingVariants } = await fetchGetmobil(models, log, sitemapXml);
    const byId = new Map(models.map((m) => [m.id, m]));
    // Katalogda olmayan hafıza seçenekleri oluşturulur ve fiyatları yazılır
    for (const mv of missingVariants) {
      const model = byId.get(mv.modelId);
      if (!model) continue;
      const variantId = await ensureVariant({ brandId: model.brandId, name: model.name, ramGb: mv.ramGb, storageGb: mv.storageGb });
      const kept = filterOutliers(mv.prices, (p) => p);
      const price = median(kept);
      if (price) {
        await writeDaily({
          variantId,
          kind: "refurb_retail",
          source: "getmobil",
          price,
          url: null,
          note: `${kept.length} ilan · en düşük ${Math.min(...kept)} ₺`,
          sampleSize: kept.length,
        });
      }
    }
    for (const r of results) {
      const kept = filterOutliers(r.prices, (p) => p);
      const price = median(kept)!;
      await writeDaily({
        variantId: r.variantId,
        kind: "refurb_retail",
        source: "getmobil",
        price,
        url: r.url,
        note: `${kept.length} ilan · en düşük ${Math.min(...kept)} ₺`,
        sampleSize: kept.length,
      });
    }
    const message = `${results.length + missingVariants.length} hafıza güncellendi${addedModels ? `, ${addedModels} yeni model` : ""}${missing.length ? ` · Getmobil'de olmayan: ${missing.length} model` : ""}`;
    if (!opts.modelIds) await setStatus("getmobil", true, results.length, null);
    return { source: "getmobil", ok: true, count: results.length, message };
  } catch (e) {
    const message = (e as Error).message;
    if (!opts.modelIds) await setStatus("getmobil", false, 0, message);
    return { source: "getmobil", ok: false, count: 0, message };
  }
}

export async function runAll(opts: { only?: SourceId; modelIds?: string[]; log?: (m: string) => void } = {}): Promise<RunSummary[]> {
  const enabled = await enabledSources();
  if (opts.only && opts.only !== "getmobil") return [];
  if (!opts.only && !enabled.has("getmobil")) return [];
  opts.log?.("▶ getmobil");
  return [await runGetmobil(opts)];
}
