import { describe, expect, it } from "vitest";
import { parsePriceText, parseSellerPaste } from "./sellerPaste";

// Epey'in fiyat listesinden kopyalanan metnin biçimi
const epey = `
Samsung Galaxy A17 5G 8/256 GB Gri Cep Telefonu
Satıcı: Trendyol | Renk: Gri
15.899,00 TL
+ 39,99 TL Kargo
Siteye Git ❯
2 saat önce
Samsung Galaxy A17 5G, Android Akıllı Telefon, 8GB RAM, 256GB Hafıza, Siyah
Satıcı: BittiBitiyor | Distribütör Garantili | Renk: Siyah
15.958,99 TL
Ücretsiz Kargo
40 dk önce
Samsung Galaxy A17 5G 8 GB 256 GB (Samsung Türkiye Garantili) mavi
Satıcı: azimholding | Distribütör Garantili | Renk: Mavi
16.174,08 TL
Ücretsiz Kargo
16 dk önce
Samsung Galaxy A17 5G 256 Gb 8 Gb Ram Cep Telefonu Gri
Satıcı: ÖZKÖKLER GROUP | Renk: Gri
16.207,10 TL
`;

describe("parsePriceText", () => {
  it("Türkçe fiyat yazımını okur", () => {
    expect(parsePriceText("15.899,00 TL")).toBe(15_899);
    expect(parsePriceText("16.207,10 TL")).toBeCloseTo(16_207.1);
    expect(parsePriceText("+ 39,99 TL Kargo")).toBeCloseTo(39.99);
    expect(parsePriceText("Ücretsiz Kargo")).toBeNull();
  });
});

describe("parseSellerPaste", () => {
  const rows = parseSellerPaste(epey);

  it("her satıcıyı fiyatıyla çıkarır, ucuzdan pahalıya sıralar", () => {
    expect(rows.map((r) => r.seller)).toEqual(["Trendyol", "BittiBitiyor", "azimholding", "ÖZKÖKLER GROUP"]);
    expect(rows[0].price).toBe(15_899);
    expect(rows.at(-1)!.price).toBeCloseTo(16_207.1);
  });

  it("kargo satırını fiyat sanmaz, kargo ücretini ayrı tutar", () => {
    expect(rows[0].shipping).toBeCloseTo(39.99);
    expect(rows[1].shipping).toBeNull();
  });

  it("garanti bilgisini okur", () => {
    expect(rows[1].warranty).toBe("resmi");
    expect(rows[0].warranty).toBeNull();
  });

  it("aynı satıcının birden fazla satırında en ucuzu alır", () => {
    const text = "Satıcı: Trendyol\n20.000,00 TL\nSatıcı: Trendyol\n18.500,00 TL";
    const r = parseSellerPaste(text);
    expect(r).toHaveLength(1);
    expect(r[0].price).toBe(18_500);
  });

  it("mağaza adı yazmayan satırları atlar", () => {
    expect(parseSellerPaste("Bir başlık\n19.999,00 TL")).toEqual([]);
  });
});
