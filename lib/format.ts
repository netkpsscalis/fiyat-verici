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
  buyback: "Rakip alış teklifi",
  refurb_retail: "Yenilenmiş satış",
  used_listing: "2. el ilan",
  own_buy: "Benim alışım",
  own_sell: "Benim satışım",
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Elle",
  easycep: "Easycep",
  getmobil: "Getmobil",
  sahibinden: "Sahibinden",
  letgo: "Letgo",
  dolap: "Dolap",
  facebook: "Facebook",
  diger: "Diğer ilan",
  own: "Dükkan",
};

export function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  // "merkez-gsm" -> "Merkez Gsm"
  return source
    .split(/[-_]/)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

