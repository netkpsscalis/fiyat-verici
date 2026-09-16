import type { Metadata } from "next";
import { DeleteUploadButton } from "@/components/DeleteUploadButton";
import { PriceListImport } from "@/components/PriceListImport";
import { getCatalog } from "@/lib/data";
import { formatAge } from "@/lib/format";
import { DAY_MS } from "@/lib/pricing/stats";
import { getLearnedAliases, getRecentUploads, getSuppliers } from "@/lib/suppliers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Toptancı listesi" };

export default async function ToptanciPage() {
  const [catalog, suppliers, learned, uploads] = await Promise.all([
    getCatalog(),
    getSuppliers(),
    getLearnedAliases(),
    getRecentUploads(),
  ]);
  const now = Date.now();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
          Toptancı
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Toptancının gönderdiği listeyi yapıştır ya da dosyasını yükle. Satırları kontrol et, onayladıkların sıfır satış
          fiyatının maliyetine girer.
        </p>
      </header>

      <PriceListImport catalog={catalog} suppliers={suppliers} learned={learned} />

      <section className="space-y-3">
        <h2 className="eyebrow text-muted">Son yüklenen listeler</h2>
        {uploads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">
            Henüz liste yüklenmedi.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.supplierName}</p>
                  <p className="truncate text-xs text-muted">
                    {u.savedCount} fiyat · {u.fileName ?? "yapıştırılan metin"} · {formatAge((now - u.createdAt) / DAY_MS)}
                  </p>
                </div>
                <DeleteUploadButton id={u.id} count={u.savedCount} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
