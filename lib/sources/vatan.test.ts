import { describe, expect, it } from "vitest";
import type { CatalogModel } from "@/lib/types";
import { suggestModelName } from "./unmatched";
import { matchVatanProducts, parseVatanProducts, storageFromName } from "./vatan";

const html = `
<div class="product-list">
  <a href="https://www.vatanbilgisayar.com/iphone-16-128-gb-akilli-telefon-beyaz.html" class="product-list__image-safe-link"><img></a>
  <div class="product-list__product-name"> <h3>iPhone 16 128 GB Ak&#x131;ll&#x131; Telefon Beyaz</h3> </div>
  <div class="product-list__cost"><span class='product-list__price'>79.999</span><span class='product-list__currency'> TL</span></div>
</div>
<div class="product-list">
  <a href="https://www.vatanbilgisayar.com/iphone-16-128-gb-akilli-telefon-siyah.html" class="product-list__image-safe-link"><img></a>
  <div class="product-list__product-name"> <h3>iPhone 16 128 GB Ak&#x131;ll&#x131; Telefon Siyah</h3> </div>
  <div class="product-list__cost"><span class='product-list__price'>78.499</span></div>
</div>
<div class="product-list">
  <a href="https://www.vatanbilgisayar.com/galaxy-s25-fe.html" class="product-list__image-safe-link"><img></a>
  <div class="product-list__product-name"> <h3>Samsung Galaxy S25 FE 5G 8/256 Gb Ak&#x131;ll&#x131; Telefon Gece Siyah&#x131;</h3> </div>
  <div class="product-list__cost"><span class='product-list__price'>40.999</span></div>
</div>`;

const iphone16: CatalogModel = {
  id: "apple-iphone-16",
  brandId: "apple",
  brandName: "Apple",
  name: "iPhone 16",
  series: "iPhone",
  releaseYear: 2024,
  family: "iphone",
  hasBatteryHealth: true,
  variants: [
    { id: "apple-iphone-16-128", ramGb: null, storageGb: 128 },
    { id: "apple-iphone-16-256", ramGb: null, storageGb: 256 },
  ],
};

describe("vatan", () => {
  it("ürün adını, fiyatını ve adresini okur", () => {
    const products = parseVatanProducts(html);
    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({ name: "iPhone 16 128 GB Akıllı Telefon Beyaz", price: 79_999 });
    expect(products[0].url).toContain("iphone-16-128-gb");
    expect(products[2].price).toBe(40_999);
  });

  it("addaki RAM ve hafızayı çözer", () => {
    expect(storageFromName("iPhone 16 128 GB Akıllı Telefon Beyaz")).toEqual({ ramGb: null, storageGb: 128 });
    expect(storageFromName("Galaxy S25 FE 5G 8/256 Gb")).toEqual({ ramGb: 8, storageGb: 256 });
    expect(storageFromName("Redmi 15 8+256GB Siyah")).toEqual({ ramGb: 8, storageGb: 256 });
    expect(storageFromName("iPhone 17 Pro Max 1 TB")).toEqual({ ramGb: null, storageGb: 1024 });
  });

  it("katalogla eşleştirir, aynı cihazın en ucuz rengini alır, katalogda olmayanı atlar", () => {
    const { matched, unmatched } = matchVatanProducts(parseVatanProducts(html), [iphone16], "apple");
    expect(unmatched.map((u) => u.name)).toEqual(["Samsung Galaxy S25 FE 5G 8/256 Gb Akıllı Telefon Gece Siyahı"]);
    expect(matched).toEqual([
      {
        variantId: "apple-iphone-16-128",
        price: 78_499,
        url: expect.stringContaining("iphone-16-128-gb"),
        name: "iPhone 16 128 GB Akıllı Telefon Siyah",
        warranty: "resmi",
      },
    ]);
  });
});

describe("suggestModelName", () => {
  it("ürün adından kataloğa uygun model adı çıkarır", () => {
    expect(suggestModelName("Samsung Galaxy A27 5G 8/256 GB Akıllı Telefon Siyah", "samsung")).toBe("Galaxy A27");
    expect(suggestModelName("Xiaomi 17T Pro 12/512GB Akıllı Telefon Koyu Mavi", "xiaomi")).toBe("Xiaomi 17T Pro");
    expect(suggestModelName("Xiaomi Redmi 15C 8+256GB Siyah Akıllı Telefon", "xiaomi")).toBe("Redmi 15C");
    expect(suggestModelName("iPhone 17 Pro Max 256 GB Akıllı Telefon Kozmik Turuncu", "apple")).toBe("iPhone 17 Pro Max");
    expect(suggestModelName("Samsung Galaxy Z Fold8 Ultra 12GB 256GB", "samsung")).toBe("Galaxy Z Fold8 Ultra");
  });
});
