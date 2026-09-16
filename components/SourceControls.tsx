"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { addTrackedUrl, checkTrackedNow, deleteTrackedUrl, refreshAll, toggleSource } from "@/app/kaynaklar/actions";
import { Chip } from "@/components/Chip";
import { VariantSelect } from "@/components/VariantSelect";
import type { WarrantyType } from "@/lib/db/schema";
import type { CatalogBrand, CatalogModel } from "@/lib/types";

export function SourceToggle({ source, enabled }: { source: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={(e) => start(async () => void (await toggleSource(source, e.target.checked)))}
        className="size-4 accent-[var(--ink)]"
      />
      Her sabah otomatik oku
    </label>
  );
}

/** Mağaza fiyatlarını, takip linklerini ve öğrenme düzeltmesini bir seferde yeniler. */
export function RefreshAllButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const res = await refreshAll();
            setMessage(res.ok ? res.data.message : res.error);
          })
        }
        className="h-12 rounded-lg bg-ink px-5 font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "Güncelleniyor…" : "Fiyatları şimdi güncelle"}
      </button>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}

export function CheckTrackedButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await checkTrackedNow();
            setMessage(res.ok ? res.data.message : res.error);
          })
        }
        className="h-10 rounded-lg border border-ink px-4 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Okunuyor…" : "Linkleri şimdi kontrol et"}
      </button>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}

export function DeleteTrackedButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Linki sil"
      onClick={() => {
        if (confirm("Bu link takipten çıkarılsın mı?")) start(async () => void (await deleteTrackedUrl(id)));
      }}
      className="rounded-md p-2 text-muted hover:bg-ground hover:text-stop disabled:opacity-50"
    >
      <Trash2 aria-hidden size={16} />
    </button>
  );
}

const KINDS = [
  { id: "new_retail", label: "Sıfır satış fiyatı" },
  { id: "refurb_retail", label: "Yenilenmiş satış fiyatı" },
  { id: "used_listing", label: "2. el ilan" },
] as const;

export function TrackedUrlForm({ catalog }: { catalog: CatalogBrand[] }) {
  const [model, setModel] = useState<CatalogModel | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("new_retail");
  const [warranty, setWarranty] = useState<WarrantyType | null>("resmi");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId) return setMessage({ tone: "stop", text: "Model ve hafıza seç." });
    start(async () => {
      const res = await addTrackedUrl({ variantId, kind, url: url.trim(), warranty: kind === "new_retail" ? warranty : null });
      if (res.ok) {
        setMessage({ tone: "ok", text: `Link eklendi. ${res.data.message}` });
        setUrl("");
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-paper p-4 lg:p-6">
      <div>
        <h2 className="font-display text-xl font-bold [font-stretch:105%]">Ürün linki takip et</h2>
        <p className="mt-1 text-sm text-muted">
          Bir sitede bu cihazın ürün sayfasını aç, linkini buraya yapıştır; fiyatı her sabah okunur. Resmi sıfır fiyat için
          apple.com/tr ve samsung.com/tr ürün sayfaları okunabiliyor. Trendyol, Hepsiburada gibi bot korumalı siteler okunamaz;
          eklersen listede sebebiyle görünür.
        </p>
      </div>
      <VariantSelect
        catalog={catalog}
        modelId={model?.id ?? null}
        variantId={variantId}
        onChange={(m, v) => {
          setModel(m);
          setVariantId(v);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </Chip>
        ))}
      </div>
      {kind === "new_retail" && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={warranty === "resmi"} onClick={() => setWarranty("resmi")}>
            Resmi (TR) garantili
          </Chip>
          <Chip selected={warranty === "ithalatci"} onClick={() => setWarranty("ithalatci")}>
            İthalatçı garantili
          </Chip>
          <Chip selected={warranty === null} onClick={() => setWarranty(null)}>
            Belirtilmedi
          </Chip>
        </div>
      )}
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://"
        aria-label="Ürün linki"
        className="h-12 w-full rounded-lg border border-line bg-ground px-3 text-base"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !url} className="h-12 rounded-lg bg-ink px-6 font-semibold text-paper disabled:opacity-50">
          {pending ? "Link okunuyor…" : "Linki ekle"}
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
