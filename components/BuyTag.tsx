"use client";

import clsx from "clsx";
import { formatAge, formatNumber, formatTL, sourceLabel } from "@/lib/format";
import type { BuyQuote, Confidence, PriceTriple } from "@/lib/pricing/engine";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  yuksek: "Güven yüksek",
  orta: "Güven orta",
  dusuk: "Güven düşük",
  yok: "Veri yok",
};

/** Piyasa satırının adı: sadece Getmobil varsa "Getmobil", ilan da varsa kaynaklar yan yana */
function marketLabel(quote: BuyQuote): string {
  const sources = [...new Set(quote.reference.used.map((u) => sourceLabel(u.source)))];
  if (sources.length === 0) return "Piyasa";
  if (sources.length <= 2) return sources.join(" + ");
  return `${sources[0]} +${sources.length - 1}`;
}

/**
 * Sarı alış etiketi, iki satır: piyasadan (Getmobil/ilanlar) hesaplanan teklif ve
 * kullanıcının "bunu kaça satarım" diye yazdığı fiyattan hesaplanan teklif.
 */
export function BuyTag({
  quote,
  title,
  loading,
  ownPriceText,
  onOwnPriceChange,
  ownOffers,
  ownResale,
  compact,
}: {
  quote: BuyQuote | null;
  title: string;
  loading: boolean;
  ownPriceText: string;
  onOwnPriceChange: (v: string) => void;
  ownOffers: PriceTriple | null;
  ownResale: number | null;
  compact?: boolean;
}) {
  const blocked = quote?.adjustments.blocked.length ? quote.adjustments.blocked.join(", ") : undefined;
  if (blocked) {
    return (
      <div className={clsx("price-tag bg-stop! text-white", compact ? "px-5 pt-5 pb-3" : "px-6 pt-8 pb-6")}>
        <p className="eyebrow pl-4">Alış teklifi</p>
        <p className={clsx("font-display font-black uppercase leading-none [font-stretch:120%]", compact ? "mt-1 text-3xl" : "mt-3 text-5xl")}>
          Alınmaz
        </p>
        <p className="mt-2 text-sm">{blocked}</p>
      </div>
    );
  }

  const ref = quote?.reference;
  const missing = quote?.adjustments.missing ?? [];

  return (
    <div className={clsx("price-tag", compact ? "px-3 pt-2.5 pb-2.5" : "px-5 pt-6 pb-5")} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 pl-5">
        <p className="eyebrow shrink-0">Alış teklifi</p>
        {/* Model adı büyük harfe çevrilmez: Türkçede "iPhone" → "İPHONE" olur */}
        <p className="min-w-0 truncate font-mono text-[0.7rem] opacity-75">{title}</p>
      </div>

      <div
        className={clsx(
          "grid grid-cols-[5.4rem_1fr_1fr_1fr] items-end gap-x-1.5 min-[400px]:grid-cols-[6rem_1fr_1fr_1fr]",
          compact ? "mt-1" : "mt-4",
        )}
      >
        <span />
        {["En az", "Ortalama", "En çok"].map((l, i) => (
          <p key={l} className={clsx("eyebrow truncate opacity-75", i === 1 && "text-center", i === 2 && "text-right")}>
            {l}
          </p>
        ))}
      </div>

      <OfferRow
        label={quote ? marketLabel(quote) : "Piyasa"}
        sub={
          quote?.resale != null ? (
            <>
              satış <span className="num">{formatTL(quote.resale)}</span>
            </>
          ) : undefined
        }
        offers={quote?.offers ?? null}
        resale={quote?.resale ?? null}
        loading={loading}
        compact={compact}
        empty={!quote ? "Fiyatlar yükleniyor…" : "Fiyat verisi yok"}
      />

      <OfferRow
        label="Senin fiyatın"
        sub={
          <label className="flex items-center gap-1">
            <span className="sr-only">Bu cihazı kaça satarsın</span>
            <input
              inputMode="numeric"
              value={ownPriceText}
              onChange={(e) => onOwnPriceChange(e.target.value)}
              onBlur={() => {
                const n = Number(ownPriceText.replace(/\D/g, ""));
                if (n) onOwnPriceChange(formatNumber(n));
              }}
              placeholder="Satış ₺"
              className="num h-7 w-full min-w-0 rounded border border-tag-ink/30 bg-white/45 px-1.5 text-[0.8rem] font-bold text-tag-ink placeholder:font-normal placeholder:text-tag-ink/60"
            />
          </label>
        }
        offers={ownOffers}
        resale={ownResale}
        compact={compact}
        empty="Satış fiyatını yaz, teklif çıksın"
      />

      {quote?.offers && ref && (
        <div className={clsx("flex items-center justify-between gap-2 border-t border-tag-ink/15 text-xs", compact ? "mt-1.5 pt-1" : "mt-4 pt-3")}>
          <span className="truncate">
            {missing.length > 0 && <strong className="text-tag-alert">{missing.join(", ")} seçilmedi · </strong>}
            {CONFIDENCE_LABELS[ref.confidence]} · {ref.sampleCount} fiyat · {formatAge(ref.newestAgeDays)}
          </span>
          {compact && (
            <a href="#dokum" className="shrink-0 font-semibold underline underline-offset-2">
              Döküm
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function OfferRow({
  label,
  sub,
  offers,
  resale,
  loading,
  compact,
  empty,
}: {
  label: string;
  sub?: React.ReactNode;
  offers: PriceTriple | null;
  resale: number | null;
  loading?: boolean;
  compact?: boolean;
  empty: string;
}) {
  return (
    <div
      className={clsx(
        "grid grid-cols-[5.4rem_1fr_1fr_1fr] items-center gap-x-1.5 border-t border-tag-ink/15 min-[400px]:grid-cols-[6rem_1fr_1fr_1fr]",
        compact ? "mt-1 pt-1" : "mt-2 pt-2",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[0.66rem] font-extrabold uppercase leading-tight tracking-wide">{label}</p>
        {sub && <div className="mt-0.5 truncate text-[0.68rem] leading-tight opacity-80">{sub}</div>}
      </div>
      {offers && resale !== null ? (
        (["min", "mid", "max"] as const).map((k, i) => (
          <div key={k} className={clsx("min-w-0", i === 1 && "text-center", i === 2 && "text-right", loading && "opacity-50")}>
            <p
              key={offers[k]}
              className={clsx(
                "num tick font-extrabold leading-none tracking-tight whitespace-nowrap",
                i === 1
                  ? compact
                    ? "text-lg min-[400px]:text-xl"
                    : "text-2xl"
                  : compact
                    ? "text-[0.95rem] min-[400px]:text-base"
                    : "text-xl",
              )}
            >
              {formatTL(offers[k])}
            </p>
            <p className="num mt-0.5 truncate text-[0.65rem] font-semibold opacity-75">kâr {formatTL(resale - offers[k])}</p>
          </div>
        ))
      ) : (
        <p className="col-span-3 text-sm font-medium opacity-80">{empty}</p>
      )}
    </div>
  );
}
