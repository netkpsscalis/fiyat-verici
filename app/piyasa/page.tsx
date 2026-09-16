import type { Metadata } from "next";
import Link from "next/link";
import { DeleteObservationButton } from "@/components/DeleteObservationButton";
import { ObservationForm } from "@/components/ObservationForm";
import { getCatalog, getRecentObservations } from "@/lib/data";
import { formatAge, formatTL, KIND_LABELS, SOURCE_LABELS, variantLabel, WARRANTY_LABELS } from "@/lib/format";
import { DAY_MS } from "@/lib/pricing/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Piyasa fiyatları" };

export default async function PiyasaPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
  const { variant } = await searchParams;
  const [catalog, recent] = await Promise.all([getCatalog(), getRecentObservations({ variantId: variant, limit: 60 })]);
  const now = Date.now();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
          Piyasa
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          İlan, toptancı ve rakip fiyatları burada birikir. Teklifler bu fiyatlardan hesaplanır; ne kadar çok ve güncel fiyat
          girersen teklif o kadar isabetli olur.
        </p>
        <Link href="/kaynaklar" className="mt-3 inline-block text-sm font-semibold underline underline-offset-2">
          Otomatik kaynaklar ve takip linkleri →
        </Link>
      </header>

      <ObservationForm key={variant ?? "hepsi"} catalog={catalog} initialVariantId={variant} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="eyebrow text-muted">{variant ? "Bu cihazın fiyatları" : "Son eklenen fiyatlar"}</h2>
          {variant && (
            <Link href="/piyasa" className="text-sm underline underline-offset-2">
              Tümünü göster
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">
            Henüz fiyat yok. Sahibinden&apos;de gördüğün bir ilanı ya da toptancının verdiği fiyatı yukarıdan ekle.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <Link href={`/piyasa?variant=${o.variantId}`} className="hover:underline">
                      {o.modelName} · {variantLabel(o)}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {KIND_LABELS[o.kind]} · {SOURCE_LABELS[o.source] ?? o.source}
                    {o.warranty ? ` · ${WARRANTY_LABELS[o.warranty]}` : ""}
                    {o.condition ? ` · ${o.condition}` : ""} · {formatAge((now - o.observedAt) / DAY_MS)}
                  </p>
                </div>
                <p className="num shrink-0 text-lg font-bold">{formatTL(o.price)}</p>
                <DeleteObservationButton id={o.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
