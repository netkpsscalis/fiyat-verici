"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { fetchMarket, recordTransaction, saveQuote } from "@/app/actions";
import { BuyBreakdown } from "@/components/BuyBreakdown";
import { AddVariantChips } from "@/components/AddVariantChips";
import { Chip } from "@/components/Chip";
import { ListingPasteBox } from "@/components/ListingPasteBox";
import { ModelPicker, rememberModel } from "@/components/ModelPicker";
import { CONFIDENCE_LABELS, PriceTag } from "@/components/PriceTag";
import { RefreshSourcesButton } from "@/components/RefreshSourcesButton";
import { adjustmentText, formatAge, formatTL, parsePrice, variantLabel } from "@/lib/format";
import {
  adjustmentFor,
  defaultSelection,
  factorLabel,
  factorsFor,
  GROUPS,
  type Overrides,
  type Selection,
} from "@/lib/pricing/conditions";
import { computeBuyQuote, type BuyQuote } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/settings";
import type { CatalogBrand, CatalogModel, ObservationDTO } from "@/lib/types";

export function BuyWizard({
  catalog,
  settings,
  overrides,
}: {
  catalog: CatalogBrand[];
  settings: PricingSettings;
  overrides: Overrides;
}) {
  const [model, setModel] = useState<CatalogModel | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({});
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

  function reloadMarket() {
    if (!variantId) return;
    const id = variantId;
    startLoading(async () => setMarket({ variantId: id, rows: await fetchMarket(id) }));
  }

  const rows = market?.variantId === variantId ? market.rows : null;
  const quote = useMemo(
    () =>
      model && rows
        ? computeBuyQuote({
            observations: rows,
            family: model.family,
            releaseYear: model.releaseYear,
            selection,
            settings,
            overrides,
          })
        : null,
    [model, rows, selection, settings, overrides],
  );

  function pickModel(m: CatalogModel) {
    rememberModel(m.id);
    setModel(m);
    setSelection(defaultSelection(m.family));
    setVariantId(m.variants.length === 1 ? m.variants[0].id : null);
  }

  function reset() {
    setModel(null);
    setVariantId(null);
    setSelection({});
  }

  function choose(factorId: string, optionId: string, multi?: boolean) {
    setSelection((prev) => {
      if (!multi) return { ...prev, [factorId]: optionId };
      const cur = Array.isArray(prev[factorId]) ? (prev[factorId] as string[]) : [];
      return { ...prev, [factorId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
    });
  }

  const variant = model?.variants.find((v) => v.id === variantId) ?? null;
  const allModels = useMemo(() => catalog.flatMap((b) => b.models), [catalog]);
  const tagTitle = model ? `${model.name}${variant ? ` · ${variantLabel(variant)}` : ""}` : "";

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
      <div className="space-y-8">
        <header>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
            Cihaz al
          </h1>
          <p className="mt-2 text-muted">Cihazın durumunu işaretle, piyasaya göre ne teklif edeceğini gör.</p>
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
                onClick={reset}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-ground hover:text-ink"
              >
                <RotateCcw aria-hidden size={16} /> Başka cihaz
              </button>
            </section>

            <FactorBlock label={model.family === "iphone" ? "Hafıza" : "RAM ve hafıza"}>
              {model.variants.length === 0 ? (
                <AddVariantChips modelId={model.id} family={model.family} onAdded={setVariantId} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {model.variants.map((v) => (
                    <Chip key={v.id} selected={v.id === variantId} onClick={() => setVariantId(v.id)}>
                      {variantLabel(v)}
                    </Chip>
                  ))}
                </div>
              )}
            </FactorBlock>

            {variantId && variant && (
              <section aria-labelledby="piyasa-baslik" className="space-y-3">
                <h2 id="piyasa-baslik" className="eyebrow border-b border-line pb-2 text-muted">
                  Piyasa fiyatları
                </h2>
                <RefreshSourcesButton modelId={model.id} variantId={variantId} onDone={reloadMarket} />
                <ListingPasteBox
                  key={variantId}
                  model={model}
                  storageGb={variant.storageGb}
                  variantId={variantId}
                  models={allModels}
                  onSaved={reloadMarket}
                />
              </section>
            )}

            {variantId &&
              GROUPS.map((g) => {
                const factors = factorsFor(model.family).filter((f) => f.group === g.id);
                if (factors.length === 0) return null;
                return (
                  <section key={g.id} aria-labelledby={`grup-${g.id}`} className="space-y-5">
                    <h2 id={`grup-${g.id}`} className="eyebrow border-b border-line pb-2 text-muted">
                      {g.label}
                    </h2>
                    {factors.map((f) => {
                      const cur = selection[f.id];
                      return (
                        <FactorBlock key={f.id} label={factorLabel(f, model.family)} help={f.help}>
                          <div className="flex flex-wrap gap-2">
                            {f.options.map((o) => {
                              const selected = f.multi
                                ? Array.isArray(cur) && cur.includes(o.id)
                                : cur === o.id;
                              return (
                                <Chip
                                  key={o.id}
                                  selected={selected}
                                  onClick={() => choose(f.id, o.id, f.multi)}
                                  sub={o.blocking ? undefined : adjustmentText(adjustmentFor(f.id, o, overrides))}
                                  tone={o.blocking ? "stop" : "ink"}
                                >
                                  {o.label}
                                </Chip>
                              );
                            })}
                          </div>
                        </FactorBlock>
                      );
                    })}
                  </section>
                );
              })}

            {quote && (
              <section id="dokum" aria-labelledby="dokum-baslik" className="scroll-mt-4 space-y-4">
                <h2 id="dokum-baslik" className="eyebrow border-b border-line pb-2 text-muted">
                  Bu fiyat nereden geldi?
                </h2>
                <BuyBreakdown quote={quote} settings={settings} />
                {variantId && <QuoteActions quote={quote} variantId={variantId} selection={selection} />}
              </section>
            )}

            {/* Telefonda altta sabit duran etiketin arkasında içerik kalmasın */}
            {variantId && <div aria-hidden className="h-44 lg:hidden" />}
          </>
        )}
      </div>

      {model && variantId && (
        <>
          <aside className="hidden lg:sticky lg:top-8 lg:block">
            <BuyTag quote={quote} title={tagTitle} loading={loading} variantId={variantId} />
          </aside>
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-2 pb-2 lg:hidden">
            <BuyTag quote={quote} title={tagTitle} loading={loading} variantId={variantId} compact />
          </div>
        </>
      )}
    </div>
  );
}

