/**
 * Başlangıç cihaz kataloğu. Varyantlar "depolama" (iPhone) ya da "RAM/depolama" (Android) olarak yazılır.
 * 1TB = 1024, 2TB = 2048. Katalog uygulama içinden genişletilebilir.
 */
export interface BrandDef {
  id: string;
  name: string;
  family: "iphone" | "android";
  hasBatteryHealth: boolean;
  models: ModelDef[];
}

export interface ModelDef {
  name: string;
  series: string;
  year: number;
  variants: string[];
}

const IP = (name: string, year: number, variants: string[], series = "iPhone"): ModelDef => ({ name, series, year, variants });

export const catalog: BrandDef[] = [
  {
    id: "apple",
    name: "Apple",
    family: "iphone",
    hasBatteryHealth: true,
    models: [
      IP("iPhone 11", 2019, ["64", "128", "256"]),
      IP("iPhone 11 Pro", 2019, ["64", "256", "512"]),
      IP("iPhone 11 Pro Max", 2019, ["64", "256", "512"]),
      IP("iPhone SE (2020)", 2020, ["64", "128", "256"], "iPhone SE"),
      IP("iPhone 12 mini", 2020, ["64", "128", "256"]),
      IP("iPhone 12", 2020, ["64", "128", "256"]),
      IP("iPhone 12 Pro", 2020, ["128", "256", "512"]),
      IP("iPhone 12 Pro Max", 2020, ["128", "256", "512"]),
      IP("iPhone 13 mini", 2021, ["128", "256", "512"]),
      IP("iPhone 13", 2021, ["128", "256", "512"]),
      IP("iPhone 13 Pro", 2021, ["128", "256", "512", "1024"]),
      IP("iPhone 13 Pro Max", 2021, ["128", "256", "512", "1024"]),
      IP("iPhone SE (2022)", 2022, ["64", "128", "256"], "iPhone SE"),
      IP("iPhone 14", 2022, ["128", "256", "512"]),
      IP("iPhone 14 Plus", 2022, ["128", "256", "512"]),
      IP("iPhone 14 Pro", 2022, ["128", "256", "512", "1024"]),
      IP("iPhone 14 Pro Max", 2022, ["128", "256", "512", "1024"]),
      IP("iPhone 15", 2023, ["128", "256", "512"]),
      IP("iPhone 15 Plus", 2023, ["128", "256", "512"]),
      IP("iPhone 15 Pro", 2023, ["128", "256", "512", "1024"]),
      IP("iPhone 15 Pro Max", 2023, ["256", "512", "1024"]),
      IP("iPhone 16e", 2025, ["128", "256", "512"]),
      IP("iPhone 16", 2024, ["128", "256", "512"]),
      IP("iPhone 16 Plus", 2024, ["128", "256", "512"]),
      IP("iPhone 16 Pro", 2024, ["128", "256", "512", "1024"]),
      IP("iPhone 16 Pro Max", 2024, ["256", "512", "1024"]),
      IP("iPhone 17", 2025, ["256", "512"]),
      IP("iPhone Air", 2025, ["256", "512", "1024"]),
      IP("iPhone 17 Pro", 2025, ["256", "512", "1024"]),
      IP("iPhone 17 Pro Max", 2025, ["256", "512", "1024", "2048"]),
    ],
  },
  {
    id: "samsung",
    name: "Samsung",
    family: "android",
    hasBatteryHealth: false,
    models: [
      { name: "Galaxy S22", series: "Galaxy S", year: 2022, variants: ["8/128", "8/256"] },
      { name: "Galaxy S22+", series: "Galaxy S", year: 2022, variants: ["8/128", "8/256"] },
      { name: "Galaxy S22 Ultra", series: "Galaxy S", year: 2022, variants: ["8/128", "12/256", "12/512"] },
      { name: "Galaxy S23", series: "Galaxy S", year: 2023, variants: ["8/128", "8/256"] },
      { name: "Galaxy S23+", series: "Galaxy S", year: 2023, variants: ["8/256", "8/512"] },
      { name: "Galaxy S23 Ultra", series: "Galaxy S", year: 2023, variants: ["8/256", "12/256", "12/512", "12/1024"] },
      { name: "Galaxy S23 FE", series: "Galaxy S", year: 2023, variants: ["8/128", "8/256"] },
      { name: "Galaxy S24", series: "Galaxy S", year: 2024, variants: ["8/128", "8/256", "8/512"] },
      { name: "Galaxy S24+", series: "Galaxy S", year: 2024, variants: ["12/256", "12/512"] },
      { name: "Galaxy S24 Ultra", series: "Galaxy S", year: 2024, variants: ["12/256", "12/512", "12/1024"] },
      { name: "Galaxy S24 FE", series: "Galaxy S", year: 2024, variants: ["8/128", "8/256", "8/512"] },
      { name: "Galaxy S25", series: "Galaxy S", year: 2025, variants: ["12/128", "12/256", "12/512"] },
      { name: "Galaxy S25+", series: "Galaxy S", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Galaxy S25 Ultra", series: "Galaxy S", year: 2025, variants: ["12/256", "12/512", "12/1024"] },
      { name: "Galaxy S25 Edge", series: "Galaxy S", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Galaxy S25 FE", series: "Galaxy S", year: 2025, variants: ["8/128", "8/256", "8/512"] },
      { name: "Galaxy S26", series: "Galaxy S", year: 2026, variants: ["12/256", "12/512"] },
      { name: "Galaxy S26+", series: "Galaxy S", year: 2026, variants: ["12/256", "12/512"] },
      { name: "Galaxy S26 Ultra", series: "Galaxy S", year: 2026, variants: ["12/256", "12/512", "16/1024"] },
      { name: "Galaxy Z Flip5", series: "Galaxy Z", year: 2023, variants: ["8/256", "8/512"] },
      { name: "Galaxy Z Fold5", series: "Galaxy Z", year: 2023, variants: ["12/256", "12/512", "12/1024"] },
      { name: "Galaxy Z Flip6", series: "Galaxy Z", year: 2024, variants: ["12/256", "12/512"] },
      { name: "Galaxy Z Fold6", series: "Galaxy Z", year: 2024, variants: ["12/256", "12/512", "12/1024"] },
      { name: "Galaxy Z Flip7", series: "Galaxy Z", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Galaxy Z Fold7", series: "Galaxy Z", year: 2025, variants: ["12/256", "12/512", "16/1024"] },
      { name: "Galaxy A05s", series: "Galaxy A", year: 2023, variants: ["4/64", "4/128"] },
      { name: "Galaxy A06", series: "Galaxy A", year: 2024, variants: ["4/64", "4/128"] },
      { name: "Galaxy A14", series: "Galaxy A", year: 2023, variants: ["4/64", "4/128"] },
      { name: "Galaxy A15", series: "Galaxy A", year: 2023, variants: ["4/128", "6/128", "8/256"] },
      { name: "Galaxy A16", series: "Galaxy A", year: 2024, variants: ["4/128", "6/128", "8/256"] },
      { name: "Galaxy A24", series: "Galaxy A", year: 2023, variants: ["6/128", "8/128"] },
      { name: "Galaxy A25", series: "Galaxy A", year: 2023, variants: ["6/128", "8/256"] },
      { name: "Galaxy A26", series: "Galaxy A", year: 2025, variants: ["6/128", "8/256"] },
      { name: "Galaxy A34", series: "Galaxy A", year: 2023, variants: ["6/128", "8/128", "8/256"] },
      { name: "Galaxy A35", series: "Galaxy A", year: 2024, variants: ["6/128", "8/128", "8/256"] },
      { name: "Galaxy A36", series: "Galaxy A", year: 2025, variants: ["6/128", "8/128", "8/256"] },
      { name: "Galaxy A54", series: "Galaxy A", year: 2023, variants: ["8/128", "8/256"] },
      { name: "Galaxy A55", series: "Galaxy A", year: 2024, variants: ["8/128", "8/256"] },
      { name: "Galaxy A56", series: "Galaxy A", year: 2025, variants: ["8/128", "8/256", "12/256"] },
    ],
  },
  {
    id: "xiaomi",
    name: "Xiaomi",
    family: "android",
    hasBatteryHealth: false,
    models: [
      { name: "Redmi 13", series: "Redmi", year: 2024, variants: ["6/128", "8/256"] },
      { name: "Redmi 14C", series: "Redmi", year: 2024, variants: ["4/128", "6/128", "8/256"] },
      { name: "Redmi Note 12", series: "Redmi Note", year: 2023, variants: ["4/128", "6/128", "8/128", "8/256"] },
      { name: "Redmi Note 12 Pro", series: "Redmi Note", year: 2023, variants: ["8/256"] },
      { name: "Redmi Note 13", series: "Redmi Note", year: 2024, variants: ["6/128", "8/128", "8/256"] },
      { name: "Redmi Note 13 Pro", series: "Redmi Note", year: 2024, variants: ["8/256", "12/512"] },
      { name: "Redmi Note 13 Pro+", series: "Redmi Note", year: 2024, variants: ["12/512"] },
      { name: "Redmi Note 14", series: "Redmi Note", year: 2025, variants: ["6/128", "8/256"] },
      { name: "Redmi Note 14 Pro", series: "Redmi Note", year: 2025, variants: ["8/256", "12/512"] },
      { name: "Redmi Note 14 Pro+", series: "Redmi Note", year: 2025, variants: ["12/512"] },
      { name: "POCO M6 Pro", series: "POCO", year: 2024, variants: ["8/256", "12/512"] },
      { name: "POCO X6 Pro", series: "POCO", year: 2024, variants: ["8/256", "12/512"] },
      { name: "POCO X7", series: "POCO", year: 2025, variants: ["8/256", "12/512"] },
      { name: "POCO X7 Pro", series: "POCO", year: 2025, variants: ["8/256", "12/512"] },
      { name: "POCO F6", series: "POCO", year: 2024, variants: ["8/256", "12/512"] },
      { name: "POCO F7", series: "POCO", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Xiaomi 13T", series: "Xiaomi", year: 2023, variants: ["8/256", "12/256"] },
      { name: "Xiaomi 13T Pro", series: "Xiaomi", year: 2023, variants: ["12/512"] },
      { name: "Xiaomi 14", series: "Xiaomi", year: 2024, variants: ["12/256", "12/512"] },
      { name: "Xiaomi 14T", series: "Xiaomi", year: 2024, variants: ["12/256", "12/512"] },
      { name: "Xiaomi 14T Pro", series: "Xiaomi", year: 2024, variants: ["12/256", "12/512", "12/1024"] },
      { name: "Xiaomi 14 Ultra", series: "Xiaomi", year: 2024, variants: ["16/512"] },
      { name: "Xiaomi 15", series: "Xiaomi", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Xiaomi 15 Ultra", series: "Xiaomi", year: 2025, variants: ["16/512"] },
      { name: "Xiaomi 15T", series: "Xiaomi", year: 2025, variants: ["12/256", "12/512"] },
      { name: "Xiaomi 15T Pro", series: "Xiaomi", year: 2025, variants: ["12/256", "12/512", "12/1024"] },
    ],
  },
];

export function slug(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseVariant(spec: string): { ramGb: number | null; storageGb: number } {
  const [a, b] = spec.split("/");
  return b === undefined ? { ramGb: null, storageGb: Number(a) } : { ramGb: Number(a), storageGb: Number(b) };
}

export function modelId(brandId: string, modelName: string) {
  return `${brandId}-${slug(modelName)}`;
}

export function variantId(mId: string, v: { ramGb: number | null; storageGb: number }) {
  return v.ramGb ? `${mId}-${v.ramGb}-${v.storageGb}` : `${mId}-${v.storageGb}`;
}
