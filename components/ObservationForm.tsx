"use client";

import { useState, useTransition } from "react";
import { addObservation } from "@/app/actions";
import { Chip } from "@/components/Chip";
import { VariantSelect } from "@/components/VariantSelect";
import type { ObservationKind, WarrantyType } from "@/lib/db/schema";
import { formatTL, KIND_LABELS, parsePrice, SOURCE_LABELS, WARRANTY_LABELS } from "@/lib/format";
import type { CatalogBrand, CatalogModel } from "@/lib/types";

const KINDS: { id: ObservationKind; source: string }[] = [
  { id: "used_listing", source: "sahibinden" },
  { id: "new_retail", source: "akakce" },
  { id: "new_wholesale", source: "supplier" },
  { id: "buyback", source: "easycep" },
  { id: "refurb_retail", source: "getmobil" },
  { id: "own_sell", source: "own" },
  { id: "own_buy", source: "own" },
];

const SOURCES = ["sahibinden", "letgo", "dolap", "akakce", "cimri", "easycep", "getmobil", "supplier", "own", "manual"];
const USED_KINDS: ObservationKind[] = ["used_listing", "buyback", "refurb_retail", "own_sell", "own_buy"];

const inputClass = "h-12 w-full rounded-lg border border-line bg-paper px-3 text-base";

export function ObservationForm({ catalog, initialVariantId }: { catalog: CatalogBrand[]; initialVariantId?: string }) {
  const initialModel =
    catalog.flatMap((b) => b.models).find((m) => m.variants.some((v) => v.id === initialVariantId)) ?? null;
  const [model, setModel] = useState<CatalogModel | null>(initialModel);
  const [variantId, setVariantId] = useState<string | null>(initialModel ? initialVariantId! : null);
  const [kind, setKind] = useState<ObservationKind>("used_listing");
  const [source, setSource] = useState("sahibinden");
  const [price, setPrice] = useState("");
  const [warranty, setWarranty] = useState<WarrantyType | null>(null);
  const [condition, setCondition] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = parsePrice(price);
    if (!variantId) return setMessage({ tone: "stop", text: "Model ve hafıza seç." });
    if (!p) return setMessage({ tone: "stop", text: "Fiyatı rakamla yaz. Örnek: 38.750" });
    start(async () => {
      const res = await addObservation({ variantId, kind, source, price: p, warranty, condition, url, note });
      if (res.ok) {
        setMessage({ tone: "ok", text: `Eklendi: ${KIND_LABELS[kind]} ${formatTL(p)}` });
        setPrice("");
        setUrl("");
        setNote("");
        setCondition("");
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-line bg-paper p-4 lg:p-6">
      <h2 className="font-display text-xl font-bold [font-stretch:105%]">Fiyat ekle</h2>

      <VariantSelect
        catalog={catalog}
        modelId={model?.id ?? null}
        variantId={variantId}
        onChange={(m, v) => {
          setModel(m);
          setVariantId(v);
        }}
      />

      <fieldset>
        <legend className="font-semibold">Ne fiyatı?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Chip
              key={k.id}
              selected={kind === k.id}
              onClick={() => {
                setKind(k.id);
                setSource(k.source);
              }}
            >
              {KIND_LABELS[k.id]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Fiyat (₺)</span>
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="38.750"
            className={`${inputClass} num mt-1 text-xl font-bold`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Kaynak</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputClass} mt-1`}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s === "manual" ? "Diğer" : SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="font-semibold">Garanti</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip selected={warranty === null} onClick={() => setWarranty(null)}>
            Belirtilmedi
          </Chip>
          {(Object.keys(WARRANTY_LABELS) as WarrantyType[]).map((w) => (
            <Chip key={w} selected={warranty === w} onClick={() => setWarranty(w)}>
              {WARRANTY_LABELS[w]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {USED_KINDS.includes(kind) && (
          <label className="block">
            <span className="text-sm font-semibold">Durum</span>
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="A kalite, pil %88"
              className={`${inputClass} mt-1`}
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-semibold">İlan / sayfa bağlantısı</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Not</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1`} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-lg bg-ink px-6 font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Ekleniyor…" : "Fiyatı ekle"}
        </button>
        {message && (
          <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
