/**
 * Sayfadaki schema.org verisinden (JSON-LD) ürün tekliflerini çıkarır.
 * E-ticaret sitelerinin çoğu arama motorları için bu veriyi yayınlar; site tasarımı değişse de genelde aynı kalır.
 */
export interface ExtractedOffer {
  name: string | null;
  /** "256 GB", "8 GB / 256 GB" gibi */
  size: string | null;
  price: number;
  currency: string | null;
  condition: "new" | "refurbished" | "used" | null;
  inStock: boolean | null;
}

type Json = Record<string, unknown>;

export function extractJsonLd(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const data = JSON.parse(m[1].trim());
      const push = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(push);
        else if (x && typeof x === "object") {
          const obj = x as Json;
          if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(push);
          else out.push(obj);
        }
      };
      push(data);
    } catch {
      // bozuk JSON-LD bloğu atlanır
    }
  }
  return out;
}

function types(o: Json): string[] {
  const t = o["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s|₺|TL/gi, "");
  // "76.999,00" (TR) ya da "76999.00" / "76,999.00" (EN)
  const tr = /^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s);
  const n = tr ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function condition(v: unknown): ExtractedOffer["condition"] {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("refurbished")) return "refurbished";
  if (s.includes("used")) return "used";
  if (s.includes("new")) return "new";
  return null;
}

function stock(v: unknown): boolean | null {
  const s = String(v ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("instock") || s.includes("limitedavailability") || s.includes("onlineonly")) return true;
  if (s.includes("outofstock") || s.includes("soldout") || s.includes("discontinued")) return false;
  return null;
}

function sizeOf(p: Json): string | null {
  if (typeof p.size === "string") return p.size;
  const props = Array.isArray(p.additionalProperty) ? (p.additionalProperty as Json[]) : [];
  const hit = props.find((x) => /depolama|hafıza|hafiza|storage|kapasite/i.test(String(x?.name ?? "")));
  return hit ? String(hit.value ?? "") || null : null;
}

function offersOf(p: Json, inherited: { name: string | null; size: string | null; cond: unknown }): ExtractedOffer[] {
  const raw = p.offers;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Json[];
  const out: ExtractedOffer[] = [];
  for (const o of list) {
    const nested = o.offers;
    if (types(o).includes("AggregateOffer") && Array.isArray(nested)) {
      out.push(...offersOf({ offers: nested }, inherited));
      continue;
    }
    const price = parseNumber(o.price ?? o.lowPrice);
    if (price === null || price <= 0) continue;
    out.push({
      name: inherited.name,
      size: inherited.size,
      price,
      currency: typeof o.priceCurrency === "string" ? o.priceCurrency : null,
      condition: condition(o.itemCondition ?? inherited.cond),
      inStock: stock(o.availability),
    });
  }
  return out;
}

export function extractOffers(html: string): ExtractedOffer[] {
  const out: ExtractedOffer[] = [];
  for (const node of extractJsonLd(html)) {
    const t = types(node);
    const base = {
      name: typeof node.name === "string" ? node.name : null,
      size: sizeOf(node),
      cond: node.itemCondition,
    };
    if (t.includes("ProductGroup") && Array.isArray(node.hasVariant) && node.hasVariant.length) {
      for (const v of node.hasVariant as Json[]) {
        out.push(
          ...offersOf(v, {
            name: typeof v.name === "string" ? v.name : base.name,
            size: sizeOf(v) ?? base.size,
            cond: v.itemCondition ?? base.cond,
          }),
        );
      }
    } else if (t.includes("Product") || t.includes("ProductGroup")) {
      out.push(...offersOf(node, base));
    }
  }
  return out;
}

/** "256 GB", "1 TB", "8 GB / 256 GB", "12GB RAM 512GB" → RAM ve depolama */
export function parseSize(s: string | null): { ramGb: number | null; storageGb: number } | null {
  if (!s) return null;
  const f = s.toLowerCase().replace(/\s+/g, "");
  let m = /(\d{1,2})gb(?:ram)?[/+]?(\d{2,4})(gb|tb)/.exec(f);
  if (m) return { ramGb: Number(m[1]), storageGb: m[3] === "tb" ? Number(m[2]) * 1024 : Number(m[2]) };
  m = /(\d)tb/.exec(f);
  if (m) return { ramGb: null, storageGb: Number(m[1]) * 1024 };
  m = /(\d{2,4})gb/.exec(f);
  if (m) return { ramGb: null, storageGb: Number(m[1]) };
  return null;
}
