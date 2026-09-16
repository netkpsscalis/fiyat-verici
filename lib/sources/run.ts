/**
 * Kaynak çalıştırıcı: Getmobil ve takip edilen linkleri okur, sonuçları piyasa fiyatı olarak yazar.
 * Aynı gün tekrar çalışırsa o günün kaydını günceller (çift kayıt olmaz).
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { filterOutliers, median } from "@/lib/pricing/stats";
import { fetchGetmobil } from "./getmobil";
import { politeFetch, sourceNameFromUrl } from "./http";
import { extractOffers } from "./jsonld";
import { pickTrackedPrice } from "./pick";

export const SOURCES = ["getmobil", "tracked"] as const;
export type SourceId = (typeof SOURCES)[number];

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
    const catalog = await getCatalog();
    const models = catalog.flatMap((b) => b.models).filter((m) => !opts.modelIds || opts.modelIds.includes(m.id));
    const { results, missing } = await fetchGetmobil(models, log);
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
    const message = `${results.length} hafıza güncellendi${missing.length ? ` · Getmobil'de olmayan: ${missing.length} model` : ""}`;
    if (!opts.modelIds) await setStatus("getmobil", true, results.length, null);
    return { source: "getmobil", ok: true, count: results.length, message };
  } catch (e) {
    const message = (e as Error).message;
    if (!opts.modelIds) await setStatus("getmobil", false, 0, message);
    return { source: "getmobil", ok: false, count: 0, message };
  }
}

export async function runTracked(opts: { variantIds?: string[]; log?: (m: string) => void } = {}): Promise<RunSummary> {
  const log = opts.log ?? (() => {});
  const rows = await db
    .select({ t: schema.trackedUrls, v: schema.variants })
    .from(schema.trackedUrls)
    .innerJoin(schema.variants, eq(schema.trackedUrls.variantId, schema.variants.id))
    .where(opts.variantIds ? inArray(schema.trackedUrls.variantId, opts.variantIds) : undefined);

  // Tek "başlangıç fiyatı" veren sayfalar için her modelin en düşük hafızası gerekir
  const modelIds = [...new Set(rows.map((r) => r.v.modelId))];
  const siblings = modelIds.length
    ? await db.select().from(schema.variants).where(inArray(schema.variants.modelId, modelIds))
    : [];
  const lowest = new Map<string, number>();
  for (const s of siblings) lowest.set(s.modelId, Math.min(lowest.get(s.modelId) ?? Infinity, s.storageGb));

  let count = 0;
  let failed = 0;
  for (const { t, v } of rows) {
    try {
      const offers = extractOffers(await politeFetch(t.url));
      const price = pickTrackedPrice(offers, v, lowest.get(v.modelId) ?? v.storageGb);
      await writeDaily({ variantId: t.variantId, kind: t.kind, source: sourceNameFromUrl(t.url), price, url: t.url, note: null, warranty: t.warranty });
      await db
        .update(schema.trackedUrls)
        .set({ lastPrice: price, lastCheckedAt: new Date(), lastError: null })
        .where(eq(schema.trackedUrls.id, t.id));
      count++;
      log(`  ${t.url} → ${price}`);
    } catch (e) {
      failed++;
      const msg = (e as Error).message;
      await db.update(schema.trackedUrls).set({ lastCheckedAt: new Date(), lastError: msg }).where(eq(schema.trackedUrls.id, t.id));
      log(`  ${t.url} → HATA: ${msg}`);
    }
  }
  const message = `${count} link okundu${failed ? `, ${failed} link okunamadı` : ""}`;
  if (!opts.variantIds) await setStatus("tracked", failed === 0 || count > 0, count, failed ? `${failed} link okunamadı` : null);
  return { source: "tracked", ok: failed === 0 || count > 0, count, message };
}

export async function runAll(opts: { only?: SourceId; modelIds?: string[]; log?: (m: string) => void } = {}): Promise<RunSummary[]> {
  const enabled = await enabledSources();
  const out: RunSummary[] = [];
  for (const s of SOURCES) {
    if (opts.only && opts.only !== s) continue;
    if (!opts.only && !enabled.has(s)) continue;
    opts.log?.(`▶ ${s}`);
    out.push(s === "getmobil" ? await runGetmobil(opts) : await runTracked({ log: opts.log }));
  }
  return out;
}
