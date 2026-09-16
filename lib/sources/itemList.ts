/**
 * Kategori sayfasında schema.org ItemList yayınlayan mağazalar (Turkcell Pasaj, Arçelik, Beko).
 * Ürün adı ve fiyatı hazır veride durduğu için kategori başına tek istek yeter.
 */
import { createMatcher, tokenize } from "@/lib/parsers/normalize";
import type { CatalogModel } from "@/lib/types";
import type { WarrantyType } from "@/lib/db/schema";
import { politeFetch } from "./http";
import { extractJsonLd, parseNumber } from "./jsonld";
import type { UnmatchedProduct } from "./unmatched";
import { storageFromName } from "./vatan";

export interface ItemListSite {
  id: string;
  label: string;
  urls: string[];
  /** Ürün adresleri göreliyse başına eklenir */
  baseUrl?: string;
  warranty: WarrantyType;
}

export const ITEMLIST_SITES: ItemListSite[] = [
  {
    id: "turkcell",
    label: "Turkcell Pasaj",
    warranty: "resmi",
    urls: [
      "https://www.turkcell.com.tr/pasaj/cep-telefonu",
      "https://www.turkcell.com.tr/pasaj/cep-telefonu/ios-telefonlar",
      "https://www.turkcell.com.tr/pasaj/cep-telefonu/android-telefonlar",
    ],
  },
  {
    id: "arcelik",
    label: "Arçelik",
    warranty: "resmi",
    baseUrl: "https://www.arcelik.com.tr",
    urls: ["https://www.arcelik.com.tr/cep-telefonu", "https://www.arcelik.com.tr/iphone-telefon-modelleri"],
  },
  {
    id: "beko",
    label: "Beko",
    warranty: "resmi",
    baseUrl: "https://www.beko.com.tr",
    urls: ["https://www.beko.com.tr/cep-telefonu"],
  },
];

export interface ListedProduct {
  name: string;
  brand: string | null;
  price: number;
  url: string | null;
  inStock: boolean;
}

type Json = Record<string, unknown>;

/** Sayfadaki ItemList içinden ürün adı, markası ve fiyatı */
export function parseItemListProducts(html: string, baseUrl?: string): ListedProduct[] {
  const out: ListedProduct[] = [];
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
        url: productUrl(p, baseUrl),
        inStock: !availability.includes("outofstock"),
      });
    }
  }
  return out;
}

function productUrl(p: Json, baseUrl?: string): string | null {
  const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Json | undefined;
  const raw = [p["@id"], p.url, offers?.url].find((x) => typeof x === "string") as string | undefined;
  if (!raw) return null;
  const clean = raw.replace(/#product$/, "");
  return clean.startsWith("http") ? clean : baseUrl ? `${baseUrl}${clean.startsWith("/") ? "" : "/"}${clean}` : null;
}

const BRAND_IDS: Record<string, string> = { apple: "apple", samsung: "samsung", xiaomi: "xiaomi", redmi: "xiaomi", poco: "xiaomi" };

export interface ListedResult {
  variantId: string;
  price: number;
  url: string | null;
  name: string;
}

export function matchListedProducts(
  products: ListedProduct[],
  models: CatalogModel[],
): { matched: ListedResult[]; unmatched: UnmatchedProduct[] } {
  const match = createMatcher(models);
  const best = new Map<string, ListedResult>();
  const unmatched: UnmatchedProduct[] = [];
  for (const p of products) {
    if (!p.inStock) continue;
    const brandId = BRAND_IDS[(p.brand ?? "").toLocaleLowerCase("tr")] ?? null;
    const found = match(tokenize(p.name), brandId);
    if (!found) {
      // Marka bilinmese de aday listesine girer; telefon mu değil mi kataloğa eklenirken ayıklanır
      const size = storageFromName(p.name);
      if (size) unmatched.push({ name: p.name, price: p.price, brandId, ramGb: size.ramGb, storageGb: size.storageGb });
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

export async function fetchItemListSite(
  site: ItemListSite,
  models: CatalogModel[],
  log: (m: string) => void = () => {},
): Promise<{ results: ListedResult[]; unmatched: UnmatchedProduct[] }> {
  const seen = new Map<string, ListedResult>();
  const unmatched = new Map<string, UnmatchedProduct>();
  for (const url of site.urls) {
    try {
      const products = parseItemListProducts(await politeFetch(url, { delayMs: 4000 }), site.baseUrl);
      const res = matchListedProducts(products, models);
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
