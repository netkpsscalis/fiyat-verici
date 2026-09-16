/**
 * Vatan Bilgisayar sıfır cihaz fiyatları. Marka kategorisi sayfasındaki ürün kartları okunur;
 * robots.txt sayfalamayı yasakladığı için her markanın ilk sayfası alınır (marka başına 1 istek).
 */
import { createMatcher, tokenize } from "@/lib/parsers/normalize";
import type { WarrantyType } from "@/lib/db/schema";
import type { CatalogModel } from "@/lib/types";
import { politeFetch } from "./http";
import type { UnmatchedProduct } from "./unmatched";

export const VATAN_CATEGORIES: Record<string, string> = {
  apple: "https://www.vatanbilgisayar.com/apple/cep-telefonu-modelleri/",
  samsung: "https://www.vatanbilgisayar.com/samsung/cep-telefonu-modelleri/",
  xiaomi: "https://www.vatanbilgisayar.com/xiaomi/cep-telefonu-modelleri/",
};

export interface VatanProduct {
  name: string;
  price: number;
  url: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/** Kategori sayfasındaki ürün kartları: ad, fiyat ve ürün adresi */
export function parseVatanProducts(html: string): VatanProduct[] {
  const out: VatanProduct[] = [];
  const re = /product-list__product-name[\s\S]{0,200}?<h3>([^<]+)<\/h3>[\s\S]{0,2000}?product-list__price['"]>([\d.,]+)</g;
  for (const m of html.matchAll(re)) {
    const price = Number(m[2].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(price) || price < 500) continue;
    // Ürün adresi kartın başında; isimden geriye doğru en yakın link alınır
    const before = html.slice(Math.max(0, m.index - 3000), m.index);
    const links = [...before.matchAll(/href=['"](https:\/\/www\.vatanbilgisayar\.com\/[^'"]+\.html)['"]/g)];
    out.push({
      name: decodeEntities(m[1]).replace(/\s+/g, " ").trim(),
      price,
      url: links.length ? links[links.length - 1][1] : null,
    });
  }
  return out;
}

/** "iPhone 15 128 Gb", "Galaxy A27 5G 8/256 GB", "Redmi 15 8+256GB" → RAM ve depolama */
export function storageFromName(name: string): { ramGb: number | null; storageGb: number } | null {
  const t = tokenize(name);
  for (const token of t) {
    let m = /^(\d{1,2})\/(\d{2,4})(gb)?$/.exec(token);
    if (m) return { ramGb: Number(m[1]), storageGb: Number(m[2]) };
    m = /^(\d)tb$/.exec(token);
    if (m) return { ramGb: null, storageGb: Number(m[1]) * 1024 };
    m = /^(\d{2,4})(gb)?$/.exec(token);
    if (m && [64, 128, 256, 512].includes(Number(m[1]))) return { ramGb: null, storageGb: Number(m[1]) };
  }
  return null;
}

function warrantyOf(name: string): WarrantyType {
  return /ithalat/i.test(name) ? "ithalatci" : "resmi";
}

export interface VatanResult {
  variantId: string;
  price: number;
  url: string | null;
  name: string;
  warranty: WarrantyType;
}

/** Ürün adlarını katalogla eşleştirir; aynı varyantın farklı renkleri arasından en ucuzu kalır. */
export function matchVatanProducts(
  products: VatanProduct[],
  models: CatalogModel[],
  brandId: string,
): { matched: VatanResult[]; unmatched: UnmatchedProduct[] } {
  const match = createMatcher(models);
  const best = new Map<string, VatanResult>();
  const unmatched: UnmatchedProduct[] = [];
  for (const p of products) {
    const found = match(tokenize(p.name), brandId);
    if (!found) {
      const size = storageFromName(p.name);
      unmatched.push({ name: p.name, price: p.price, brandId, ramGb: size?.ramGb ?? null, storageGb: size?.storageGb ?? null });
      continue;
    }
    const size = storageFromName(p.name);
    const candidates = size
      ? found.model.variants.filter(
          (v) => v.storageGb === size.storageGb && (size.ramGb === null || v.ramGb === null || v.ramGb === size.ramGb),
        )
      : found.model.variants.length === 1
        ? found.model.variants
        : [];
    for (const v of candidates) {
      const cur = best.get(v.id);
      if (!cur || p.price < cur.price) {
        best.set(v.id, { variantId: v.id, price: p.price, url: p.url, name: p.name, warranty: warrantyOf(p.name) });
      }
    }
  }
  return { matched: [...best.values()], unmatched };
}

export async function fetchVatan(
  models: CatalogModel[],
  log: (m: string) => void = () => {},
): Promise<{ results: VatanResult[]; unmatched: UnmatchedProduct[] }> {
  const results: VatanResult[] = [];
  const unmatched: UnmatchedProduct[] = [];
  for (const [brandId, url] of Object.entries(VATAN_CATEGORIES)) {
    try {
      const html = await politeFetch(url, { delayMs: 4000 });
      const products = parseVatanProducts(html);
      const res = matchVatanProducts(products, models.filter((m) => m.brandId === brandId), brandId);
      results.push(...res.matched);
      unmatched.push(...res.unmatched);
      log(`  ${brandId}: ${products.length} üründen ${res.matched.length} cihaz eşleşti`);
    } catch (e) {
      log(`  ${brandId}: ${(e as Error).message}`);
    }
  }
  return { results, unmatched };
}
