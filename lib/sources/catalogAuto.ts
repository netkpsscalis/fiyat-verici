/**
 * Mağazalarda görülen telefonları kataloğa otomatik ekler: marka adı ürün adından bulunur,
 * aksesuarlar ayıklanır. Böylece katalog yeni çıkan modellerle kendi kendine büyür.
 */
import { suggestModelName } from "./unmatched";

export const BRAND_ALIASES: Record<string, string[]> = {
  apple: ["apple", "iphone"],
  samsung: ["samsung", "galaxy"],
  xiaomi: ["xiaomi", "redmi", "poco"],
  oppo: ["oppo"],
  realme: ["realme"],
  honor: ["honor"],
  huawei: ["huawei"],
  vivo: ["vivo"],
  tecno: ["tecno"],
  infinix: ["infinix"],
  "general-mobile": ["general mobile", "gm "],
  casper: ["casper"],
  reeder: ["reeder"],
  omix: ["omix"],
  nothing: ["nothing phone", "nothing"],
  tcl: ["tcl"],
  zte: ["zte"],
  alcatel: ["alcatel"],
  motorola: ["motorola", "moto g", "moto e"],
  oneplus: ["oneplus", "one plus"],
  google: ["google pixel", "pixel"],
  nokia: ["nokia"],
  sony: ["sony xperia", "xperia"],
  asus: ["asus rog phone", "zenfone"],
};

export const BRAND_NAMES: Record<string, string> = {
  apple: "Apple",
  samsung: "Samsung",
  xiaomi: "Xiaomi",
  oppo: "Oppo",
  realme: "realme",
  honor: "Honor",
  huawei: "Huawei",
  vivo: "vivo",
  tecno: "TECNO",
  infinix: "Infinix",
  "general-mobile": "General Mobile",
  casper: "Casper",
  reeder: "Reeder",
  omix: "Omix",
  nothing: "Nothing",
  tcl: "TCL",
  zte: "ZTE",
  alcatel: "Alcatel",
  motorola: "Motorola",
  oneplus: "OnePlus",
  google: "Google",
  nokia: "Nokia",
  sony: "Sony",
  asus: "Asus",
};

/** Telefon olmayan ürünler kataloğa girmesin */
const NOT_A_PHONE = [
  "kılıf", "kilif", "kablo", "kulaklık", "kulaklik", "şarj", "sarj", "adaptör", "adaptor", "powerbank", "power bank",
  "ekran koruyucu", "cam koruyucu", "saat", "watch", "buds", "band", "tablet", "tab ", "kamera", "hoparlör", "hoparlor",
  "aksesuar", "stand", "tutucu", "çanta", "canta", "klavye", "mouse", "monitör", "monitor", "laptop", "notebook",
  "televizyon", " tv ", "airpods", "airtag", "pencil", "dock", "sim kart", "modem", "router",
];

export function detectBrand(name: string): string | null {
  const n = ` ${name.toLocaleLowerCase("tr")} `;
  for (const [brandId, aliases] of Object.entries(BRAND_ALIASES)) {
    if (aliases.some((a) => n.includes(` ${a}`) || n.includes(`${a} `))) return brandId;
  }
  return null;
}

export function isPhoneName(name: string): boolean {
  const n = ` ${name.toLocaleLowerCase("tr")} `;
  return !NOT_A_PHONE.some((w) => n.includes(w));
}

export interface CatalogCandidate {
  brandId: string;
  name: string;
  ramGb: number | null;
  storageGb: number;
}

/**
 * Ürün adından kataloğa eklenebilir bir model çıkarır. Emin olunamayan durumlarda null döner;
 * o ürünler "katalogda olmayan telefonlar" listesine düşer ve elle eklenir.
 */
export function catalogCandidate(
  product: { name: string; ramGb: number | null; storageGb: number | null; brandId?: string | null },
): CatalogCandidate | null {
  if (!product.storageGb || !isPhoneName(product.name)) return null;
  const brandId = product.brandId ?? detectBrand(product.name);
  if (!brandId || !BRAND_NAMES[brandId]) return null;
  const name = suggestModelName(product.name, brandId);
  const words = name.split(/\s+/).filter(Boolean);
  // "Galaxy A27" gibi 1-5 kelimelik adlar kabul edilir; tek kelimelik ya da çok uzun adlar şüphelidir
  if (words.length < 2 || words.length > 5 || name.length > 40) return null;
  return { brandId, name, ramGb: product.ramGb, storageGb: product.storageGb };
}
