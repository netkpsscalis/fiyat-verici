/**
 * Fiyat motoru. Veritabanına dokunmaz; gözlemleri ve seçimleri alır, fiyatları hesaplar.
 * Hem sunucuda hem tarayıcıda (canlı fiyat etiketi için) çalışır.
 */
import type { ObservationKind, WarrantyType } from "@/lib/db/schema";
import {
  adjustmentFor,
  factorLabel,
  factorsFor,
  type Family,
  type Overrides,
  type Selection,
} from "./conditions";
import { MARKET_KINDS, type PricingSettings } from "./settings";
import { ageInDays, filterOutliers, freshnessWeight, median, roundPrice, weightedMedian } from "./stats";

export interface Observation {
  kind: ObservationKind;
  source: string;
  price: number;
  observedAt: Date | number;
  warranty?: WarrantyType | null;
  condition?: string | null;
  url?: string | null;
  /** Kaç ilanın ortası (toplu kaynaklar). Yoksa 1. */
  sampleSize?: number | null;
}

/** Toplu bir kayıt en fazla bu kadar tekil gözlem yerine geçer: tek kaynak tek başına "yüksek güven" veremez */
const MAX_SAMPLE_WEIGHT = 3;
const sampleWeight = (o: Observation) => Math.min(Math.max(o.sampleSize ?? 1, 1), MAX_SAMPLE_WEIGHT);
const sampleTotal = (list: Observation[]) => list.reduce((n, o) => n + Math.max(o.sampleSize ?? 1, 1), 0);

export interface UsedObservation extends Observation {
  /** Pazarlık payı vb. düzeltmelerden sonra hesaba giren değer */
  adjusted: number;
  ageDays: number;
}

export type Confidence = "yuksek" | "orta" | "dusuk" | "yok";

export interface Reference {
  /** Kusursuz durumdaki cihazın dükkanda satılabileceği tahmini fiyat */
  value: number | null;
  method: "market" | "buyback" | "none";
  used: UsedObservation[];
  /** Hesaba giren toplam ilan/fiyat sayısı (toplu kayıtlar açılmış haliyle) */
  sampleCount: number;
  /** Kendi satışlarına göre uygulanan düzeltme (1 = düzeltme yok) */
  calibration: number;
  newestAgeDays: number | null;
  confidence: Confidence;
}

function inWindow(obs: Observation[], now: number, days: number) {
  return obs.filter((o) => ageInDays(o.observedAt, now) <= days);
}

/** Pencere içinde veri yoksa 90 güne kadar geriye bakar. */
function recent(obs: Observation[], now: number, windowDays: number) {
  const inWin = inWindow(obs, now, windowDays);
  return inWin.length > 0 ? inWin : inWindow(obs, now, 90);
}

/** Kaynağın fiyatını dükkandaki 2. el satış fiyatına çevirir (ilan pazarlık payı, yenilenmiş farkı...) */
function adjustForKind(o: Observation, s: PricingSettings): number {
  const adjust = s.sourceAdjust[o.kind as keyof PricingSettings["sourceAdjust"]];
  return o.price * (adjust?.factor ?? 1);
}

function kindWeight(o: Observation, s: PricingSettings): number {
  return s.sourceAdjust[o.kind as keyof PricingSettings["sourceAdjust"]]?.weight ?? 1;
}

function toUsed(o: Observation, adjusted: number, now: number): UsedObservation {
  return { ...o, adjusted, ageDays: ageInDays(o.observedAt, now) };
}

export function computeReference(
  observations: Observation[],
  opts: { now: Date | number; settings: PricingSettings; releaseYear: number },
): Reference {
  const now = Number(opts.now);
  const s = opts.settings;

  // 1) 2. el piyasa: kendi satışların, ilanlar, yenilenmiş satış fiyatları
  const calibration = s.calibration.samples >= 3 ? s.calibration.factor : 1;
  const allMarket = recent(
    observations.filter((o) => (MARKET_KINDS as string[]).includes(o.kind)),
    now,
    s.windowDays,
  );
  // Yerel ilan ya da kendi satışın varsa gerçek sokak fiyatı odur: garantili yenilenmiş fiyatı sadece yedek kalır
  const local = allMarket.filter((o) => o.kind !== "refurb_retail");
  const market = local.length > 0 ? local : allMarket;
  if (market.length > 0) {
    const used = filterOutliers(
      market.map((o) => toUsed(o, adjustForKind(o, s), now)),
      (u) => u.adjusted,
    );
    const raw = weightedMedian(
      used.map((u) => ({ value: u.adjusted, weight: kindWeight(u, s) * freshnessWeight(u.ageDays) * sampleWeight(u) })),
    );
    const value = raw === null ? null : raw * calibration;
    const newest = Math.min(...used.map((u) => u.ageDays));
    const effective = used.reduce((n, u) => n + sampleWeight(u), 0);
    let confidence: Confidence = effective >= 5 ? "yuksek" : effective >= 2 ? "orta" : "dusuk";
    if (newest > s.freshDays * 2) confidence = "dusuk";
    else if (newest > s.freshDays && confidence === "yuksek") confidence = "orta";
    return { value, method: "market", used, sampleCount: sampleTotal(used), calibration, newestAgeDays: newest, confidence };
  }

  // 2) Sadece rakip geri alım teklifleri varsa: geri alım fiyatından satış değerine geri git
  const buyback = recent(
    observations.filter((o) => o.kind === "buyback"),
    now,
    s.windowDays,
  );
  if (buyback.length > 0) {
    const used = buyback.map((o) => toUsed(o, o.price / s.buybackRatio, now));
    const value = median(used.map((u) => u.adjusted));
    return {
      value,
      method: "buyback",
      calibration: 1,
      used,
      sampleCount: sampleTotal(used),
      newestAgeDays: Math.min(...used.map((u) => u.ageDays)),
      confidence: "dusuk",
    };
  }

  return { value: null, method: "none", used: [], sampleCount: 0, calibration: 1, newestAgeDays: null, confidence: "yok" };
}

