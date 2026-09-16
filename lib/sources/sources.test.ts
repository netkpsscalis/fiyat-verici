import { describe, expect, it } from "vitest";
import type { CatalogModel } from "@/lib/types";
import { folderKeys, groupSitemap, offersByVariant } from "./getmobil";
import { extractOffers, parseNumber, parseSize } from "./jsonld";
import { pickTrackedPrice } from "./pick";
import { isAllowed, parseRobots } from "./robots";

describe("pickTrackedPrice", () => {
  const offer = (name: string, price: number, size: string | null = null) => ({
    name,
    size,
    price,
    currency: "TRY",
    condition: "new" as const,
    inStock: true,
  });

  it("hafıza ürün adında yazıyorsa (Samsung mağazası) doğru hafızayı seçer", () => {
    const offers = [
      offer("Galaxy S25 Ultra 256 GB｜12 GB Titanyum Gümüş", 93_499),
      offer("Galaxy S25 Ultra 512 GB｜12 GB Titanyum Mavi", 101_499),
      offer("Galaxy S25 Ultra 1 TB｜12 GB Titanyum Gri", 111_499),
    ];
    expect(pickTrackedPrice(offers, { ramGb: 12, storageGb: 512 }, 256)).toBe(101_499);
    expect(pickTrackedPrice(offers, { ramGb: 12, storageGb: 1024 }, 256)).toBe(111_499);
  });

  it("başlangıç fiyatını sadece en düşük hafızaya yazar (Apple mağazası)", () => {
    const offers = [offer("iPhone 16", 85_999)];
    expect(pickTrackedPrice(offers, { ramGb: null, storageGb: 128 }, 128)).toBe(85_999);
    expect(() => pickTrackedPrice(offers, { ramGb: null, storageGb: 256 }, 128)).toThrow(/128 GB seçeneğine ekle/);
  });

  it("sayfada istenen hafıza yoksa hata verir", () => {
    expect(() => pickTrackedPrice([offer("x", 1, "256 GB")], { ramGb: null, storageGb: 512 }, 128)).toThrow(/512 GB/);
  });
});

describe("robots", () => {
  const txt = `
User-agent: GPTBot
Disallow: /

User-agent: *
User-agent: Googlebot
Disallow: /api/
Disallow: /satin-al-v1
Disallow: /*?q=
Disallow: *minPrice*
Allow: /api/public/
`;
  const rules = parseRobots(txt);

  it("genel gruba uyar, başka botların grubunu karıştırmaz", () => {
    expect(isAllowed(rules, "/satin-al/cep-telefonu/apple/iphone-15-pro/x-1/")).toBe(true);
    expect(isAllowed(rules, "/api/products")).toBe(false);
    expect(isAllowed(rules, "/satin-al-v1/abc")).toBe(false);
    expect(isAllowed(rules, "/arama?q=iphone")).toBe(false);
    expect(isAllowed(rules, "/liste?minPrice=100")).toBe(false);
  });

  it("daha uzun izin kuralı yasağı ezer", () => {
    expect(isAllowed(rules, "/api/public/x")).toBe(true);
  });
});

