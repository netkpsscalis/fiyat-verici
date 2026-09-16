export interface Weighted {
  value: number;
  weight: number;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Ağırlıklı medyan. Her değer kendi ağırlık diliminin ortasına yerleştirilir ve %50 noktası
 * komşu iki değer arasında doğrusal ara değerle bulunur. Böylece eşit ağırlıklı iki fiyatın
 * ortası alınır; neredeyse eşit ağırlıklarda biri keyfi olarak seçilmez.
 */
export function weightedMedian(items: Weighted[]): number | null {
  const s = items.filter((i) => i.weight > 0).sort((a, b) => a.value - b.value);
  if (s.length === 0) return null;
  const total = s.reduce((sum, i) => sum + i.weight, 0);
  let acc = 0;
  const points = s.map((i) => {
    const p = (acc + i.weight / 2) / total;
    acc += i.weight;
    return { p, v: i.value };
  });
  if (points[0].p >= 0.5) return points[0].v;
  for (let k = 1; k < points.length; k++) {
    if (points[k].p >= 0.5) {
      const a = points[k - 1];
      const b = points[k];
      return a.v + ((0.5 - a.p) / (b.p - a.p)) * (b.v - a.v);
    }
  }
  return points[points.length - 1].v;
}

/**
 * Çeyrekler arası açıklığın 1.5 katı dışında kalan uç değerleri atar.
 * 4'ten az gözlemde bir şey atılmaz (atmak için yeterli veri yok).
 */
export function filterOutliers<T>(items: T[], value: (t: T) => number): T[] {
  if (items.length < 4) return items;
  const vals = items.map(value);
  const q1 = quantile(vals, 0.25)!;
  const q3 = quantile(vals, 0.75)!;
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return items.filter((t) => value(t) >= lo && value(t) <= hi);
}

/** Eski veri daha az sayılır: her `halfLifeDays` günde ağırlık yarıya iner. */
export function freshnessWeight(ageDays: number, halfLifeDays = 10): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
}

/** Fiyat büyüklüğüne göre yuvarlama adımı: 5.000 altı 50, 20.000 altı 100, üstü 250 TL. */
export function priceStep(v: number): number {
  if (v < 5_000) return 50;
  if (v < 20_000) return 100;
  return 250;
}

export function roundPrice(v: number, how: "down" | "up" | "nearest" = "nearest"): number {
  const step = priceStep(Math.abs(v));
  const fn = how === "down" ? Math.floor : how === "up" ? Math.ceil : Math.round;
  return fn(v / step) * step;
}

export const DAY_MS = 86_400_000;

export function ageInDays(date: Date | number, now: Date | number): number {
  return (Number(now) - Number(date)) / DAY_MS;
}
