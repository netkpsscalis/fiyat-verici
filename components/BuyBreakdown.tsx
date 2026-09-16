import { ObservationList } from "@/components/ObservationList";
import { CONFIDENCE_LABELS } from "@/components/PriceTag";
import { adjustmentText, formatTL, sourceLabel } from "@/lib/format";
import type { BuyQuote, Reference } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/settings";

export const METHOD_LABELS: Record<Reference["method"], string> = {
  market: "2. el piyasa fiyatlarından",
  buyback: "Rakip alış tekliflerinden geri hesaplandı",
  new_depreciation: "Sıfır fiyattan yaşa göre tahmin edildi",
  none: "Veri yok",
};

/** "Bu fiyat nereden geldi?" dökümü */
export function BuyBreakdown({ quote, settings }: { quote: BuyQuote; settings: PricingSettings }) {
  const { reference: ref, adjustments: adj } = quote;
  const m = settings.buyMargins;

  return (
    <div className="space-y-5 text-sm">
      {quote.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-stop/40 bg-stop/5 px-3 py-2 text-stop">
          {quote.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <Row label="Kusursuz cihazın piyasa değeri" value={formatTL(ref.value)}>
        {METHOD_LABELS[ref.method]} · {CONFIDENCE_LABELS[ref.confidence]}
      </Row>
      <ObservationList items={ref.used} />

      <div>
        <p className="font-semibold">Durum kesintileri</p>
        {adj.applied.length === 0 ? (
          <p className="mt-1 text-muted">Kesinti yok: cihaz kusursuz kabul edildi.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-paper">
            {adj.applied.map((a) => (
              <li key={`${a.factorId}-${a.optionLabel}`} className="flex justify-between gap-3 px-3 py-2">
                <span>
                  {a.factorLabel}: <span className="text-muted">{a.optionLabel}</span>
                </span>
                <span className="font-mono">{adjustmentText(a)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Row label="Bu durumda satış tahmini" value={formatTL(quote.resale)}>
        Piyasa değeri × kesintiler
      </Row>

      {quote.competitor && (
        <Row label="Rakiplerin alış teklifi" value={formatTL(quote.competitor.adjusted)}>
          Kusursuz için {formatTL(quote.competitor.median)} ({quote.competitor.sources.map((s) => sourceLabel(s)).join(", ")}),
          bu durum için düzeltildi. Ortalama teklif bununla harmanlanır.
        </Row>
      )}

      <Row label="Kâr payları" value="">
        En çok teklifte %{m.max}, ortalamada %{m.mid}, en azda %{m.min}. Her cihazda en az {formatTL(settings.minProfit)} kâr
        bırakılır.
      </Row>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
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