describe("jsonld", () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"ProductGroup","name":"iPhone 15 Pro",
    "offers":[{"@type":"Offer","price":"70000.00"}],
    "hasVariant":[
      {"@type":"Product","name":"iPhone 15 Pro 128 GB","size":"128 GB","offers":[{"@type":"Offer","price":"76999.00","priceCurrency":"TRY","itemCondition":"https://schema.org/RefurbishedCondition","availability":"https://schema.org/InStock"}]},
      {"@type":"Product","name":"iPhone 15 Pro 256 GB","size":"256 GB","offers":{"@type":"Offer","price":"80599.00","priceCurrency":"TRY","availability":"https://schema.org/OutOfStock"}}
    ]}</script>
    <script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Galaxy A55","offers":{"@type":"AggregateOffer","lowPrice":"15.249,90","priceCurrency":"TRY"}}]}</script>
    <script type="application/ld+json">{bozuk</script></html>`;
  const offers = extractOffers(html);

  it("ürün grubundaki varyant tekliflerini okur, grup teklifini tekrar saymaz", () => {
    expect(offers.filter((o) => o.name?.includes("iPhone"))).toEqual([
      { name: "iPhone 15 Pro 128 GB", size: "128 GB", price: 76999, currency: "TRY", condition: "refurbished", inStock: true },
      { name: "iPhone 15 Pro 256 GB", size: "256 GB", price: 80599, currency: "TRY", condition: null, inStock: false },
    ]);
  });

  it("@graph ve AggregateOffer içindeki en düşük fiyatı okur", () => {
    expect(offers.find((o) => o.name === "Galaxy A55")?.price).toBeCloseTo(15249.9);
  });

  it("sayı ve hafıza yazımlarını çözer", () => {
    expect(parseNumber("76.999,00")).toBe(76999);
    expect(parseNumber("76,999.00")).toBe(76999);
    expect(parseSize("1 TB")).toEqual({ ramGb: null, storageGb: 1024 });
    expect(parseSize("8 GB / 256 GB")).toEqual({ ramGb: 8, storageGb: 256 });
    expect(parseSize("Yenilenmiş Galaxy S24 Ultra 512 GB Gri")).toEqual({ ramGb: null, storageGb: 512 });
  });
});

describe("getmobil", () => {
  const s23: CatalogModel = {
    id: "samsung-galaxy-s23-ultra",
    brandId: "samsung",
    brandName: "Samsung",
    name: "Galaxy S23 Ultra",
    series: "Galaxy S",
    releaseYear: 2023,
    family: "android",
    hasBatteryHealth: false,
    variants: [
      { id: "s23u-8-256", ramGb: 8, storageGb: 256 },
      { id: "s23u-12-256", ramGb: 12, storageGb: 256 },
      { id: "s23u-12-512", ramGb: 12, storageGb: 512 },
    ],
  };

  it("site haritasını marka/model klasörüne göre gruplar", () => {
    const xml = `<urlset><url><loc>https://getmobil.com/satin-al/cep-telefonu/android-telefonlar/samsung/galaxy-s23-ultra/samsung-galaxy-s23-ultra-256-gb-siyah-1/</loc></url>
      <url><loc>https://getmobil.com/satin-al/cep-telefonu/android-telefonlar/samsung/galaxy-s23-ultra/samsung-galaxy-s23-ultra-512-gb-krem-2/</loc></url></urlset>`;
    const g = groupSitemap(xml);
    expect(g.get("samsung/galaxy-s23-ultra")).toHaveLength(2);
    expect(folderKeys(s23)).toContain("samsung/galaxy-s23-ultra");
  });

  it("Xiaomi alt markalarını da dener", () => {
    expect(folderKeys({ ...s23, brandId: "xiaomi", name: "Redmi Note 13 Pro" })).toContain("redmi/note-13-pro");
  });

  it("-5g yazımını dener ama tam adı önce dener", () => {
    const keys = folderKeys({ ...s23, name: "Galaxy S22+" });
    expect(keys).toContain("samsung/galaxy-s22-plus-5g");
    expect(keys.indexOf("samsung/galaxy-s22-plus")).toBeLessThan(keys.indexOf("samsung/galaxy-s22-plus-5g"));
  });

  it("katalogda olmayan hafıza seçeneğini bildirir", () => {
    const { byVariant, missing } = offersByVariant(s23, [
      { name: null, size: "1 TB", price: 90_000, currency: "TRY", condition: "refurbished", inStock: true },
    ]);
    expect(byVariant.size).toBe(0);
    expect(missing).toEqual([{ ramGb: null, storageGb: 1024, prices: [90_000] }]);
  });

  it("RAM yazmayan teklifi aynı depolamalı varyantlara dağıtır, stokta olmayanı ve dövizliyi atlar", () => {
    const { byVariant: m, missing } = offersByVariant(s23, [
      { name: null, size: "256 GB", price: 50000, currency: "TRY", condition: "refurbished", inStock: true },
      { name: null, size: "512 GB", price: 60000, currency: "TRY", condition: "refurbished", inStock: false },
      { name: null, size: "512 GB", price: 700, currency: "USD", condition: "refurbished", inStock: true },
    ]);
    expect(m.get("s23u-8-256")).toEqual([50000]);
    expect(m.get("s23u-12-256")).toEqual([50000]);
    expect(m.has("s23u-12-512")).toBe(false);
    expect(missing).toEqual([]);
  });
});
