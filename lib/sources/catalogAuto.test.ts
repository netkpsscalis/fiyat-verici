import { describe, expect, it } from "vitest";
import { catalogCandidate, detectBrand, isPhoneName } from "./catalogAuto";

describe("detectBrand", () => {
  it("ürün adından markayı bulur", () => {
    expect(detectBrand("Samsung Galaxy A27 5G 8/256 GB")).toBe("samsung");
    expect(detectBrand("iPhone 17 Pro Max 256 GB")).toBe("apple");
    expect(detectBrand("Xiaomi Redmi 15C 8+256GB")).toBe("xiaomi");
    expect(detectBrand("Oppo Reno 13 8/256")).toBe("oppo");
    expect(detectBrand("TECNO Camon 50 Ultra")).toBe("tecno");
    expect(detectBrand("Bilicra Round Akıllı Çocuk Saati")).toBeNull();
  });
});

describe("isPhoneName", () => {
  it("aksesuarları ayıklar", () => {
    expect(isPhoneName("Samsung Galaxy A27 5G 8/256 GB Akıllı Telefon")).toBe(true);
    expect(isPhoneName("Apple Watch Series 10 GPS 42 mm")).toBe(false);
    expect(isPhoneName("SBS Type-C To Type-C 240 W Data ve Şarj Kablosu")).toBe(false);
    expect(isPhoneName("JBL Tune 310C Kulakiçi Kulaklık")).toBe(false);
  });
});

describe("catalogCandidate", () => {
  it("telefonu kataloğa eklenecek biçime çevirir", () => {
    expect(catalogCandidate({ name: "Samsung Galaxy A27 5G 8/256 GB Akıllı Telefon Siyah", ramGb: 8, storageGb: 256 })).toEqual({
      brandId: "samsung",
      name: "Galaxy A27",
      ramGb: 8,
      storageGb: 256,
    });
    expect(catalogCandidate({ name: "Oppo Reno 13 F 8/256 GB Akıllı Telefon", ramGb: 8, storageGb: 256 })).toMatchObject({
      brandId: "oppo",
      name: "Oppo Reno 13 F",
    });
  });

  it("hafızası okunamayanı, aksesuarı ve markası bilinmeyeni geçer", () => {
    expect(catalogCandidate({ name: "Samsung Galaxy A27", ramGb: null, storageGb: null })).toBeNull();
    expect(catalogCandidate({ name: "Apple Watch Series 10 GPS 42 mm", ramGb: null, storageGb: 64 })).toBeNull();
    expect(catalogCandidate({ name: "Bilicra Round Çocuk Saati 128 GB", ramGb: null, storageGb: 128 })).toBeNull();
  });
});
