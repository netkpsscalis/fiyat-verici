import type { Metadata } from "next";
import { BuyWizard } from "@/components/BuyWizard";
import { getCatalog, getOverrides, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
/** "Getmobil fiyatlarını yenile" birkaç sayfayı sırayla okuyabilir */
export const maxDuration = 60;
export const metadata: Metadata = { title: "Cihaz al" };

export default async function AlPage() {
  const [catalog, settings, overrides] = await Promise.all([getCatalog(), getSettings(), getOverrides()]);
  return <BuyWizard catalog={catalog} settings={settings} overrides={overrides} />;
}
