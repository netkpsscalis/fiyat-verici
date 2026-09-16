/**
 * Turkcell Pasaj sıfır cihaz fiyatları. Kategori sayfasında schema.org ItemList olarak
 * ürün adı + fiyat yayınlanıyor; kategori başına tek istek yeter.
 */
import { createMatcher, tokenize } from "@/lib/parsers/normalize";
import type { CatalogModel } from "@/lib/types";
import { politeFetch } from "./http";
import { extractJsonLd, parseNumber } from "./jsonld";
import type { UnmatchedProduct } from "./unmatched";
import { storageFromName } from "./vatan";

export const TURKCELL_CATEGORIES = [
  "https://www.turkcell.com.tr/pasaj/cep-telefonu",
  "https://www.turkcell.com.tr/pasaj/cep-telefonu/ios-telefonlar",
  "https://www.turkcell.com.tr/pasaj/cep-telefonu/android-telefonlar",
];

export interface TurkcellProduct {
  name: string;
  brand: string | null;
  price: number;
  url: string | null;
  inStock: boolean;
}

type Json = Record<string, unknown>;

/** Sayfadaki ItemList içinden ürün adı, markası ve fiyatı */
export function parseTurkcellProducts(html: string): TurkcellProduct[] {
  const out: TurkcellProduct[] = [];
  for (const node of extractJsonLd(html)) {
    if (node["@type"] !== "ItemList" || !Array.isArray(node.itemListElement)) continue;
    for (const entry of node.itemListElement as Json[]) {
      const p = ((entry.item as Json) ?? entry) as Json;
      const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Json | undefined;
      const price = parseNumber(offers?.price);
      if (typeof p.name !== "string" || price === null || price < 500) continue;
      const availability = String(offers?.availability ?? "").toLowerCase();
      out.push({
        name: p.name,
        brand: typeof (p.brand as Json)?.name === "string" ? ((p.brand as Json).name as string) : null,
        price,
        url: typeof p["@id"] === "string" ? p["@id"].replace(/#product$/, "") : null,
        inStock: !availability.includes("outofstock"),
      });
    }
  }
  return out;
}

const BRAND_IDS: Record<string, string> = { apple: "apple", samsung: "samsung", xiaomi: "xiaomi", redmi: "xiaomi", poco: "xiaomi" };

export interface TurkcellResult {
  variantId: string;
  price: number;
  url: string | null;
  name: string;
}

export function matchTurkcellProducts(
  products: TurkcellProduct[],
  models: CatalogModel[],
): { matched: TurkcellResult[]; unmatched: UnmatchedProduct[] } {
  const match = createMatcher(models);
  const best = new Map<string, TurkcellResult>();
  const unmatched: UnmatchedProduct[] = [];
  for (const p of products) {
    if (!p.inStock) continue;
    const brandId = BRAND_IDS[(p.brand ?? "").toLocaleLowerCase("tr")] ?? null;
    const found = match(tokenize(p.name), brandId);
    if (!found) {
      // Sadece bilinen telefon markaları listeye girer; kulaklık, saat, kablo eklenmez
      const size = storageFromName(p.name);
      if (brandId && size) unmatched.push({ name: p.name, price: p.price, brandId, ramGb: size.ramGb, storageGb: size.storageGb });
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
      if (!cur || p.price < cur.price) best.set(v.id, { variantId: v.id, price: p.price, url: p.url, name: p.name });
    }
  }
  return { matched: [...best.values()], unmatched };
}

export async function fetchTurkcell(
  models: CatalogModel[],
  log: (m: string) => void = () => {},
): Promise<{ results: TurkcellResult[]; unmatched: UnmatchedProduct[] }> {
  const seen = new Map<string, TurkcellResult>();
  const unmatched = new Map<string, UnmatchedProduct>();
  for (const url of TURKCELL_CATEGORIES) {
    try {
      const products = parseTurkcellProducts(await politeFetch(url, { delayMs: 4000 }));
      const res = matchTurkcellProducts(products, models);
      for (const r of res.matched) {
        const cur = seen.get(r.variantId);
        if (!cur || r.price < cur.price) seen.set(r.variantId, r);
      }
      for (const u of res.unmatched) unmatched.set(u.name, u);
      log(`  ${url.split("/").pop()}: ${products.length} üründen ${res.matched.length} cihaz eşleşti`);
    } catch (e) {
      log(`  ${url.split("/").pop()}: ${(e as Error).message}`);
    }
  }
  return { results: [...seen.values()], unmatched: [...unmatched.values()] };
}
