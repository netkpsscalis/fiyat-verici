/**
 * Toptancı fiyat listesi ayrıştırıcı. WhatsApp'tan yapıştırılan metni, Excel'den ya da PDF'ten
 * çıkarılan satırları aynı şekilde işler: her satırda model, RAM/depolama, garanti ve fiyat arar.
 */
import type { WarrantyType } from "@/lib/db/schema";
import type { CatalogModel } from "@/lib/types";
import { brandOf, createMatcher, fold, tokenize } from "./normalize";

export type RowStatus = "ok" | "no_model" | "no_variant" | "no_price" | "ambiguous";

export interface ParsedRow {
  line: number;
  raw: string;
  modelId: string | null;
  modelName: string | null;
  variantId: string | null;
  ramGb: number | null;
  storageGb: number | null;
  price: number | null;
  warranty: WarrantyType | null;
  /** Satırda 2. el / yenilenmiş ifadesi var */
  used: boolean;
  status: RowStatus;
}

const STORAGE_VALUES = new Set([32, 64, 128, 256, 512]);

function parseStorage(t: string): { ramGb: number | null; storageGb: number } | null {
  let m = /^(\d{1,2})\/(\d{2,4})(gb)?$/.exec(t) ?? /^(\d{1,2})gb\/(\d{2,4})(gb)?$/.exec(t);
  if (m) {
    const storage = Number(m[2]);
    return STORAGE_VALUES.has(storage) || storage === 1024 ? { ramGb: Number(m[1]), storageGb: storage } : null;
  }
  m = /^(\d)\/(\d)tb$/.exec(t);
  if (m) return { ramGb: Number(m[1]), storageGb: Number(m[2]) * 1024 };
  m = /^(\d{1,2})\/(\d)tb$/.exec(t);
  if (m) return { ramGb: Number(m[1]), storageGb: Number(m[2]) * 1024 };
  m = /^(\d)tb$/.exec(t);
  if (m) return { ramGb: null, storageGb: Number(m[1]) * 1024 };
  m = /^(\d{2,3})(gb|g)?$/.exec(t);
  if (m && STORAGE_VALUES.has(Number(m[1]))) return { ramGb: null, storageGb: Number(m[1]) };
  return null;
}

/** "45.500", "45500", "45,5k", "45.5bin" → 45500. 1.000 TL altı sayılar fiyat sayılmaz. */
export function parsePriceToken(t: string): number | null {
  let m = /^(\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.exec(t);
  if (m) return Number(m[1].replace(/\./g, ""));
  m = /^(\d{1,3}(?:,\d{3})+)$/.exec(t);
  if (m) return Number(m[1].replace(/,/g, ""));
  m = /^(\d+(?:[.,]\d+)?)(k|bin)$/.exec(t);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 1000);
  m = /^(\d{4,7})$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

export function detectWarranty(folded: string): WarrantyType | null {
  if (/ithalat|\bith\b/.test(folded)) return "ithalatci";
  if (/\b(yd|yurtdisi|yurt disi|global|kayitsiz|pasaport)\b/.test(folded)) return "yurtdisi";
  if (/\b(tr|turkiye|resmi|garantili|apple tr|distributor)\b/.test(folded)) return "resmi";
  return null;
}

function detectUsed(folded: string): boolean {
  return /\b2\s*\.?\s*el\b|ikinci el|outlet|yenilenmis|refurb|teshir/.test(folded);
}

/**
 * Eşleşmeyen satırdan hatırlanacak model yazımını tahmin eder: depolama ya da fiyattan önceki kısım.
 * "15PM 256 77.000" → "15pm"
 */
export function aliasCandidate(raw: string): string {
  const out: string[] = [];
  for (const t of tokenize(raw)) {
    if (parseStorage(t) || parsePriceToken(t) !== null || /^\d{3,}$/.test(t)) break;
    out.push(t);
  }
  return out.join(" ");
}

function resolveVariant(model: CatalogModel, spec: { ramGb: number | null; storageGb: number } | null) {
  if (!spec) {
    return model.variants.length === 1
      ? { variant: model.variants[0], status: "ok" as const }
      : { variant: null, status: "no_variant" as const };
  }
  const sameStorage = model.variants.filter((v) => v.storageGb === spec.storageGb);
  const exact = spec.ramGb !== null ? sameStorage.find((v) => v.ramGb === spec.ramGb) : null;
  if (exact) return { variant: exact, status: "ok" as const };
  if (sameStorage.length === 1) return { variant: sameStorage[0], status: "ok" as const };
  if (sameStorage.length > 1) return { variant: null, status: "ambiguous" as const };
  return { variant: null, status: "no_variant" as const };
}

export function parsePriceList(
  text: string,
  models: CatalogModel[],
  learned: { alias: string; modelId: string }[] = [],
): ParsedRow[] {
  const match = createMatcher(models, learned);
  const rows: ParsedRow[] = [];
  let brandContext: string | null = null;
  let warrantyContext: WarrantyType | null = null;

  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const folded = fold(line);
    const tokens = tokenize(line);
    if (tokens.length === 0) return;

    const found = match(tokens, brandContext);
    const lineBrand = brandOf(tokens);
    const prices = tokens.map(parsePriceToken).filter((p): p is number => p !== null && p >= 1000);

    // Fiyat ve model içermeyen satır başlıktır: marka ve garanti bağlamını günceller
    if (!found && prices.length === 0) {
      if (lineBrand) brandContext = lineBrand;
      const w = detectWarranty(folded);
      if (w || lineBrand) warrantyContext = w;
      return;
    }
    if (found && lineBrand) brandContext = found.model.brandId;
    else if (found) brandContext = found.model.brandId;

    const warranty = detectWarranty(folded) ?? warrantyContext;
    const used = detectUsed(folded);
    const base = { line: idx + 1, raw: line, warranty, used };

    if (!found) {
      rows.push({ ...base, modelId: null, modelName: null, variantId: null, ramGb: null, storageGb: null, price: prices.at(-1) ?? null, status: "no_model" });
      return;
    }

    // Model sonrası parçalar: "128 45.500 | 256 51.000" gibi birden fazla depolama-fiyat çifti olabilir
    const rest = [...tokens.slice(0, found.start), ...tokens.slice(found.end)];
    const pairs: { spec: { ramGb: number | null; storageGb: number } | null; price: number | null }[] = [];
    let pending: { ramGb: number | null; storageGb: number } | null = null;
    for (const t of rest) {
      const price = parsePriceToken(t);
      if (price !== null && price >= 1000) {
        pairs.push({ spec: pending, price });
        pending = null;
        continue;
      }
      const spec = parseStorage(t);
      if (spec) {
        if (pending) pairs.push({ spec: pending, price: null });
        pending = spec;
      }
    }
    if (pending) pairs.push({ spec: pending, price: null });
    if (pairs.length === 0) pairs.push({ spec: null, price: null });

    for (const p of pairs) {
      const { variant, status } = resolveVariant(found.model, p.spec);
      rows.push({
        ...base,
        modelId: found.model.id,
        modelName: found.model.name,
        variantId: variant?.id ?? null,
        ramGb: variant?.ramGb ?? p.spec?.ramGb ?? null,
        storageGb: variant?.storageGb ?? p.spec?.storageGb ?? null,
        price: p.price,
        status: p.price === null ? "no_price" : status,
      });
    }
  });

  return rows;
}
