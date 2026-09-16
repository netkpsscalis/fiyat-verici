/**
 * Epey, Akakçe gibi karşılaştırma sayfalarındaki satıcı listesini metin olarak yapıştırınca
 * mağaza adı, fiyat ve garanti bilgisini çıkarır. Sayfaya istek atılmaz; kullanıcının
 * kendi tarayıcısından kopyaladığı metin işlenir.
 */
import type { WarrantyType } from "@/lib/db/schema";

export interface PastedOffer {
  /** Mağaza ya da pazaryeri satıcısı adı */
  seller: string;
  price: number;
  /** Kargo dahil fiyat farklıysa */
  shipping: number | null;
  warranty: WarrantyType | null;
  title: string | null;
}

const KNOWN_STORES = [
  "hepsiburada", "trendyol", "amazon", "n11", "pttavm", "ptt avm", "mediamarkt", "media markt", "vatan", "teknosa",
  "pazarama", "idefix", "çiçeksepeti", "ciceksepeti", "turkcell", "vodafone", "türk telekom", "turk telekom",
  "arçelik", "arcelik", "beko", "samsung", "apple", "migros", "carrefour", "morhipo", "gold", "itopya", "incehesap",
  "vestel", "casper", "reeder", "bittibitiyor", "akakçe", "akakce",
];

// "15.899,00 TL", "39,99 TL", "15899 TL" ve "₺15.899"
const PRICE = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d{4,7}(?:,\d{1,2})?)\s*(?:TL|₺)/i;

export function parsePriceText(text: string): number | null {
  const m = PRICE.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function detectWarranty(text: string): WarrantyType | null {
  const t = text.toLocaleLowerCase("tr");
  if (/ithalatç|ithalatc/.test(t)) return "ithalatci";
  if (/distribüt|distribut|türkiye garantili|turkiye garantili|apple türkiye/.test(t)) return "resmi";
  if (/yurt dışı|yurt disi|global/.test(t)) return "yurtdisi";
  return null;
}

function findStore(lines: string[]): string | null {
  for (const line of lines) {
    const explicit = /satıcı\s*:\s*([^|·\n]+)/i.exec(line) ?? /satici\s*:\s*([^|·\n]+)/i.exec(line);
    if (explicit) return explicit[1].trim().slice(0, 40);
  }
  for (const line of lines) {
    const lower = line.toLocaleLowerCase("tr");
    const hit = KNOWN_STORES.find((s) => lower.includes(s));
    if (hit) return hit;
  }
  return null;
}

/** Kargo satırları ve başlık gibi fiyat olmayan satırlar atlanır. */
export function parseSellerPaste(text: string): PastedOffer[] {
  const out: PastedOffer[] = [];
  const buffer: string[] = [];
  let pendingShipping: number | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const price = parsePriceText(line);

    if (price !== null && price < 1000) {
      // "+ 39,99 TL Kargo" satırı genelde fiyatın hemen altındadır
      if (/kargo/i.test(line)) {
        if (out.length) out[out.length - 1].shipping = price;
        else pendingShipping = price;
      }
      continue;
    }

    if (price !== null) {
      const context = [...buffer].reverse();
      const seller = findStore(context);
      const title = context.find((l) => l.length > 12 && !/satıcı|satici|kargo|siteye git/i.test(l)) ?? null;
      if (seller) {
        out.push({
          seller,
          price,
          shipping: pendingShipping,
          warranty: detectWarranty([...context, line].join(" ")),
          title: title ? title.slice(0, 120) : null,
        });
      }
      buffer.length = 0;
      pendingShipping = null;
      continue;
    }

    buffer.push(line);
    if (buffer.length > 8) buffer.shift();
  }

  // Aynı satıcıdan birden fazla satır varsa en ucuzu kalır
  const cheapest = new Map<string, PastedOffer>();
  for (const o of out) {
    const key = `${o.seller.toLocaleLowerCase("tr")}|${o.warranty ?? ""}`;
    const cur = cheapest.get(key);
    if (!cur || o.price < cur.price) cheapest.set(key, o);
  }
  return [...cheapest.values()].sort((a, b) => a.price - b.price);
}