export interface AppliedAdjustment {
  factorId: string;
  factorLabel: string;
  optionLabel: string;
  mode: "pct" | "fixed";
  value: number;
}

export interface Adjustments {
  /** Yüzde kesintilerin çarpımı (1 = kesinti yok) */
  multiplier: number;
  /** Sabit TL kesintilerin toplamı */
  fixedTotal: number;
  applied: AppliedAdjustment[];
  /** Cihazın alınmasını engelleyen durumlar */
  blocked: string[];
  /** Cevaplanmamış sorular */
  missing: string[];
}

export function computeAdjustments(family: Family, selection: Selection, overrides: Overrides = {}): Adjustments {
  const out: Adjustments = { multiplier: 1, fixedTotal: 0, applied: [], blocked: [], missing: [] };
  for (const f of factorsFor(family)) {
    const raw = selection[f.id];
    const chosen = f.multi ? (Array.isArray(raw) ? raw : []) : typeof raw === "string" ? [raw] : [];
    if (!f.multi && chosen.length === 0) {
      out.missing.push(factorLabel(f, family));
      continue;
    }
    for (const optId of chosen) {
      const opt = f.options.find((o) => o.id === optId);
      if (!opt) continue;
      if (opt.blocking) out.blocked.push(opt.label);
      const adj = adjustmentFor(f.id, opt, overrides);
      if (adj.value === 0) continue;
      if (adj.mode === "pct") out.multiplier *= 1 - adj.value / 100;
      else out.fixedTotal += adj.value;
      out.applied.push({
        factorId: f.id,
        factorLabel: factorLabel(f, family),
        optionLabel: opt.label,
        mode: adj.mode,
        value: adj.value,
      });
    }
  }
  return out;
}

export interface PriceTriple {
  min: number;
  mid: number;
  max: number;
}

export interface BuyQuote {
  reference: Reference;
  adjustments: Adjustments;
  /** Bu durumdaki cihazın tahmini satış değeri */
  resale: number | null;
  offers: PriceTriple | null;
  competitor: { median: number; adjusted: number; count: number; sources: string[] } | null;
  warnings: string[];
}

export function computeBuyQuote(input: {
  observations: Observation[];
  family: Family;
  releaseYear: number;
  selection: Selection;
  settings: PricingSettings;
  overrides?: Overrides;
  now?: Date | number;
}): BuyQuote {
  const now = Number(input.now ?? Date.now());
  const s = input.settings;
  const reference = computeReference(input.observations, { now, settings: s, releaseYear: input.releaseYear });
  const adjustments = computeAdjustments(input.family, input.selection, input.overrides);
  const warnings: string[] = [];

  const buybacks = recent(
    input.observations.filter((o) => o.kind === "buyback"),
    now,
    s.windowDays,
  );
  const bbMedian = median(buybacks.map((o) => o.price));
  const competitor =
    bbMedian === null
      ? null
      : {
          median: bbMedian,
          adjusted: Math.max(0, bbMedian * adjustments.multiplier - adjustments.fixedTotal),
          count: buybacks.length,
          sources: [...new Set(buybacks.map((o) => o.source))],
        };

  if (adjustments.missing.length) warnings.push(`Cevaplanmadı: ${adjustments.missing.join(", ")}`);
  if (reference.confidence === "dusuk") warnings.push("Piyasa verisi az veya eski. Fiyatı dikkatli kullan.");
  if (reference.method === "buyback") warnings.push("2. el satış verisi yok; rakip geri alım tekliflerinden tahmin edildi.");

  if (adjustments.blocked.length) {
    return { reference, adjustments, resale: null, offers: null, competitor, warnings: [`ALINMAZ: ${adjustments.blocked.join(", ")}`, ...warnings] };
  }
  if (reference.value === null) {
    return { reference, adjustments, resale: null, offers: null, competitor, warnings: ["Bu model için hiç fiyat verisi yok. İlan fiyatlarını yapıştırarak ekle.", ...warnings] };
  }

  const resale = Math.max(0, reference.value * adjustments.multiplier - adjustments.fixedTotal);
  const m = s.buyMargins;
  const max = Math.max(0, Math.min(resale * (1 - m.max / 100), resale - s.minProfit));
  const min = Math.min(max, resale * (1 - m.min / 100));
  let mid = resale * (1 - m.mid / 100);
  if (competitor) mid = (mid + competitor.adjusted) / 2;
  mid = Math.min(max, Math.max(min, mid));

  if (resale - max < s.minProfit) warnings.push("Kâr payı en az kâr tutarının altında kalıyor.");

  return {
    reference,
    adjustments,
    resale: roundPrice(resale),
    offers: { min: roundPrice(min, "down"), mid: roundPrice(mid, "down"), max: roundPrice(max, "down") },
    competitor,
    warnings,
  };
}
