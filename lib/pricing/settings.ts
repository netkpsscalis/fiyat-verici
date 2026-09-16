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

/** Marka grupları: Android cihazlar 2. elde daha hızlı değer kaybeder ve ilan fiyatına satılamaz */
export const BRAND_GROUPS = ["apple", "samsung", "xiaomi", "diger"] as const;
export type BrandGroup = (typeof BRAND_GROUPS)[number];

export const BRAND_GROUP_LABELS: Record<BrandGroup, string> = {
  apple: "Apple (iPhone)",
  samsung: "Samsung",
  xiaomi: "Xiaomi / Redmi / POCO",
  diger: "Diğer Android",
};

export function brandGroupOf(brandId: string): BrandGroup {
  return brandId === "apple" || brandId === "samsung" || brandId === "xiaomi" ? brandId : "diger";
}

export interface GroupPricing {
  /** Alış teklifinde tahmini satış değerinden düşülen kâr payı (%) */
  margins: { max: number; mid: number; min: number };
  /** Bir cihazdan beklenen en az kâr (TL). "En çok" teklif bunun altına inmez. */
  minProfit: number;
  /** İlan ve yenilenmiş fiyatının ne kadarına gerçekten satılır (1 = ilan fiyatına) */
  saleFactor: number;
}

/** Fiyat motorunun ayarları. Varsayılanlar burada; kullanıcı Ayarlar sayfasından değiştirir. */
export interface PricingSettings {
  /** Marka grubuna göre kâr payları ve satış oranı */
  groups: Record<BrandGroup, GroupPricing>;
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
  // 26.000'lik ilan için teklifler (en az / ortalama / en çok):
  // iPhone 21.500 / 22.500 / 23.250 · Samsung 19.000 / 20.250 / 21.250 · Xiaomi 17.300 / 18.400 / 19.600
  // Android ikinci elde iPhone'dan hızlı değer kaybeder, ilan fiyatından pazarlıkla satılır, rafta daha uzun bekler.
  groups: {
    apple: { margins: { max: 10, mid: 13, min: 17 }, minProfit: 750, saleFactor: 1 },
    samsung: { margins: { max: 13, mid: 17, min: 22 }, minProfit: 1000, saleFactor: 0.94 },
    xiaomi: { margins: { max: 16, mid: 21, min: 26 }, minProfit: 1000, saleFactor: 0.9 },
    diger: { margins: { max: 18, mid: 23, min: 30 }, minProfit: 1000, saleFactor: 0.88 },
  },
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

type StoredSettings = Partial<Omit<PricingSettings, "groups">> & {
  groups?: Partial<Record<BrandGroup, Partial<GroupPricing>>>;
  /** Eski sürüm: tek kâr payı (iPhone grubuna taşınır) */
  buyMargins?: GroupPricing["margins"];
  minProfit?: number;
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
  const groups = Object.fromEntries(
    BRAND_GROUPS.map((g) => {
      const def = DEFAULT_SETTINGS.groups[g];
      const legacy = g === "apple" ? { margins: stored.buyMargins, minProfit: stored.minProfit } : {};
      const cur = stored.groups?.[g] ?? {};
      return [
        g,
        {
          margins: { ...def.margins, ...legacy.margins, ...cur.margins },
          minProfit: cur.minProfit ?? legacy.minProfit ?? def.minProfit,
          saleFactor: cur.saleFactor ?? def.saleFactor,
        },
      ];
    }),
  ) as Record<BrandGroup, GroupPricing>;
  const {
    newSale: _n,
    depreciation: _d,
    listingDiscount: _l,
    refurbFactor: _r,
    buyMargins: _b,
    minProfit: _m,
    groups: _g,
    ...rest
  } = stored as StoredSettings & {
    newSale?: unknown;
    depreciation?: unknown;
  };
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    groups,
    calibration: { ...DEFAULT_SETTINGS.calibration, ...stored.calibration },
    sourceAdjust,
  };
}
