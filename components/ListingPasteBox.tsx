"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { addListingPrices } from "@/app/actions";
import { Chip } from "@/components/Chip";
import { formatTL } from "@/lib/format";
import { parseListingPaste, type ListingPasteResult } from "@/lib/parsers/listingPaste";
import type { CatalogModel } from "@/lib/types";

const PLATFORMS = [
  { id: "sahibinden", label: "Sahibinden", at: "Sahibinden’de", search: (q: string) => `https://www.sahibinden.com/cep-telefonu?query_text=${q}` },
  { id: "dolap", label: "Dolap", at: "Dolap’ta", search: (q: string) => `https://dolap.com/ara?q=${q}` },
  { id: "letgo", label: "Letgo", at: "Letgo’da", search: (q: string) => `https://www.letgo.com/arama?q=${q}` },
  { id: "facebook", label: "Facebook", at: "Facebook’ta", search: (q: string) => `https://www.facebook.com/marketplace/search?query=${q}` },
  { id: "diger", label: "Diğer", at: "", search: null },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

/**
 * İlan sitelerinde aynı cihazın arama sonucunu kopyalayıp yapıştırma.
 * Siteler bot korumalı olduğu için uygulama oraya istek atmaz; kullanıcının kopyaladığı metni okur.
 * İlan fiyatı, dükkanın o cihazı satabileceği fiyat sayılır; alış teklifi bunun altından verilir.
 */
export function ListingPasteBox({
  model,
  storageGb,
  variantId,
  models,
  onSaved,
}: {
  model: CatalogModel;
  storageGb: number;
  variantId: string;
  models: CatalogModel[];
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState<PlatformId>("sahibinden");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ListingPasteResult | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const query = encodeURIComponent(`${model.name} ${storageGb >= 1024 ? `${storageGb / 1024} TB` : `${storageGb} GB`}`);
  const stats = useMemo(() => {
    if (!result?.kept.length) return null;
    const p = result.kept.map((k) => k.price).sort((a, b) => a - b);
    const m = p.length / 2;
    return { min: p[0], max: p[p.length - 1], median: p.length % 2 ? p[Math.floor(m)] : (p[m - 1] + p[m]) / 2 };
  }, [result]);

  function read(source = text) {
    const r = parseListingPaste(source, { model, storageGb }, models);
    setResult(r);
    setMessage(
      r.kept.length
        ? null
        : { tone: "stop", text: "Uygun ilan bulunamadı. Arama sonuç sayfasını başlıklar ve fiyatlarla birlikte kopyala." },
    );
  }

  function save() {
    if (!result?.kept.length) return;
    start(async () => {
      const res = await addListingPrices({ variantId, platform, prices: result.kept.map((k) => k.price) });
      if (res.ok) {
        setMessage({ tone: "ok", text: `${res.data.count} ilan eklendi, ortanca ${formatTL(res.data.median)}. Teklif güncellendi.` });
        setResult(null);
        setText("");
        onSaved();
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  const skipped = result?.skipped;
  const skippedText = skipped
    ? [
        skipped.damaged && `${skipped.damaged} hasarlı/kilitli`,
        skipped.otherModel && `${skipped.otherModel} başka model`,
        skipped.otherStorage && `${skipped.otherStorage} başka hafıza`,
        skipped.outlier && `${skipped.outlier} uç fiyat`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const link = PLATFORMS.find((p) => p.id === platform)?.search;

  return (
    <details className="rounded-lg border border-line bg-paper">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">İlan fiyatlarını yapıştır (Sahibinden, Dolap, Letgo…)</summary>
      <div className="space-y-3 border-t border-line p-3">
        <p className="text-sm text-muted">
          İlandaki fiyat, bu cihazı dükkanda satabileceğin fiyat sayılır; teklif bunun altından, kârını bırakacak şekilde
          verilir. Aramayı aç, sonuçları seçip kopyala, buraya yapıştır. Hasarlı, kilitli, başka model ve başka hafızalı ilanlar
          atlanır.
        </p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Chip key={p.id} selected={platform === p.id} onClick={() => setPlatform(p.id)}>
              {p.label}
            </Chip>
          ))}
        </div>
        {link && (
          <a
            href={link(query)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
          >
            {PLATFORMS.find((p) => p.id === platform)?.at} “{decodeURIComponent(query)}” ara
            <ExternalLink aria-hidden size={14} />
          </a>
        )}
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
          placeholder={`${model.name} ${storageGb} GB temiz\n26.000 TL\n${model.name} ${storageGb} GB pil %88\n25.500 TL`}
          className="w-full rounded-lg border border-line bg-ground px-3 py-2 font-mono text-sm"
        />

        {stats && result && (
          <div className="rounded-lg border border-line px-3 py-2 text-sm">
            <p>
              <strong>{result.kept.length} ilan</strong> · en düşük <span className="num">{formatTL(stats.min)}</span> · ortanca{" "}
              <strong className="num">{formatTL(stats.median)}</strong> · en yüksek <span className="num">{formatTL(stats.max)}</span>
            </p>
            {skippedText && <p className="mt-0.5 text-muted">Atlanan: {skippedText}</p>}
          </div>
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
            disabled={pending || !result?.kept.length}
            className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {pending ? "Kaydediliyor…" : result?.kept.length ? `${result.kept.length} ilanı ekle` : "Ekle"}
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
