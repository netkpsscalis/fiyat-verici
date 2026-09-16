/**
 * Sahibinden, Dolap, Letgo gibi ilan sitelerinin arama sonuçlarından kopyalanan metni okur.
 * Siteye istek atılmaz; kullanıcının kendi tarayıcısından kopyaladığı metin işlenir.
 * Hasarlı, başka model ya da başka hafızalı ilanlar ayıklanır.
 */
import type { CatalogModel } from "@/lib/types";
import { filterOutliers } from "@/lib/pricing/stats";
import { createMatcher, tokenize } from "./normalize";

export interface ListingRow {
  price: number;
  title: string;
}

export interface ListingPasteResult {
  kept: ListingRow[];
  skipped: { damaged: number; otherStorage: number; otherModel: number; outlier: number };
}

// "26.000 TL", "26.000 ₺", "₺26.000", "26000 TL"
const PRICE = /(?:₺\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,7})(?:,\d{1,2})?\s*(?:TL|₺)?/g;

/** Değeri düşüren ya da parça/kilitli cihaz ilanları */
const DAMAGED = [
  "hasarl", "kırık", "kirik", "çatlak", "catlak", "arızal", "arizal", "bozuk", "parça", "parca", "icloud",
  "kilitli", "sorunlu", "çalışmıyor", "calismiyor", "yanık", "yanik", "değişen", "degisen", "orjinal değil",
  "anakart", "sadece kutu", "kutusu", "kapak", "kılıf", "kilif", "ekran koruyucu",
];

function extractPrice(line: string): number | null {
  // Tarih ve adet gibi sayılar karışmasın: TL/₺ işareti ya da binlik nokta olan sayı aranır
  const candidates = [...line.matchAll(PRICE)].filter((m) => /TL|₺/.test(m[0]) || m[1].includes("."));
  if (!candidates.length) return null;
  const n = Number(candidates[candidates.length - 1][1].replace(/\./g, ""));
  return Number.isFinite(n) && n >= 1000 ? n : null;
}

function storagesIn(title: string): number[] {
  const out: number[] = [];
  for (const t of tokenize(title)) {
    const m = /^(?:\d{1,2}\/)?(\d{2,4})(gb)?$/.exec(t) ?? /^(\d)tb$/.exec(t);
    if (!m) continue;
    const v = t.endsWith("tb") ? Number(m[1]) * 1024 : Number(m[1]);
    if ([32, 64, 128, 256, 512, 1024].includes(v)) out.push(v);
  }
  return out;
}

export function parseListingPaste(
  text: string,
  target: { model: CatalogModel; storageGb: number },
  catalog: CatalogModel[],
): ListingPasteResult {
  const match = createMatcher(catalog);
  const skipped = { damaged: 0, otherStorage: 0, otherModel: 0, outlier: 0 };
  const rows: ListingRow[] = [];
  let lastTitle = "";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const price = extractPrice(line);
    if (price === null) {
      // Fiyatsız ama anlamlı uzunluktaki satır bir sonraki fiyatın başlığı olabilir
      if (line.length >= 8 && !/^\d{1,2}\s+\p{L}+\s+\d{4}$/u.test(line)) lastTitle = line;
      continue;
    }
    // Başlık aynı satırdaysa (fiyattan önceki kısım) onu kullan
    const inline = line.replace(PRICE, " ").replace(/\s+/g, " ").trim();
    const title = inline.length >= 8 ? inline : lastTitle;
    lastTitle = "";
    if (!title) continue;

    const lower = title.toLocaleLowerCase("tr");
    if (DAMAGED.some((w) => lower.includes(w))) {
      skipped.damaged++;
      continue;
    }
    const found = match(tokenize(title), target.model.brandId);
    if (found && found.model.id !== target.model.id) {
      skipped.otherModel++;
      continue;
    }
    const storages = storagesIn(title);
    if (storages.length && !storages.includes(target.storageGb)) {
      skipped.otherStorage++;
      continue;
    }
    rows.push({ price, title: title.slice(0, 120) });
  }

  const kept = filterOutliers(rows, (r) => r.price);
  skipped.outlier = rows.length - kept.length;
  return { kept, skipped };
}
