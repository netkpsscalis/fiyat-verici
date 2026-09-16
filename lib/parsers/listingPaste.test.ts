import { describe, expect, it } from "vitest";
import { catalog, modelId, parseVariant, variantId } from "@/data/seed/devices";
import type { CatalogModel } from "@/lib/types";
import { parseListingPaste } from "./listingPaste";

const models: CatalogModel[] = catalog.flatMap((b) =>
  b.models.map((m) => {
    const id = modelId(b.id, m.name);
    return {
      id,
      brandId: b.id,
      brandName: b.name,
      name: m.name,
      series: m.series,
      releaseYear: m.year,
      family: b.family,
      hasBatteryHealth: b.hasBatteryHealth,
      variants: m.variants.map((spec) => {
        const v = parseVariant(spec);
        return { id: variantId(id, v), ...v };
      }),
    };
  }),
);
const iphone15Pro = models.find((m) => m.id === "apple-iphone-15-pro")!;

// Sahibinden arama sonuçlarından kopyalanmış gibi
const sahibinden = `
iPhone 15 Pro 128 GB Temiz Kutulu Faturalı
26.000 TL
16 Eylül 2026
İstanbul Kadıköy
Sahibinden iPhone 15 Pro 128GB pil %89
25.500 TL
15 Eylül 2026
iPhone 15 Pro 128 GB ekranı kırık
18.000 TL
iPhone 15 Pro Max 256 GB
34.000 TL
iPhone 15 Pro 256 GB Naturel
29.500 TL
iPhone 15 Pro 128 gb iCloud kilitli
9.000 TL
Apple iPhone 15 Pro 128 GB   26.750 TL
iPhone 15 Pro takaslı 128   2.000 TL
`;

describe("parseListingPaste", () => {
  const r = parseListingPaste(sahibinden, { model: iphone15Pro, storageGb: 128 }, models);

  it("aynı model ve hafızadaki temiz ilanları alır", () => {
    expect(r.kept.map((k) => k.price).sort((a, b) => a - b)).toEqual([25_500, 26_000, 26_750]);
  });

  it("hasarlı, kilitli, başka model ve başka hafızalı ilanları ayıklar", () => {
    expect(r.skipped.damaged).toBe(2);
    expect(r.skipped.otherModel).toBe(1);
    expect(r.skipped.otherStorage).toBe(1);
  });

  it("gerçek dışı düşük fiyatı uç değer olarak atar", () => {
    expect(r.kept.some((k) => k.price === 2_000)).toBe(false);
  });

  it("Letgo'daki ₺ önde yazımını okur", () => {
    const x = parseListingPaste("iPhone 15 Pro 128 GB temiz\n₺ 25.900", { model: iphone15Pro, storageGb: 128 }, models);
    expect(x.kept.map((k) => k.price)).toEqual([25_900]);
  });
});
