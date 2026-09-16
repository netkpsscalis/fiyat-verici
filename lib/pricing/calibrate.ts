/**
 * Yerel piyasa düzeltmesi: uygulamanın tahmin ettiği satış değeri ile dükkanın gerçek satış
 * fiyatlarını karşılaştırır. Tahmin sürekli yüksek çıkıyorsa katsayı 1'in altına iner.
 */
import { filterOutliers, median } from "./stats";

export interface CalibrationSample {
  /** Dükkanın gerçekten sattığı fiyat */
  actual: number;
  /** Uygulamanın o tarihte tahmin ettiği satış değeri */
  predicted: number;
}

export const MIN_SAMPLES = 3;
const LIMIT = { min: 0.7, max: 1.3 };

export function computeCalibrationFactor(samples: CalibrationSample[]): { factor: number; samples: number } {
  const ratios = samples.filter((s) => s.actual > 0 && s.predicted > 0).map((s) => s.actual / s.predicted);
  if (ratios.length < MIN_SAMPLES) return { factor: 1, samples: ratios.length };
  const kept = filterOutliers(ratios, (r) => r);
  const m = median(kept) ?? 1;
  return { factor: Math.min(LIMIT.max, Math.max(LIMIT.min, Math.round(m * 1000) / 1000)), samples: kept.length };
}
