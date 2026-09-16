import type { Metadata } from "next";
import { SaleCalculator } from "@/components/SaleCalculator";
import { getCatalog, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
/** "Kaynakları güncelle" birkaç siteyi sırayla okuyabilir */
export const maxDuration = 60;
export const metadata: Metadata = { title: "Sıfır sat" };

export default async function SatPage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
  return <SaleCalculator catalog={catalog} settings={settings} />;
}
