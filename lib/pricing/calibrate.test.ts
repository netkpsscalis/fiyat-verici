import { describe, expect, it } from "vitest";
import { computeCalibrationFactor } from "./calibrate";

describe("computeCalibrationFactor", () => {
  it("3'ten az örnekte düzeltme yapmaz", () => {
    expect(computeCalibrationFactor([{ actual: 40_000, predicted: 50_000 }])).toEqual({ factor: 1, samples: 1 });
  });

  it("tahmin sürekli yüksekse katsayıyı düşürür", () => {
    const s = [
      { actual: 45_000, predicted: 50_000 },
      { actual: 44_000, predicted: 50_000 },
      { actual: 46_000, predicted: 50_000 },
      { actual: 45_500, predicted: 50_000 },
    ];
    const r = computeCalibrationFactor(s);
    expect(r.factor).toBeCloseTo(0.905, 2);
    expect(r.samples).toBe(4);
  });

  it("uç değeri atar ve sınırların dışına çıkmaz", () => {
    const s = [
      { actual: 50_000, predicted: 50_000 },
      { actual: 49_000, predicted: 50_000 },
      { actual: 51_000, predicted: 50_000 },
      { actual: 50_500, predicted: 50_000 },
      { actual: 5_000, predicted: 50_000 },
    ];
    expect(computeCalibrationFactor(s).factor).toBeCloseTo(1, 1);
    const hepsiYuksek = Array.from({ length: 5 }, () => ({ actual: 100_000, predicted: 50_000 }));
    expect(computeCalibrationFactor(hepsiYuksek).factor).toBe(1.3);
  });
});
