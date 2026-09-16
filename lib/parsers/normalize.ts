/**
 * Model adı eşleştirme: toptancı listelerindeki "İP 15 PM", "S24U", "RN13 PRO" gibi yazımları
 * katalogdaki modele bağlar.
 */
import type { CatalogModel } from "@/lib/types";

/** Küçük harf + Türkçe karakterleri sadeleştir. */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/̇/g, "");
}

/** Satırı karşılaştırılabilir parçalara ayırır. Fiyat (45.500), RAM/depolama (8/256) korunur. */
export function tokenize(s: string): string[] {
  return fold(s)
    .replace(/(\d)\s*(tl|try|₺)\b/g, "$1 ")
    .replace(/₺/g, " ")
    // "8+256" ve "8+256GB" → "8/256". Sayı bağımsız başlamalı: "S24+ 8" birleşmesin
    .replace(/\b(\d{1,2})\s*\+\s*(\d{2,4})\s*gb\b/g, "$1/$2")
    .replace(/\b(\d{1,2})\s*\+\s*(\d{2,4})\b/g, "$1/$2")
    .replace(/(\d)\s*gb\s*\/\s*(\d)/g, "$1/$2")
    .replace(/(\d)\s+(gb|tb)\b/g, "$1$2")
    // "8/256gb" → "8/256": RAM/depolama çiftinde birim gereksiz
    .replace(/\b(\d{1,2}\/\d{2,4})gb\b/g, "$1")
    .replace(/\+/g, " plus ")
    .replace(/pro\s*max/g, "pro max")
    .replace(/[^a-z0-9/.,]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^[.,/]+|[.,/]+$/g, ""))
    .filter(Boolean);
}

export interface Alias {
  modelId: string;
  brandId: string;
  tokens: string[];
  /** "15 pro" gibi sadece rakamla başlayan yazımlar; ancak marka bağlamı varken geçerli */
  contextOnly: boolean;
  learned?: boolean;
}

const BRAND_WORDS = new Set(["iphone", "apple", "galaxy", "samsung", "xiaomi"]);

function variantsOf(tokens: string[]): string[][] {
  const out = [tokens];
  const i = tokens.findIndex((t, k) => t === "pro" && tokens[k + 1] === "max");
  if (i >= 0) {
    out.push([...tokens.slice(0, i), "pm", ...tokens.slice(i + 2)]);
    out.push([...tokens.slice(0, i), "promax", ...tokens.slice(i + 2)]);
  }
  return out;
}

export function aliasesFor(m: CatalogModel): Alias[] {
  const base = tokenize(m.name);
  const core = base.filter((t) => !BRAND_WORDS.has(t));
  const sets: { tokens: string[]; contextOnly: boolean }[] = [];
  const add = (tokens: string[], contextOnly = false) => {
    for (const t of variantsOf(tokens)) sets.push({ tokens: t, contextOnly });
  };

  add(base);
  if (core.length && core.join(" ") !== base.join(" ")) add(core, /^\d+$/.test(core[0]));

  if (m.brandId === "apple" && core.length) {
    add(["ip", ...core]);
    add([`ip${core[0]}`, ...core.slice(1)]);
    add([`iphone${core[0]}`, ...core.slice(1)]);
    if (core[0] === "se") add(["se", core[1] === "2020" ? "2" : "3"], true);
  }

  if (m.brandId === "samsung") {
    // S24 Ultra → S24U
    if (core.length === 2 && core[1] === "ultra") add([`${core[0]}u`]);
    // Z Flip6 → flip6, flip 6, zflip6
    const z = core.findIndex((t) => /^(flip|fold)\d$/.test(t));
    if (z >= 0) {
      const word = core[z].slice(0, -1);
      const num = core[z].slice(-1);
      add([core[z]]);
      add([word, num]);
      add(["z", word, num]);
      add([`z${core[z]}`]);
    }
  }

  if (m.brandId === "xiaomi" && core[0] === "redmi" && core[1] === "note") {
    add(core.slice(1));
    add([`rn${core[2]}`, ...core.slice(3)]);
    add(["redmi", `note${core[2]}`, ...core.slice(3)]);
  }

  const seen = new Set<string>();
  return sets
    .filter((s) => {
      const key = s.tokens.join(" ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({ modelId: m.id, brandId: m.brandId, ...s }));
}

export interface ModelMatch {
  model: CatalogModel;
  /** Satırda modelin geçtiği parça aralığı [start, end) */
  start: number;
  end: number;
}

/** Katalog için eşleştirici kurar. Öğrenilmiş takma adlar (ör. "15pm") önceliklidir. */
export function createMatcher(models: CatalogModel[], learned: { alias: string; modelId: string }[] = []) {
  const byId = new Map(models.map((m) => [m.id, m]));
  const aliases: Alias[] = models.flatMap(aliasesFor);
  for (const l of learned) {
    const m = byId.get(l.modelId);
    if (m) aliases.push({ modelId: m.id, brandId: m.brandId, tokens: tokenize(l.alias), contextOnly: false, learned: true });
  }

  return function match(tokens: string[], brandContext: string | null): ModelMatch | null {
    let best: (ModelMatch & { len: number; learned: boolean }) | null = null;
    for (const a of aliases) {
      if (a.contextOnly && a.brandId !== brandContext) continue;
      const len = a.tokens.length;
      for (let i = 0; i + len <= tokens.length; i++) {
        let ok = true;
        for (let k = 0; k < len; k++) {
          if (tokens[i + k] !== a.tokens[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        // Uzun eşleşme kazanır ("15 pro max" > "15 pro"); eşitse öğrenilmiş ad, sonra soldaki
        const better =
          !best ||
          len > best.len ||
          (len === best.len && a.learned && !best.learned) ||
          (len === best.len && a.learned === best.learned && i < best.start);
        if (better) best = { model: byId.get(a.modelId)!, start: i, end: i + len, len, learned: !!a.learned };
      }
    }
    return best ? { model: best.model, start: best.start, end: best.end } : null;
  };
}

const HEADER_BRANDS: Record<string, string> = {
  apple: "apple",
  iphone: "apple",
  ip: "apple",
  samsung: "samsung",
  galaxy: "samsung",
  xiaomi: "xiaomi",
  redmi: "xiaomi",
  poco: "xiaomi",
  mi: "xiaomi",
};

/** Satırdaki marka kelimesinden bağlam çıkarır ("📱 APPLE 📱" başlıkları, "iPhone 15" satırları) */
export function brandOf(tokens: string[]): string | null {
  for (const t of tokens) if (HEADER_BRANDS[t]) return HEADER_BRANDS[t];
  return null;
}
