import { describe, expect, it } from "vitest";
import { defaultSelection } from "./conditions";
import { computeAdjustments, computeBuyQuote, computeReference, computeSaleQuote, type Observation } from "./engine";
import { DEFAULT_SETTINGS } from "./settings";
import { DAY_MS, filterOutliers, roundPrice, weightedMedian } from "./stats";

const NOW = new Date("2026-09-16T10:00:00Z").getTime();
const daysAgo = (d: number) => NOW - d * DAY_MS;
const obs = (kind: Observation["kind"], price: number, age = 1, source = "manual"): Observation => ({
  kind,
  price,
  source,
  observedAt: daysAgo(age),
});

describe("stats", () => {
  it("weightedMedian ağır değere yaklaşır, eşit ağırlıkta ortayı alır", () => {
    expect(weightedMedian([{ value: 10, weight: 1 }, { value: 20, weight: 1 }, { value: 30, weight: 5 }])).toBeCloseTo(26.67, 1);
    expect(weightedMedian([{ value: 10, weight: 1 }, { value: 20, weight: 1 }])).toBe(15);
    expect(weightedMedian([{ value: 7, weight: 3 }])).toBe(7);
  });

  it("neredeyse eşit ağırlıklı iki fiyatın ortasını alır", () => {
    const m = weightedMedian([{ value: 48_360, weight: 0.99995 }, { value: 50_685, weight: 0.99997 }])!;
    expect(m).toBeCloseTo(49_522.5, 0);
  });

  it("uç değerleri atar", () => {
    const vals = [100, 102, 98, 101, 99, 500];
    expect(filterOutliers(vals, (v) => v)).not.toContain(500);
  });

  it("fiyatı büyüklüğüne göre yuvarlar", () => {
    expect(roundPrice(31_120, "down")).toBe(31_000);
    expect(roundPrice(8_430, "up")).toBe(8_500);
    expect(roundPrice(3_020)).toBe(3_000);
  });
});

describe("computeReference", () => {
  const base = { now: NOW, settings: DEFAULT_SETTINGS, releaseYear: 2023 };

  it("ilan fiyatı dükkandaki satış fiyatı sayılır", () => {
    const r = computeReference([obs("used_listing", 40_000)], base);
    expect(r.method).toBe("market");
    expect(r.value).toBeCloseTo(40_000);
  });

  it("5+ taze gözlemde güven yüksek", () => {
    const r = computeReference(
      [40_000, 41_000, 39_000, 40_500, 39_500].map((p) => obs("refurb_retail", p, 2)),
      base,
    );
    expect(r.confidence).toBe("yuksek");
  });

  it("çok ilanlı tek kayıt en fazla 3 gözlem sayılır: tek kaynak yüksek güven vermez", () => {
    const r = computeReference([{ ...obs("refurb_retail", 40_000), sampleSize: 7 }], base);
    expect(r.confidence).toBe("orta");
    expect(r.sampleCount).toBe(7);
  });

  it("toplu kayıt ortancada tekil ilandan daha ağır basar", () => {
    const r = computeReference(
      [{ ...obs("own_sell", 50_000), sampleSize: 1 }, { ...obs("own_sell", 40_000), sampleSize: 3 }],
      base,
    );
    expect(r.value!).toBeLessThan(45_000);
  });

  it("eski veride güven düşer", () => {
    const r = computeReference([obs("own_sell", 40_000, 20), obs("own_sell", 41_000, 25)], base);
    expect(r.confidence).toBe("dusuk");
  });

  it("2. el veri yoksa rakip geri alımdan geri hesaplar", () => {
    const r = computeReference([obs("buyback", 31_200)], base);
    expect(r.method).toBe("buyback");
    expect(r.value).toBeCloseTo(40_000);
  });

  it("hiç 2. el veri yoksa sıfır fiyattan yaşa göre tahmin eder", () => {
    // 2023 çıkışlı, 2026'da 3 yaşında → 0.53
    const r = computeReference([obs("new_retail", 60_000)], base);
    expect(r.method).toBe("new_depreciation");
    expect(r.value).toBeCloseTo(31_800);
  });

  it("yenilenmiş fiyat dükkan 2. el fiyatına çevrilir", () => {
    const r = computeReference([obs("refurb_retail", 100_000)], base);
    expect(r.value).toBeCloseTo(82_000);
  });

  it("yerel ilan varsa yenilenmiş fiyatı hesaba katmaz", () => {
    const r = computeReference([obs("used_listing", 52_000), obs("refurb_retail", 77_500)], base);
    expect(r.value).toBeCloseTo(52_000);
    expect(r.used).toHaveLength(1);
  });

  it("kendi işlemlerinden öğrenilen düzeltme uygulanır", () => {
    const settings = { ...DEFAULT_SETTINGS, calibration: { factor: 0.9, samples: 6, updatedAt: null } };
    const r = computeReference([obs("own_sell", 50_000)], { ...base, settings });
    expect(r.value).toBeCloseTo(45_000);
    expect(r.calibration).toBe(0.9);
  });

  it("3'ten az örnekte düzeltme uygulanmaz", () => {
    const settings = { ...DEFAULT_SETTINGS, calibration: { factor: 0.5, samples: 2, updatedAt: null } };
    const r = computeReference([obs("own_sell", 50_000)], { ...base, settings });
    expect(r.value).toBeCloseTo(50_000);
  });

  it("veri yoksa değer null", () => {
    expect(computeReference([], base).value).toBeNull();
  });
});

