/**
 * Getmobil yenilenmiş cihaz satış fiyatları. Site haritasından modelin ürün sayfası bulunur;
 * bir sayfadaki ürün grubu o modelin bütün hafıza seçeneklerini içerir.
 */
import { slug } from "@/data/seed/devices";
import type { CatalogModel } from "@/lib/types";
import { politeFetch } from "./http";
import { extractOffers, parseSize, type ExtractedOffer } from "./jsonld";

export const GETMOBIL_SITEMAP = "https://getmobil.com/sitemap_products.xml";

/** Site haritasındaki ürün linklerini "marka/model" klasörüne göre gruplar. */
export function groupSitemap(xml: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of xml.matchAll(/<loc>(https:\/\/getmobil\.com\/satin-al\/cep-telefonu\/[^/]+\/([^/]+)\/([^/]+)\/[^<]*)<\/loc>/g)) {
    const key = `${m[2]}/${m[3]}`;
    out.set(key, [...(out.get(key) ?? []), m[1]]);
  }
  return out;
}

/** Katalogdaki modelin Getmobil'deki klasör adı adayları */
export function folderKeys(model: CatalogModel): string[] {
  const s = slug(model.name);
  const brands = model.brandId === "xiaomi" ? ["xiaomi", "redmi", "poco"] : [model.brandId];
  const base = [s, s.replace(/^xiaomi-/, ""), s.replace(/^(redmi|poco)-/, "")];
  // Getmobil bazı modellere "-5g" ekliyor (galaxy-s22-5g, galaxy-a56-5g); önce tam ad denenir
  const names = new Set([...base, ...base.map((n) => `${n}-5g`)]);
  return [...names].flatMap((n) => brands.map((b) => `${b}/${n}`));
}

/** Teklifleri katalog varyantlarına dağıtır. RAM yazmıyorsa aynı depolamalı bütün varyantlara gider. */
export function offersByVariant(model: CatalogModel, offers: ExtractedOffer[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const o of offers) {
    if (o.inStock === false || o.condition === "new") continue;
    if (o.currency && o.currency !== "TRY") continue;
    const size = parseSize(o.size) ?? parseSize(o.name);
    if (!size) continue;
    const targets = model.variants.filter(
      (v) => v.storageGb === size.storageGb && (size.ramGb === null || v.ramGb === null || v.ramGb === size.ramGb),
    );
    for (const v of targets) out.set(v.id, [...(out.get(v.id) ?? []), o.price]);
  }
  return out;
}

export interface SourceResult {
  variantId: string;
  prices: number[];
  url: string;
}

export async function fetchGetmobil(
  models: CatalogModel[],
  log: (msg: string) => void = () => {},
): Promise<{ results: SourceResult[]; missing: string[] }> {
  const groups = groupSitemap(await politeFetch(GETMOBIL_SITEMAP));
  const results: SourceResult[] = [];
  const missing: string[] = [];

  for (const model of models) {
    const key = folderKeys(model).find((k) => groups.has(k));
    if (!key) {
      missing.push(model.name);
      continue;
    }
    const urls = groups.get(key)!;
    const found = new Map<string, number[]>();
    const seen: string[] = [];
    // İlk sayfa çoğu zaman bütün hafızaları içerir; eksik kalan hafıza için en fazla 2 sayfa daha açılır
    for (const url of pickPages(model, urls)) {
      const want = model.variants.filter((v) => !found.has(v.id));
      if (seen.length && want.length === 0) break;
      try {
        const offers = extractOffers(await politeFetch(url));
        for (const [vid, prices] of offersByVariant(model, offers)) found.set(vid, [...(found.get(vid) ?? []), ...prices]);
        seen.push(url);
      } catch (e) {
        log(`  ${model.name}: ${(e as Error).message}`);
      }
    }
    for (const [variantId, prices] of found) results.push({ variantId, prices, url: seen[0] });
    log(`  ${model.name}: ${found.size} hafıza, ${[...found.values()].reduce((n, p) => n + p.length, 0)} ilan`);
  }
  return { results, missing };
}

function pickPages(model: CatalogModel, urls: string[]): string[] {
  const pages = [urls[0]];
  for (const v of model.variants) {
    const tag = v.storageGb >= 1024 ? `-${v.storageGb / 1024}-tb-` : `-${v.storageGb}-gb-`;
    const u = urls.find((x) => x.includes(tag) && !pages.includes(x));
    if (u && pages.length < 3) pages.push(u);
  }
  return pages;
}
