/**
 * Kaynak çalıştırıcı: Getmobil ve takip edilen linkleri okur, sonuçları piyasa fiyatı olarak yazar.
 * Aynı gün tekrar çalışırsa o günün kaydını günceller (çift kayıt olmaz).
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { modelId as buildModelId, variantId as buildVariantId } from "@/data/seed/devices";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { filterOutliers, median } from "@/lib/pricing/stats";
import { fetchGetmobil, GETMOBIL_SITEMAP, modelsFromSitemap } from "./getmobil";
import { fetchItemListSite, ITEMLIST_SITES } from "./itemList";
import { fetchVatan } from "./vatan";
import { politeFetch, sourceNameFromUrl } from "./http";
import { extractOffers } from "./jsonld";
import { pickTrackedPrice } from "./pick";
import { BRAND_NAMES, catalogCandidate } from "./catalogAuto";
import type { UnmatchedProduct } from "./unmatched";

export const SOURCES = ["getmobil", "vatan", ...ITEMLIST_SITES.map((s) => s.id), "tracked"] as const;
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
      releaseYear: new Date().getFullYear(),
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

/**
 * Eşleşmeyen ürünler: telefon olduğu anlaşılanlar kataloğa eklenip fiyatı yazılır,
 * emin olunamayanlar kullanıcının onayı için listeye düşer.
 */
async function absorbUnmatched(
  source: string,
  items: UnmatchedProduct[],
  warranty: typeof schema.priceObservations.$inferInsert.warranty,
): Promise<{ added: number; pending: number }> {
  let added = 0;
  const pending: UnmatchedProduct[] = [];
  for (const u of items) {
    const candidate = catalogCandidate(u);
    if (!candidate) {
      pending.push(u);
      continue;
    }
    const variantId = await ensureVariant(candidate);
    if (u.price) {
      await writeDaily({ variantId, kind: "new_retail", source, price: u.price, url: null, note: u.name, warranty });
    }
    added++;
  }
  await recordUnmatched(source, pending);
  return { added, pending: pending.length };
}

/** Katalogda olmayan telefonları biriktirir; kullanıcı Kaynaklar sayfasından ekler. */
async function recordUnmatched(source: string, items: UnmatchedProduct[]) {
  const lastSeenAt = new Date();
  for (const u of items.slice(0, 60)) {
    const name = u.name.slice(0, 140);
    await db
      .insert(schema.unmatchedProducts)
      .values({ source, name, price: u.price, brandId: u.brandId, ramGb: u.ramGb, storageGb: u.storageGb, lastSeenAt })
      .onConflictDoUpdate({
        target: [schema.unmatchedProducts.source, schema.unmatchedProducts.name],
        set: { price: u.price, lastSeenAt, seenCount: sql`${schema.unmatchedProducts.seenCount} + 1` },
      });
  }
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

/** Vatan Bilgisayar: marka kategorisi sayfalarından sıfır cihaz fiyatları. */
export async function runVatan(opts: { log?: (m: string) => void } = {}): Promise<RunSummary> {
  const log = opts.log ?? (() => {});
  try {
    const catalog = await getCatalog();
    const { results, unmatched } = await fetchVatan(catalog.flatMap((b) => b.models), log);
    const absorbed = await absorbUnmatched("vatan", unmatched, "resmi");
    if (absorbed.added) log(`  kataloğa eklenen yeni model: ${absorbed.added}`);
    for (const r of results) {
      await writeDaily({
        variantId: r.variantId,
        kind: "new_retail",
        source: "vatan",
        price: r.price,
        url: r.url,
        note: r.name,
        warranty: r.warranty,
      });
    }
    const message = `${results.length + absorbed.added} cihazın sıfır fiyatı güncellendi${absorbed.added ? `, ${absorbed.added} yeni model eklendi` : ""}`;
    await setStatus("vatan", results.length > 0, results.length, results.length ? null : "Hiç ürün eşleşmedi.");
    return { source: "vatan", ok: results.length > 0, count: results.length, message };
  } catch (e) {
    const message = (e as Error).message;
    await setStatus("vatan", false, 0, message);
    return { source: "vatan", ok: false, count: 0, message };
  }
}

/** Kategori sayfasında ürün listesi yayınlayan mağazalar: Turkcell Pasaj, Arçelik, Beko. */
export async function runItemListSite(siteId: string, opts: { log?: (m: string) => void } = {}): Promise<RunSummary> {
  const log = opts.log ?? (() => {});
  const site = ITEMLIST_SITES.find((s) => s.id === siteId);
  if (!site) return { source: siteId, ok: false, count: 0, message: "Bilinmeyen mağaza." };
  try {
    const catalog = await getCatalog();
    const { results, unmatched } = await fetchItemListSite(site, catalog.flatMap((b) => b.models), log);
    const absorbed = await absorbUnmatched(site.id, unmatched, site.warranty);
    if (absorbed.added) log(`  kataloğa eklenen yeni model: ${absorbed.added}`);
    for (const r of results) {
      await writeDaily({
        variantId: r.variantId,
        kind: "new_retail",
        source: site.id,
        price: r.price,
        url: r.url,
        note: r.name,
        warranty: site.warranty,
      });
    }
    const message = `${results.length + absorbed.added} cihazın sıfır fiyatı güncellendi${absorbed.added ? `, ${absorbed.added} yeni model eklendi` : ""}`;
    await setStatus(site.id, results.length > 0, results.length, results.length ? null : "Hiç ürün eşleşmedi.");
    return { source: site.id, ok: results.length > 0, count: results.length, message };
  } catch (e) {
    const message = (e as Error).message;
    await setStatus(site.id, false, 0, message);
    return { source: site.id, ok: false, count: 0, message };
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
    if (s === "getmobil") out.push(await runGetmobil(opts));
    else if (s === "vatan") out.push(await runVatan({ log: opts.log }));
    else if (ITEMLIST_SITES.some((site) => site.id === s)) out.push(await runItemListSite(s, { log: opts.log }));
    else out.push(await runTracked({ log: opts.log }));
  }
  return out;
}
