"use client";

import { useState, useTransition } from "react";
import { addObservation } from "@/app/actions";
import type { WarrantyType } from "@/lib/db/schema";
import { formatTL, parsePrice, sourceLabel } from "@/lib/format";

/** Otomatik okunamayan mağazaların fiyatını elle, hızlıca eklemek için. */
const STORES = ["mediamarkt", "pttavm", "teknosa", "hepsiburada", "trendyol", "n11", "amazon", "vatan", "apple", "samsung"];

export function QuickSellerPrice({
  variantId,
  warranty,
  onAdded,
}: {
  variantId: string;
  warranty: WarrantyType | null;
  onAdded: () => void;
}) {
  const [store, setStore] = useState(STORES[0]);
  const [custom, setCustom] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const p = parsePrice(price);
    const source = store === "diger" ? custom.trim().toLocaleLowerCase("tr").replace(/\s+/g, "-") : store;
    if (!p) return setMessage({ tone: "stop", text: "Fiyatı rakamla yaz." });
    if (!source) return setMessage({ tone: "stop", text: "Mağaza adını yaz." });
    start(async () => {
      const res = await addObservation({ variantId, kind: "new_retail", source, price: p, warranty });
      if (res.ok) {
        setMessage({ tone: "ok", text: `${sourceLabel(source)}: ${formatTL(p)} eklendi.` });
        setPrice("");
        onAdded();
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-paper p-3">
      <p className="text-sm font-semibold">Gördüğün bir fiyatı ekle</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          aria-label="Mağaza"
          className="h-11 min-w-32 flex-1 rounded-lg border border-line bg-ground px-2 text-base"
        >
          {STORES.map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s)}
            </option>
          ))}
          <option value="diger">Diğer…</option>
        </select>
        {store === "diger" && (
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Mağaza adı"
            aria-label="Mağaza adı"
            className="h-11 min-w-28 flex-1 rounded-lg border border-line bg-ground px-3 text-base"
          />
        )}
        <input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Fiyat"
          aria-label="Fiyat"
          className="num h-11 w-28 rounded-lg border border-line bg-ground px-2 text-right text-lg font-bold"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-60"
        >
          Ekle
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
