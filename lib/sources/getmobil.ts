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
export function offersByVariant(
  model: CatalogModel,
  offers: ExtractedOffer[],
): { byVariant: Map<string, number[]>; missing: { ramGb: number | null; storageGb: number; prices: number[] }[] } {
  const out = new Map<string, number[]>();
  const missing = new Map<string, { ramGb: number | null; storageGb: number; prices: number[] }>();
  for (const o of offers) {
    if (o.inStock === false || o.condition === "new") continue;
    if (o.currency && o.currency !== "TRY") continue;
    const size = parseSize(o.size) ?? parseSize(o.name);
    if (!size) continue;
    const targets = model.variants.filter(
      (v) => v.storageGb === size.storageGb && (size.ramGb === null || v.ramGb === null || v.ramGb === size.ramGb),
    );
    if (targets.length === 0) {
      // Katalogda olmayan hafıza seçeneği: çağıran taraf ekleyebilsin diye bildirilir
      const key = `${size.ramGb ?? ""}/${size.storageGb}`;
      const cur = missing.get(key) ?? { ramGb: size.ramGb, storageGb: size.storageGb, prices: [] };
      cur.prices.push(o.price);
      missing.set(key, cur);
      continue;
    }
    for (const v of targets) out.set(v.id, [...(out.get(v.id) ?? []), o.price]);
  }
  return { byVariant: out, missing: [...missing.values()] };
}

/** Getmobil site haritasındaki marka klasörü → katalogdaki marka */
const BRAND_FOLDERS: Record<string, string> = {
  apple: "apple",
  samsung: "samsung",
  xiaomi: "xiaomi",
  redmi: "xiaomi",
  poco: "xiaomi",
  oppo: "oppo",
  honor: "honor",
  huawei: "huawei",
  realme: "realme",
  vivo: "vivo",
  tecno: "tecno",
  infinix: "infinix",
  "general-mobile": "general-mobile",
  casper: "casper",
  reeder: "reeder",
  omix: "omix",
  nothing: "nothing",
  tcl: "tcl",
  zte: "zte",
  alcatel: "alcatel",
  motorola: "motorola",
  oneplus: "oneplus",
  google: "google",
  nokia: "nokia",
  sony: "sony",
  asus: "asus",
};

/** "galaxy-s24-ultra" → "Galaxy S24 Ultra", "iphone-15-pro" → "iPhone 15 Pro" */
export function modelNameFromSlug(slug: string, brandId: string): string {
  const words = slug.replace(/-5g$/, "").split("-");
  return words
    .map((w) => {
      if (w === "iphone") return "iPhone";
      if (w === "poco") return "POCO";
      if (/^\d/.test(w)) return w.toUpperCase();
      if (w.length <= 2) return w.toUpperCase();
      return w.charAt(0).toLocaleUpperCase("tr") + w.slice(1);
    })
    .join(" ")
    .replace(/^Apple /, "")
    .trim();
}

/** Getmobil POCO/Redmi/Xiaomi klasörlerinde adı seri öneki olmadan yazar ("x7-pro", "14t"): katalogdaki adla aynı olsun */
export function withSeriesPrefix(folder: string, name: string): string {
  if (folder === "poco" && !/^poco\b/i.test(name)) return `POCO ${name}`;
  if (folder === "redmi" && !/^redmi\b/i.test(name)) return `Redmi ${name}`;
  if (folder === "xiaomi") {
    if (/^MI\b/.test(name)) return name.replace(/^MI\b/, "Mi").replace(/(\d+) T\b/, "$1T");
    if (/^\d/.test(name)) return `Xiaomi ${name}`;
    if (/^[XFMC]\d/.test(name)) return `POCO ${name}`;
  }
  return name;
}

/** Site haritasındaki bütün telefon modelleri: kataloğu genişletmek için */
export function modelsFromSitemap(xml: string): { brandId: string; name: string; key: string }[] {
  const out: { brandId: string; name: string; key: string }[] = [];
  for (const key of groupSitemap(xml).keys()) {
    const [folder, modelSlug] = key.split("/");
    const brandId = BRAND_FOLDERS[folder];
    if (!brandId || !modelSlug) continue;
    const name = withSeriesPrefix(folder, modelNameFromSlug(modelSlug, brandId));
    if (name.split(" ").length > 5 || name.length > 40) continue;
    out.push({ brandId, name, key });
  }
  return out;
}

export interface SourceResult {
  variantId: string;
  prices: number[];
  url: string;
}

export interface MissingVariant {
  modelId: string;
  ramGb: number | null;
  storageGb: number;
  prices: number[];
}

export async function fetchGetmobil(
  models: CatalogModel[],
  log: (msg: string) => void = () => {},
  sitemapXml?: string,
): Promise<{ results: SourceResult[]; missing: string[]; missingVariants: MissingVariant[] }> {
  const groups = groupSitemap(sitemapXml ?? (await politeFetch(GETMOBIL_SITEMAP)));
  const results: SourceResult[] = [];
  const missing: string[] = [];
  const missingVariants: MissingVariant[] = [];

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
        const res = offersByVariant(model, offers);
        for (const [vid, prices] of res.byVariant) found.set(vid, [...(found.get(vid) ?? []), ...prices]);
        for (const m of res.missing) missingVariants.push({ modelId: model.id, ...m });
        seen.push(url);
      } catch (e) {
        log(`  ${model.name}: ${(e as Error).message}`);
      }
    }
    for (const [variantId, prices] of found) results.push({ variantId, prices, url: seen[0] });
    log(`  ${model.name}: ${found.size} hafıza, ${[...found.values()].reduce((n, p) => n + p.length, 0)} ilan`);
  }
  return { results, missing, missingVariants };
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
