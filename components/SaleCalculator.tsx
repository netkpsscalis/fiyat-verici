"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { fetchMarket, recordTransaction } from "@/app/actions";
import { Chip } from "@/components/Chip";
import { ModelPicker, rememberModel } from "@/components/ModelPicker";
import { ObservationList } from "@/components/ObservationList";
import { PriceTag } from "@/components/PriceTag";
import { QuickSellerPrice } from "@/components/QuickSellerPrice";
import { SellerList } from "@/components/SellerList";
import { RefreshSourcesButton } from "@/components/RefreshSourcesButton";
import type { WarrantyType } from "@/lib/db/schema";
import { formatTL, parsePrice, sourceLabel, variantLabel } from "@/lib/format";
import { computeSaleQuote } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/settings";
import type { CatalogBrand, CatalogModel, ObservationDTO } from "@/lib/types";

const WARRANTY_CHOICES: { id: WarrantyType | null; label: string }[] = [
  { id: "resmi", label: "Resmi (TR) garantili" },
  { id: "ithalatci", label: "İthalatçı garantili" },
  { id: null, label: "Hepsi" },
];

export function SaleCalculator({ catalog, settings }: { catalog: CatalogBrand[]; settings: PricingSettings }) {
  const [model, setModel] = useState<CatalogModel | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [warranty, setWarranty] = useState<WarrantyType | null>("resmi");
  const [market, setMarket] = useState<{ variantId: string; rows: ObservationDTO[] } | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!variantId) return;
    let alive = true;
    startLoading(async () => {
      const rows = await fetchMarket(variantId);
      if (alive) setMarket({ variantId, rows });
    });
    return () => {
      alive = false;
    };
  }, [variantId]);

  function pickModel(m: CatalogModel) {
    rememberModel(m.id);
    setModel(m);
    setVariantId(m.variants.length === 1 ? m.variants[0].id : null);
  }

  function reloadMarket() {
    if (!variantId) return;
    const id = variantId;
    startLoading(async () => setMarket({ variantId: id, rows: await fetchMarket(id) }));
  }

  const rows = market?.variantId === variantId ? market.rows : null;
  const quote = useMemo(() => (rows ? computeSaleQuote({ observations: rows, warranty, settings }) : null), [rows, warranty, settings]);
  const variant = model?.variants.find((v) => v.id === variantId);
  // Satıcı listesi: bütün sıfır fiyatlar, en ucuzdan pahalıya (garanti tipi satırda yazar)
  const sellerRows = (rows ?? []).filter((o) => o.kind === "new_retail");

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
            Sıfır sat
          </h1>
          <p className="mt-2 text-muted">Toptan maliyete ve piyasadaki fiyatlara göre satış fiyatını gör.</p>
        </header>

        {!model ? (
          <ModelPicker catalog={catalog} onPick={pickModel} />
        ) : (
          <>
            <section className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3">
              <div>
                <p className="eyebrow text-muted">
                  {model.brandName} · {model.releaseYear}
                </p>
                <p className="font-display text-xl font-bold [font-stretch:105%]">{model.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModel(null);
                  setVariantId(null);
                }}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-ground hover:text-ink"
              >
                <RotateCcw aria-hidden size={16} /> Başka cihaz
              </button>
            </section>

            <div>
              <p className="font-semibold">{model.family === "iphone" ? "Hafıza" : "RAM ve hafıza"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {model.variants.map((v) => (
                  <Chip key={v.id} selected={v.id === variantId} onClick={() => setVariantId(v.id)}>
                    {variantLabel(v)}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {model && variantId && (
        <div>
          <p className="font-semibold">Garanti</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WARRANTY_CHOICES.map((w) => (
              <Chip key={w.label} selected={warranty === w.id} onClick={() => setWarranty(w.id)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </div>
        )}

        {quote && variantId && (
          <>
            <div className="lg:hidden">
              <SaleTag
                quote={quote}
                title={model && variant ? `${model.name} · ${variantLabel(variant)}` : ""}
                loading={loading}
                variantId={variantId}
                compact
              />
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <h2 className="eyebrow text-muted">
                  Satıcı fiyatları{sellerRows.length ? ` · ${sellerRows.length} mağaza` : ""} · ucuzdan pahalıya
                </h2>
                {model && <RefreshSourcesButton modelId={model.id} variantId={variantId} onDone={reloadMarket} />}
              </div>
              {sellerRows.length > 0 ? (
                <SellerList items={sellerRows} />
              ) : (
                <p className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-sm text-muted">
                  Bu cihaz için satıcı fiyatı yok. &ldquo;Kaynakları güncelle&rdquo; Vatan fiyatını çeker; diğer mağazaları
                  aşağıdan elle ekleyebilirsin.
                </p>
              )}
              <QuickSellerPrice variantId={variantId} warranty={warranty} onAdded={reloadMarket} />
              <p className="text-xs text-muted">
                Vatan otomatik güncellenir. Media Markt, PTT AVM, Hepsiburada gibi siteler otomatik okumayı engellediği için
                onların fiyatını elle ekle; eklediğin fiyat listede sıraya girer.
              </p>
            </section>

            <section className="space-y-4 text-sm">
              <h2 className="eyebrow border-b border-line pb-2 text-muted">Bu fiyat nereden geldi?</h2>
              {quote.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-stop/40 bg-stop/5 px-3 py-2 text-stop">
                  {quote.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {quote.cost && (
                <Line label={quote.cost.estimated ? "Tahmini maliyet" : "Toptan maliyet (en ucuz)"} value={formatTL(quote.cost.value)}>
                  {quote.cost.estimated
                    ? `Piyasadaki en düşük fiyatın %${Math.round(settings.newSale.wholesaleFromRetail * 100)}'i`
                    : `${quote.cost.count} toptancı fiyatı · ortalama ${formatTL(quote.cost.median)}`}
                </Line>
              )}
              {quote.retail && (
                <Line label="Piyasa perakende (ortalama)" value={formatTL(quote.retail.median)}>
                  En düşük {formatTL(quote.retail.min)} · {quote.retail.count} fiyat ·{" "}
                  {quote.retail.sources.map((s) => sourceLabel(s)).join(", ")}
                </Line>
              )}
              <Line label="Kâr ayarı" value="">
                Maliyet üstüne %{settings.newSale.margin}, en az {formatTL(settings.newSale.minProfit)} kâr. Ortalama fiyat piyasa
                ortalamasını geçmez.
              </Line>
              <ObservationList items={quote.used} />
              <SaleRecord variantId={variantId} warranty={warranty} suggested={quote.prices?.mid ?? null} />
            </section>
          </>
        )}
      </div>

      {quote && variantId && (
        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <SaleTag quote={quote} title={model && variant ? `${model.name} · ${variantLabel(variant)}` : ""} loading={loading} variantId={variantId} />
        </aside>
      )}
    </div>
  );
}

function SaleTag({
  quote,
  title,
  loading,
  variantId,
  compact,
}: {
  quote: ReturnType<typeof computeSaleQuote>;
  title: string;
  loading: boolean;
  variantId: string;
  compact?: boolean;
}) {
  return (
    <PriceTag
      compact={compact}
      title="Satış fiyatı"
      subtitle={title}
      prices={quote.prices}
      loading={loading}
      empty={
        <span>
          Bu model için sıfır fiyat verisi yok.{" "}
          <Link href={`/piyasa?variant=${variantId}`} className="underline underline-offset-2">
            Fiyat ekle
          </Link>
        </span>
      }
      footer={
        quote.cost ? (
          <span>
            Maliyet <strong className="num text-sm">{formatTL(quote.cost.value)}</strong>
            {quote.cost.estimated ? " (tahmini)" : ""}
            {quote.retail ? (
              <>
                {" "}
                · piyasa ort. <strong className="num text-sm">{formatTL(quote.retail.median)}</strong>
              </>
            ) : null}
          </span>
        ) : undefined
      }
    />
  );
}

function Line({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{label}</p>
        {value && <p className="num text-lg font-bold">{value}</p>}
      </div>
      {children && <p className="mt-0.5 text-muted">{children}</p>}
    </div>
  );
}

function SaleRecord({ variantId, warranty, suggested }: { variantId: string; warranty: WarrantyType | null; suggested: number | null }) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function record() {
    const p = parsePrice(price || String(suggested ?? ""));
    if (!p) {
      setMessage({ tone: "stop", text: "Satış fiyatını rakamla yaz. Örnek: 64.900" });
      return;
    }
    start(async () => {
      const res = await recordTransaction({ type: "sell", variantId, price: p, isNew: true, warranty });
      setMessage(res.ok ? { tone: "ok", text: `Satış kaydedildi: ${formatTL(p)}` } : { tone: "stop", text: res.error });
      if (res.ok) setPrice("");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-paper p-4">
      <p className="font-semibold">Sattıysan kaydet</p>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={suggested ? `Sattığın fiyat (${formatTL(suggested)})` : "Sattığın fiyat"}
          aria-label="Sattığın fiyat"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-base"
        />
        <button
          type="button"
          onClick={record}
          disabled={pending}
          className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-60"
        >
          Sattım
        </button>
      </div>
      {message && (
        <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
