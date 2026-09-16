const tl = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function formatTL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${tl.format(v)} ₺`;
}

export function formatNumber(v: number): string {
  return tl.format(v);
}

/** "36.500", "36 500 ₺", "36500,50" gibi yazımları sayıya çevirir. */
export function parsePrice(s: string): number | null {
  const clean = s
    .replace(/\s|₺|tl/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 ? n : null;
}

export function adjustmentText(adj: { mode: "pct" | "fixed"; value: number }): string | undefined {
  if (adj.value === 0) return undefined;
  if (adj.mode === "fixed") return `${adj.value > 0 ? "−" : "+"}${formatTL(Math.abs(adj.value))}`;
  return `${adj.value > 0 ? "−" : "+"}%${Math.abs(adj.value)}`;
}

export function formatAge(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days < 1 / 24) return "az önce";
  if (days < 1) return `${Math.round(days * 24)} saat önce`;
  if (days < 2) return "dün";
  if (days < 31) return `${Math.round(days)} gün önce`;
  return `${Math.round(days / 30)} ay önce`;
}

export function formatStorage(gb: number): string {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

export function variantLabel(v: { ramGb: number | null; storageGb: number }): string {
  return v.ramGb ? `${v.ramGb} GB RAM · ${formatStorage(v.storageGb)}` : formatStorage(v.storageGb);
}

export const KIND_LABELS: Record<string, string> = {
  new_retail: "Sıfır perakende",
  new_wholesale: "Toptancı",
  buyback: "Rakip alış teklifi",
  refurb_retail: "Yenilenmiş satış",
  used_listing: "2. el ilan",
  own_buy: "Benim alışım",
  own_sell: "Benim satışım",
};

/** Epey'den gelen mağaza adları */
export const SELLER_NAMES: Record<string, string> = {
  "hepsiburada.com": "Hepsiburada",
  "trendyol.com": "Trendyol",
  "mediamarkt.com.tr": "Media Markt",
  "vatanbilgisayar.com": "Vatan",
  "pttavm.com": "PTT AVM",
  "n11.com": "n11",
  "amazon.com.tr": "Amazon",
  "teknosa.com": "Teknosa",
  "pazarama.com": "Pazarama",
  "ciceksepeti.com": "Çiçeksepeti",
  "idefix.com": "idefix",
  "apple.com": "Apple",
  "samsung.com": "Samsung",
  "mi.com": "Xiaomi",
  "turkcell.com.tr": "Turkcell",
  "vodafone.com.tr": "Vodafone",
  "arcelik.com.tr": "Arçelik",
  "beko.com.tr": "Beko",
  "avansas.com": "Avansas",
};

export function sellerLabel(host: string): string {
  const clean = host.replace(/^www\./, "");
  if (SELLER_NAMES[clean]) return SELLER_NAMES[clean];
  const name = clean.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Elle",
  akakce: "Akakçe",
  cimri: "Cimri",
  easycep: "Easycep",
  getmobil: "Getmobil",
  sahibinden: "Sahibinden",
  letgo: "Letgo",
  dolap: "Dolap",
  supplier: "Toptancı",
  own: "Dükkan",
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  n11: "n11",
  amazon: "Amazon",
  tracked: "Takip linkleri",
  vatan: "Vatan",
  turkcell: "Turkcell Pasaj",
  mediamarkt: "Media Markt",
  pttavm: "PTT AVM",
  teknosa: "Teknosa",
  apple: "Apple TR",
  samsung: "Samsung TR",
};

/** "epey:mediamarkt.com.tr" → "Media Markt" */
export function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  if (source.includes(".")) return sellerLabel(source);
  // "merkez-gsm" -> "Merkez Gsm"
  return source
    .split(/[-_]/)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

export const WARRANTY_LABELS: Record<string, string> = {
  resmi: "Resmi (TR)",
  ithalatci: "İthalatçı",
  yurtdisi: "Yurt dışı",
  yok: "Garantisiz",
};
