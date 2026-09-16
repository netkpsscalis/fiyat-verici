"use client";

import { useState, useTransition } from "react";
import { addPastedPrices } from "@/app/actions";
import { formatTL, WARRANTY_LABELS } from "@/lib/format";
import { parseSellerPaste, type PastedOffer } from "@/lib/parsers/sellerPaste";

/**
 * Epey/Akakçe gibi sayfalardaki satıcı listesini kopyalayıp yapıştırma.
 * Siteye istek atılmaz; yapıştırılan metin okunur.
 */
export function SellerPasteBox({ variantId, onSaved }: { variantId: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [offers, setOffers] = useState<PastedOffer[] | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function read(source = text) {
    const rows = parseSellerPaste(source);
    setOffers(rows);
    setMessage(rows.length ? null : { tone: "stop", text: "Metinde satıcı fiyatı bulunamadı. Listeyi mağaza adlarıyla birlikte kopyala." });
  }

  function save() {
    if (!offers?.length) return;
    start(async () => {
      const res = await addPastedPrices({
        variantId,
        offers: offers.map((o) => ({ seller: o.seller, price: o.price, warranty: o.warranty, title: o.title })),
      });
      if (res.ok) {
        setMessage({ tone: "ok", text: `${res.data.count} satıcı fiyatı eklendi.` });
        setOffers(null);
        setText("");
        onSaved();
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  return (
    <details className="rounded-lg border border-line bg-paper">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">Fiyat listesi yapıştır (Epey, Akakçe…)</summary>
      <div className="space-y-3 border-t border-line p-3">
        <p className="text-sm text-muted">
          O cihazın fiyat karşılaştırma sayfasını aç, satıcı listesini seçip kopyala ve buraya yapıştır. Mağaza adı, fiyat ve
          garanti bilgisi okunup listeye eklenir.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.trim()) {
              e.preventDefault();
              setText(pasted);
              read(pasted);
            }
          }}
          rows={5}
          placeholder={"Satıcı: Trendyol | Renk: Gri\n15.899,00 TL\nSatıcı: n11 | Distribütör Garantili\n16.174,08 TL"}
          className="w-full rounded-lg border border-line bg-ground px-3 py-2 font-mono text-sm"
        />

        {offers && offers.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {offers.map((o, i) => (
              <li key={`${o.seller}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <strong>{o.seller}</strong>
                  <span className="text-muted">
                    {o.warranty ? ` · ${WARRANTY_LABELS[o.warranty]}` : ""}
                    {o.shipping ? ` · +${formatTL(o.shipping)} kargo` : ""}
                  </span>
                </span>
                <span className="num shrink-0 font-bold">{formatTL(o.price)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => read()}
            disabled={!text.trim() || pending}
            className="h-11 rounded-lg border border-ink px-4 text-sm font-semibold disabled:opacity-50"
          >
            Oku
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !offers?.length}
            className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {pending ? "Kaydediliyor…" : offers?.length ? `${offers.length} fiyatı kaydet` : "Kaydet"}
          </button>
          {message && (
            <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
