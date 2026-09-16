import type { ObservationKind } from "@/lib/db/schema";

/** Bir kaynağın fiyatının dükkan 2. el satış fiyatına çevrilmesi ve hesapta ne kadar ağır bastığı */
export interface SourceAdjust {
  /** Kaynağın fiyatı × bu oran = dükkanda satabileceğin fiyat */
  factor: number;
  /** Ortanca alınırken ağırlığı */
  weight: number;
}

/** Kendi satışlarına bakarak bulunan yerel piyasa düzeltmesi */
export interface Calibration {
  factor: number;
  samples: number;
  updatedAt: number | null;
}

/** Fiyat motorunun ayarları. Varsayılanlar burada; kullanıcı Ayarlar sayfasından değiştirir. */
export interface PricingSettings {
  /** Alış teklifinde tahmini satış değerinden düşülen kâr payı (%) */
  buyMargins: { max: number; mid: number; min: number };
  /** Bir cihazdan beklenen en az kâr (TL). "En çok" teklif bunun altına inmez. */
  minProfit: number;
  /** 2. el kaynakların dükkan fiyatına çevrilmesi */
  sourceAdjust: Record<"own_sell" | "used_listing" | "refurb_retail", SourceAdjust>;
  /** Kendi satışlarından öğrenilen düzeltme (otomatik hesaplanır) */
  calibration: Calibration;
  /** Rakip geri alım teklifinden satış değerine geçiş oranı (geri alım ≈ satış × bu oran) */
  buybackRatio: number;
  /** Gözlemlere bakılan süre (gün). Bu sürede veri yoksa 90 güne kadar genişletilir. */
  windowDays: number;
  /** Bu kadar günden yeni veri "taze" sayılır */
  freshDays: number;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  // İlan 26.000 → en çok 23.400, önerilen 22.600, en az 21.600: satarken kazan, müşteriyi kaçırma
  buyMargins: { max: 10, mid: 13, min: 17 },
  minProfit: 750,
  sourceAdjust: {
    // Kendi satışın gerçeğin ta kendisi
    own_sell: { factor: 1, weight: 2 },
    // Dükkan, Sahibinden/Dolap/Letgo'daki ilan fiyatına satar: ilan fiyatı = dükkan satış fiyatı
    used_listing: { factor: 1, weight: 1.5 },
    // Yenilenmiş + 12 ay garantili perakende fiyat, dükkandaki 2. el fiyatının üstündedir
    refurb_retail: { factor: 0.82, weight: 0.6 },
  },
  calibration: { factor: 1, samples: 0, updatedAt: null },
  buybackRatio: 0.78,
  windowDays: 30,
  freshDays: 7,
};

export const MARKET_KINDS: ObservationKind[] = ["own_sell", "used_listing", "refurb_retail"];

type StoredSettings = Partial<PricingSettings> & {
  /** Eski sürüm: ilan pazarlık payı (%) */
  listingDiscount?: number;
  /** Eski sürüm: yenilenmiş fiyat oranı */
  refurbFactor?: number;
};

export function mergeSettings(stored: StoredSettings | null | undefined): PricingSettings {
  if (!stored) return DEFAULT_SETTINGS;
  const sourceAdjust = { ...DEFAULT_SETTINGS.sourceAdjust, ...stored.sourceAdjust };
  // Eski ayarlar yeni alanlara taşınır
  if (!stored.sourceAdjust && typeof stored.listingDiscount === "number") {
    sourceAdjust.used_listing = { ...sourceAdjust.used_listing, factor: 1 - stored.listingDiscount / 100 };
  }
  if (!stored.sourceAdjust && typeof stored.refurbFactor === "number") {
    sourceAdjust.refurb_retail = { ...sourceAdjust.refurb_retail, factor: stored.refurbFactor };
  }
  // Eski sürümden kalan sıfır satış alanları taşınmaz
  const { newSale: _n, depreciation: _d, listingDiscount: _l, refurbFactor: _r, ...rest } = stored as StoredSettings & {
    newSale?: unknown;
    depreciation?: unknown;
  };
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    buyMargins: { ...DEFAULT_SETTINGS.buyMargins, ...stored.buyMargins },
    calibration: { ...DEFAULT_SETTINGS.calibration, ...stored.calibration },
    sourceAdjust,
  };
}
