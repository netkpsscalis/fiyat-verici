import { describe, expect, it } from "vitest";
import { catalog, modelId, parseVariant, variantId } from "@/data/seed/devices";
import type { CatalogModel } from "@/lib/types";
import { createMatcher, tokenize } from "./normalize";
import { detectWarranty, parsePriceList, parsePriceToken } from "./priceList";

// Testler gerçek başlangıç kataloğuyla çalışır
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

const match = (s: string, ctx: string | null = null) => createMatcher(models)(tokenize(s), ctx)?.model.name ?? null;

describe("tokenize", () => {
  it("fiyat, RAM/depolama ve Türkçe karakterleri korur", () => {
    expect(tokenize("İPHONE 15 PRO MAX 256GB 78.500₺")).toEqual(["iphone", "15", "pro", "max", "256gb", "78.500"]);
    expect(tokenize("S24+ 8+256 45.500 TL")).toEqual(["s24", "plus", "8/256", "45.500"]);
    expect(tokenize("Redmi Note 13 Pro 8 GB / 256 GB")).toEqual(["redmi", "note", "13", "pro", "8/256"]);
  });
});

describe("model eşleştirme", () => {
  it("uzun eşleşme kazanır", () => {
    expect(match("iPhone 15 Pro Max 256")).toBe("iPhone 15 Pro Max");
    expect(match("iPhone 15 Pro 256")).toBe("iPhone 15 Pro");
    expect(match("iPhone 15 128")).toBe("iPhone 15");
  });

  it("kısaltmaları tanır", () => {
    expect(match("İP 13 128 BEYAZ")).toBe("iPhone 13");
    expect(match("ip15 pm 256")).toBe("iPhone 15 Pro Max");
    expect(match("16 PROMAX 256", "apple")).toBe("iPhone 16 Pro Max");
    expect(match("S24U 12/256")).toBe("Galaxy S24 Ultra");
    expect(match("Galaxy S24+ 256")).toBe("Galaxy S24+");
    expect(match("Z FLIP 6 256")).toBe("Galaxy Z Flip6");
    expect(match("RN13 PRO 8/256")).toBe("Redmi Note 13 Pro");
    expect(match("Note 13 Pro+ 12/512")).toBe("Redmi Note 13 Pro+");
    expect(match("Xiaomi 14T Pro 12/512")).toBe("Xiaomi 14T Pro");
  });

  it("sadece rakamla yazılan modeli marka bağlamı olmadan eşleştirmez", () => {
    expect(match("15 pro 128")).toBeNull();
    expect(match("15 pro 128", "apple")).toBe("iPhone 15 Pro");
    expect(match("14 12/256", "xiaomi")).toBe("Xiaomi 14");
  });
});

describe("parsePriceToken", () => {
  it("farklı fiyat yazımlarını okur", () => {
    expect(parsePriceToken("45.500")).toBe(45_500);
    expect(parsePriceToken("45500")).toBe(45_500);
    expect(parsePriceToken("1.250.000")).toBe(1_250_000);
    expect(parsePriceToken("45,5k")).toBe(45_500);
    expect(parsePriceToken("128")).toBeNull();
  });
});

describe("detectWarranty", () => {
  it("garanti tipini bulur", () => {
    expect(detectWarranty("s24 ultra tr garantili")).toBe("resmi");
    expect(detectWarranty("a55 ithalatci garantili")).toBe("ithalatci");
    expect(detectWarranty("15 pro yd")).toBe("yurtdisi");
    expect(detectWarranty("15 pro 128")).toBeNull();
  });
});

describe("parsePriceList", () => {
  const list = `📱 APPLE TR GARANTİLİ 📱
15 PRO MAX 256 78.500
16 PRO 128 58.000 | 256 64.500
İP 13 128 BEYAZ 29500

🔵 SAMSUNG
S24 ULTRA 12/256 İTHALATÇI 54.900
A55 8/128 15.250 TL
S23 ULTRA 256 49.000
Z FOLD6 12/512

XIAOMI
REDMI NOTE 13 PRO 8+256 13.750
Nokia 3310 2.500`;

  const rows = parsePriceList(list, models);
  const find = (name: string, storage?: number) =>
    rows.find((r) => r.modelName === name && (storage === undefined || r.storageGb === storage));

  it("başlıktan marka ve garanti bağlamını alır", () => {
    const r = find("iPhone 15 Pro Max")!;
    expect(r).toMatchObject({ variantId: "apple-iphone-15-pro-max-256", price: 78_500, warranty: "resmi", status: "ok" });
  });

  it("aynı satırdaki birden fazla depolama-fiyat çiftini ayırır", () => {
    expect(find("iPhone 16 Pro", 128)).toMatchObject({ price: 58_000, status: "ok" });
    expect(find("iPhone 16 Pro", 256)).toMatchObject({ price: 64_500, status: "ok" });
  });

  it("kısaltılmış iPhone adını okur", () => {
    expect(find("iPhone 13")).toMatchObject({ variantId: "apple-iphone-13-128", price: 29_500 });
  });

  it("yeni marka başlığında garanti bağlamı sıfırlanır, satırdaki garanti kazanır", () => {
    expect(find("Galaxy S24 Ultra")).toMatchObject({ variantId: "samsung-galaxy-s24-ultra-12-256", warranty: "ithalatci", price: 54_900 });
    expect(find("Galaxy A55")).toMatchObject({ variantId: "samsung-galaxy-a55-8-128", warranty: null, price: 15_250 });
  });

  it("RAM yazılmamış ve birden fazla RAM seçeneği varsa belirsiz der", () => {
    expect(find("Galaxy S23 Ultra")).toMatchObject({ status: "ambiguous", storageGb: 256, price: 49_000 });
  });

  it("fiyatsız satırı işaretler", () => {
    expect(find("Galaxy Z Fold6")).toMatchObject({ status: "no_price", variantId: "samsung-galaxy-z-fold6-12-512" });
  });

  it("8+256 yazımını okur", () => {
    expect(find("Redmi Note 13 Pro")).toMatchObject({ variantId: "xiaomi-redmi-note-13-pro-8-256", price: 13_750 });
  });

  it("katalogda olmayan modeli ayrı gösterir", () => {
    const r = rows.find((x) => x.raw.startsWith("Nokia"));
    expect(r).toMatchObject({ status: "no_model", price: 2_500 });
  });

  it("öğrenilmiş takma adı kullanır", () => {
    const r = parsePriceList("APPLE\n15PM 256 77.000", models, [{ alias: "15pm", modelId: "apple-iphone-15-pro-max" }]);
    expect(r[0]).toMatchObject({ modelName: "iPhone 15 Pro Max", storageGb: 256, price: 77_000 });
  });
});
