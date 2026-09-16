/** Fiyat motorunun ayarları. Varsayılanlar burada; kullanıcı Ayarlar sayfasından değiştirir. */
export interface PricingSettings {
  /** Alış teklifinde tahmini satış değerinden düşülen kâr payı (%) */
  buyMargins: { max: number; mid: number; min: number };
  /** Bir cihazdan beklenen en az kâr (TL). "En çok" teklif bunun altına inmez. */
  minProfit: number;
  /** İlan fiyatlarından düşülen pazarlık payı (%) */
  listingDiscount: number;
  /** Yenilenmiş cihaz satış fiyatının dükkan satış fiyatına oranı */
  refurbFactor: number;
  /** Rakip geri alım teklifinden satış değerine geçiş oranı (geri alım ≈ satış × bu oran) */
  buybackRatio: number;
  /** Sıfır fiyattan 2. el değer tahmini: çıkıştan sonraki yıl sayısına göre oran */
  depreciation: number[];
  /** Gözlemlere bakılan süre (gün). Bu sürede veri yoksa 90 güne kadar genişletilir. */
  windowDays: number;
  /** Bu kadar günden yeni veri "taze" sayılır */
  freshDays: number;
  newSale: {
    /** Sıfır satışta maliyet üstüne konan kâr (%) */
    margin: number;
    /** Sıfır satışta en az kâr (TL) */
    minProfit: number;
    /** Toptan fiyat yoksa perakende en düşük fiyatın bu oranı maliyet varsayılır */
    wholesaleFromRetail: number;
  };
}

export const DEFAULT_SETTINGS: PricingSettings = {
  buyMargins: { max: 10, mid: 17, min: 25 },
  minProfit: 750,
  listingDiscount: 7,
  refurbFactor: 0.95,
  buybackRatio: 0.78,
  depreciation: [0.82, 0.72, 0.62, 0.53, 0.45, 0.38, 0.32],
  windowDays: 30,
  freshDays: 7,
  newSale: { margin: 6, minProfit: 1000, wholesaleFromRetail: 0.93 },
};

export function mergeSettings(stored: Partial<PricingSettings> | null | undefined): PricingSettings {
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    buyMargins: { ...DEFAULT_SETTINGS.buyMargins, ...stored.buyMargins },
    newSale: { ...DEFAULT_SETTINGS.newSale, ...stored.newSale },
  };
}