describe("computeAdjustments", () => {
  it("varsayılan seçimde iPhone için sadece pil sağlığı eksik", () => {
    const a = computeAdjustments("iphone", defaultSelection("iphone"));
    expect(a.multiplier).toBe(1);
    expect(a.missing).toEqual(["Pil sağlığı"]);
  });

  it("kesintiler çarpılarak uygulanır", () => {
    const a = computeAdjustments("iphone", {
      ...defaultSelection("iphone"),
      pil_sagligi: "p80",
      kozmetik: "b",
    });
    expect(a.multiplier).toBeCloseTo(0.92 * 0.92);
    expect(a.applied).toHaveLength(2);
  });

  it("arızalar çoklu seçilir", () => {
    const a = computeAdjustments("android", { ...defaultSelection("android"), arizalar: ["hoparlor", "sarj"] });
    expect(a.multiplier).toBeCloseTo(0.95 * 0.94);
  });

  it("kullanıcı ayarı varsayılanı ezer, sabit TL kesinti destekler", () => {
    const a = computeAdjustments(
      "iphone",
      { ...defaultSelection("iphone"), pil_sagligi: "p90", ekran: "kirik" },
      { "ekran:kirik": { mode: "fixed", value: 4_000 } },
    );
    expect(a.multiplier).toBe(1);
    expect(a.fixedTotal).toBe(4_000);
  });

  it("hesap kilidi cihazı engeller", () => {
    const a = computeAdjustments("iphone", { ...defaultSelection("iphone"), engel: ["hesap"] });
    expect(a.blocked).toHaveLength(1);
  });
});

describe("computeBuyQuote", () => {
  const market = [40_000, 40_000, 40_000, 40_000, 40_000].map((p) => obs("own_sell", p, 1));
  const input = {
    observations: market,
    family: "iphone" as const,
    releaseYear: 2023,
    selection: { ...defaultSelection("iphone"), pil_sagligi: "p90" },
    settings: DEFAULT_SETTINGS,
    now: NOW,
  };

  it("kusursuz cihazda marjlara göre 3 fiyat verir", () => {
    const q = computeBuyQuote(input);
    expect(q.resale).toBe(40_000);
    // en çok %10, önerilen %13, en az %17 kâr payı
    expect(q.offers).toEqual({ min: 33_000, mid: 34_750, max: 36_000 });
  });

  it("26.000'lik ilan için 22-23 bin bandında alış önerir", () => {
    const q = computeBuyQuote({ ...input, observations: [obs("used_listing", 26_000)] });
    expect(q.resale).toBe(26_000);
    expect(q.offers).toEqual({ min: 21_500, mid: 22_500, max: 23_250 });
  });

  it("rakip geri alım teklifi ortalama fiyatı etkiler ama sınırları aşmaz", () => {
    const q = computeBuyQuote({ ...input, observations: [...market, obs("buyback", 32_000, 1, "easycep")] });
    expect(q.offers!.mid).toBe(33_250); // (34.800 + 32.000) / 2 = 33.400 → aşağı yuvarla
    expect(q.competitor?.sources).toEqual(["easycep"]);
  });

  it("en az kâr tutarı korunur", () => {
    const cheap = [4_000, 4_000].map((p) => obs("own_sell", p));
    const q = computeBuyQuote({ ...input, observations: cheap });
    expect(q.resale! - q.offers!.max).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.minProfit);
    expect(q.offers!.min).toBeLessThanOrEqual(q.offers!.mid);
    expect(q.offers!.mid).toBeLessThanOrEqual(q.offers!.max);
  });

  it("engelli cihazda teklif vermez", () => {
    const q = computeBuyQuote({ ...input, selection: { ...input.selection, engel: ["karaliste"] } });
    expect(q.offers).toBeNull();
    expect(q.warnings[0]).toMatch(/ALINMAZ/);
  });

  it("veri yoksa teklif vermez ve uyarır", () => {
    const q = computeBuyQuote({ ...input, observations: [] });
    expect(q.offers).toBeNull();
    expect(q.warnings.join(" ")).toMatch(/fiyat verisi yok/);
  });
});

describe("computeSaleQuote", () => {
  it("toptan maliyet + kâr, piyasa medyanıyla sınırlı", () => {
    const q = computeSaleQuote({
      observations: [
        obs("new_wholesale", 50_000, 1, "supplier"),
        obs("new_wholesale", 51_000, 2, "supplier"),
        obs("new_retail", 52_500, 1, "akakce"),
        obs("new_retail", 53_500, 1, "cimri"),
      ],
      settings: DEFAULT_SETTINGS,
      now: NOW,
    });
    expect(q.cost?.value).toBe(50_000);
    expect(q.prices).toEqual({ min: 51_000, mid: 53_000, max: 53_000 });
  });

  it("toptan fiyat yoksa maliyeti perakendeden tahmin eder", () => {
    const q = computeSaleQuote({ observations: [obs("new_retail", 20_000)], settings: DEFAULT_SETTINGS, now: NOW });
    expect(q.cost?.estimated).toBe(true);
    expect(q.cost?.value).toBeCloseTo(18_600);
  });

  it("garanti tipine göre filtreler", () => {
    const q = computeSaleQuote({
      observations: [
        { ...obs("new_wholesale", 50_000), warranty: "ithalatci" },
        { ...obs("new_wholesale", 56_000), warranty: "resmi" },
      ],
      warranty: "resmi",
      settings: DEFAULT_SETTINGS,
      now: NOW,
    });
    expect(q.cost?.value).toBe(56_000);
  });
});