function BuyTag({
  quote,
  title,
  loading,
  variantId,
  compact,
}: {
  quote: BuyQuote | null;
  title: string;
  loading: boolean;
  variantId: string;
  compact?: boolean;
}) {
  const blocked = quote?.adjustments.blocked.length ? quote.adjustments.blocked.join(", ") : undefined;
  const missing = quote?.adjustments.missing ?? [];
  const ref = quote?.reference;

  return (
    <PriceTag
      compact={compact}
      title="Alış teklifi"
      subtitle={title}
      prices={quote?.offers ?? null}
      notes={
        quote?.offers && quote.resale !== null
          ? [
              `kâr ${formatTL(quote.resale - quote.offers.min)}`,
              `kâr ${formatTL(quote.resale - quote.offers.mid)}`,
              `kâr ${formatTL(quote.resale - quote.offers.max)}`,
            ]
          : undefined
      }
      loading={loading}
      blocked={blocked}
      empty={
        !quote ? (
          "Fiyatlar yükleniyor…"
        ) : (
          <span>
            Bu model için fiyat verisi yok.{" "}
            <Link href={`/piyasa?variant=${variantId}`} className="underline underline-offset-2">
              Fiyat ekle
            </Link>
          </span>
        )
      }
      footer={
        quote?.offers && ref ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {missing.length > 0 && <strong className="text-tag-alert">{missing.join(", ")} seçilmedi · </strong>}
              Satış tahmini <strong className="num text-sm">{formatTL(quote.resale)}</strong> · {CONFIDENCE_LABELS[ref.confidence]} ·{" "}
              {ref.sampleCount} fiyat · {formatAge(ref.newestAgeDays)}
            </span>
            {compact && (
              <a href="#dokum" className="shrink-0 font-semibold underline underline-offset-2">
                Döküm
              </a>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

function FactorBlock({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      {help && <p className="mt-0.5 text-sm text-muted">{help}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function QuoteActions({ quote, variantId, selection }: { quote: BuyQuote; variantId: string; selection: Selection }) {
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [buyPrice, setBuyPrice] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Cihaz ya da durum değişince eski kayıt mesajı anlamını yitirir
  useEffect(() => {
    setQuoteId(null);
    setMessage(null);
  }, [variantId, selection]);

  if (!quote.offers) return null;
  const offers = quote.offers;

  function save() {
    start(async () => {
      const res = await saveQuote({
        mode: "buy",
        variantId,
        input: { selection },
        result: { offers, resale: quote.resale, reference: quote.reference.value, confidence: quote.reference.confidence },
      });
      if (res.ok) {
        setQuoteId(res.data.id);
        setMessage({ tone: "ok", text: "Teklif kaydedildi." });
      }
    });
  }

  function recordBuy() {
    const price = parsePrice(buyPrice || String(offers.mid));
    if (!price) {
      setMessage({ tone: "stop", text: "Alış fiyatını rakamla yaz. Örnek: 32.500" });
      return;
    }
    start(async () => {
      const res = await recordTransaction({ type: "buy", variantId, price, conditions: selection, quoteId });
      setMessage(res.ok ? { tone: "ok", text: `Alış kaydedildi: ${formatTL(price)}` } : { tone: "stop", text: res.error });
      if (res.ok) setBuyPrice("");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-paper p-4">
      <p className="font-semibold">Teklifi kaydet ya da alışı işle</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 rounded-lg border border-ink px-4 text-sm font-semibold disabled:opacity-60"
        >
          Teklifi kaydet
        </button>
        <div className="flex flex-1 gap-2">
          <input
            inputMode="numeric"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder={`Aldığın fiyat (${formatTL(offers.mid)})`}
            aria-label="Aldığın fiyat"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-base"
          />
          <button
            type="button"
            onClick={recordBuy}
            disabled={pending}
            className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-60"
          >
            Aldım
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
