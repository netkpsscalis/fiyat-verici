import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/lib/db/client";
import { formatAge, formatTL, variantLabel } from "@/lib/format";
import type { PriceTriple } from "@/lib/pricing/engine";
import { DAY_MS } from "@/lib/pricing/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Geçmiş" };

async function load() {
  const [quotes, txs] = await Promise.all([
    db
      .select({ q: schema.quotes, v: schema.variants, m: schema.models })
      .from(schema.quotes)
      .innerJoin(schema.variants, eq(schema.quotes.variantId, schema.variants.id))
      .innerJoin(schema.models, eq(schema.variants.modelId, schema.models.id))
      .orderBy(desc(schema.quotes.createdAt), desc(schema.quotes.id))
      .limit(50),
    db
      .select({ t: schema.transactions, v: schema.variants, m: schema.models })
      .from(schema.transactions)
      .innerJoin(schema.variants, eq(schema.transactions.variantId, schema.variants.id))
      .innerJoin(schema.models, eq(schema.variants.modelId, schema.models.id))
      .orderBy(desc(schema.transactions.createdAt), desc(schema.transactions.id))
      .limit(50),
  ]);
  return { quotes, txs };
}

export default async function GecmisPage() {
  const { quotes, txs } = await load();
  const now = Date.now();
  const age = (d: Date) => formatAge((now - d.getTime()) / DAY_MS);

  return (
    <div className="space-y-8">
      <header>
        <Link href="/ayarlar" className="text-sm text-muted underline underline-offset-2">
          ← Ayarlar
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
          Geçmiş
        </h1>
        <p className="mt-2 text-muted">Kaydettiğin teklifler ve yaptığın alış-satışlar.</p>
      </header>

      <section className="space-y-3">
        <h2 className="eyebrow text-muted">Alış ve satışlar</h2>
        {txs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">
            Henüz kayıt yok. Teklif ekranındaki &ldquo;Aldım&rdquo; ya da satış ekranındaki &ldquo;Sattım&rdquo; ile eklenir.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {txs.map(({ t, v, m }) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.name} · {variantLabel(v)}
                  </p>
                  <p className="text-xs text-muted">
                    <span className={t.type === "buy" ? "font-semibold text-ink" : "font-semibold text-ok"}>
                      {t.type === "buy" ? "Alış" : "Satış"}
                    </span>{" "}
                    · {age(t.createdAt)}
                  </p>
                </div>
                <p className="num shrink-0 text-lg font-bold">{formatTL(t.price)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow text-muted">Kaydedilen teklifler</h2>
        {quotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">Henüz kaydedilen teklif yok.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {quotes.map(({ q, v, m }) => {
              const offers = (q.result as { offers?: PriceTriple }).offers;
              return (
                <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name} · {variantLabel(v)}
                    </p>
                    <p className="text-xs text-muted">
                      {q.mode === "buy" ? "Alış teklifi" : "Satış fiyatı"} · {age(q.createdAt)}
                    </p>
                  </div>
                  {offers && (
                    <p className="num shrink-0 text-right text-sm">
                      <span className="text-muted">{formatTL(offers.min)} · </span>
                      <strong className="text-lg">{formatTL(offers.mid)}</strong>
                      <span className="text-muted"> · {formatTL(offers.max)}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
