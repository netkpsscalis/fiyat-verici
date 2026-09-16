"use client";

import clsx from "clsx";
import { useMemo, useState, useTransition } from "react";
import { saveSupplierPrices } from "@/app/toptanci/actions";
import { Chip } from "@/components/Chip";
import { VariantSelect } from "@/components/VariantSelect";
import type { WarrantyType } from "@/lib/db/schema";
import { formatNumber, formatTL, parsePrice, variantLabel, WARRANTY_LABELS } from "@/lib/format";
import { aliasCandidate, parsePriceList, type ParsedRow, type RowStatus } from "@/lib/parsers/priceList";
import type { CatalogBrand, CatalogModel } from "@/lib/types";

interface Draft {
  key: string;
  row: ParsedRow;
  include: boolean;
  priceText: string;
  /** Kullanıcının düzelttiği model/varyant */
  model: CatalogModel | null;
  variantId: string | null;
  editing: boolean;
  remember: boolean;
}

const STATUS_LABELS: Record<RowStatus, string> = {
  ok: "Hazır",
  no_model: "Model bulunamadı",
  no_variant: "Hafıza bulunamadı",
  ambiguous: "RAM belirsiz",
  no_price: "Fiyat yok",
};

const DEFAULT_WARRANTIES: { id: WarrantyType | null; label: string }[] = [
  { id: "resmi", label: "Resmi (TR)" },
  { id: "ithalatci", label: "İthalatçı" },
  { id: null, label: "Belirtilmedi" },
];

export function PriceListImport({
  catalog,
  suppliers,
  learned,
}: {
  catalog: CatalogBrand[];
  suppliers: { id: number; name: string }[];
  learned: { alias: string; modelId: string }[];
}) {
  const models = useMemo(() => catalog.flatMap((b) => b.models), [catalog]);
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const [supplier, setSupplier] = useState<string>(suppliers[0] ? String(suppliers[0].id) : "new");
  const [newName, setNewName] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaultWarranty, setDefaultWarranty] = useState<WarrantyType | null>("resmi");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function read(source = text) {
    const rows = parsePriceList(source, models, learned);
    setDrafts(
      rows.map((row, i) => ({
        key: `${row.line}-${i}`,
        row,
        include: row.status === "ok" && !row.used,
        priceText: row.price ? formatNumber(row.price) : "",
        model: row.modelId ? (byId.get(row.modelId) ?? null) : null,
        variantId: row.variantId,
        editing: false,
        remember: row.status === "no_model",
      })),
    );
    setMessage(rows.length ? null : { tone: "stop", text: "Listede fiyat satırı bulunamadı." });
  }

  async function onFile(file: File) {
    setMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const body = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !body.text) {
        setMessage({ tone: "stop", text: body.error ?? "Dosya okunamadı." });
        return;
      }
      setText(body.text);
      setFileName(file.name);
      read(body.text);
    });
  }

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  }

  const resolved = (drafts ?? []).map((d) => {
    const price = parsePrice(d.priceText);
    const valid = Boolean(d.variantId && price);
    return { d, price, valid, warranty: d.row.warranty ?? defaultWarranty };
  });
  const ready = resolved.filter((r) => r.d.include && r.valid);
  const needsFix = resolved.filter((r) => !r.valid && !r.d.row.used).length;

  function save() {
    const supplierId = supplier === "new" ? null : Number(supplier);
    const aliases = resolved
      .filter((r) => r.d.include && r.valid && r.d.remember && r.d.row.status === "no_model" && r.d.model)
      .map((r) => ({ alias: aliasCandidate(r.d.row.raw), modelId: r.d.model!.id }))
      .filter((a) => a.alias.length >= 2);
    start(async () => {
      const res = await saveSupplierPrices({
        supplierId,
        newSupplierName: supplier === "new" ? newName : null,
        rawText: text,
        fileName,
        rows: ready.map((r) => ({ variantId: r.d.variantId!, price: r.price!, warranty: r.warranty })),
        aliases,
      });
      if (res.ok) {
        setMessage({ tone: "ok", text: `${res.data.count} fiyat kaydedildi.` });
        // Yeni eklenen toptancı seçili kalsın; bir sonraki liste aynı toptancıya gitsin
        setSupplier(String(res.data.supplierId));
        setNewName("");
        setDrafts(null);
        setText("");
        setFileName(null);
      } else setMessage({ tone: "stop", text: res.error });
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-lg border border-line bg-paper p-4 lg:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Toptancı</span>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-line bg-paper px-3 text-base"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="new">+ Yeni toptancı</option>
            </select>
          </label>
          {supplier === "new" && (
            <label className="block">
              <span className="text-sm font-semibold">Yeni toptancının adı</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn. Merkez GSM"
                className="mt-1 h-12 w-full rounded-lg border border-line bg-paper px-3 text-base"
              />
            </label>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-semibold">WhatsApp listesini yapıştır</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            rows={8}
            placeholder={"📱 APPLE TR GARANTİLİ\n15 PRO MAX 256 78.500\n16 PRO 128 58.000 | 256 64.500\nS24 ULTRA 12/256 54.900"}
            className="mt-1 w-full rounded-lg border border-line bg-ground px-3 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-ink px-4 text-sm font-semibold">
            Dosyadan yükle
            <input
              type="file"
              accept=".xlsx,.csv,.txt,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-sm text-muted">Excel (.xlsx), CSV veya PDF. Resim listeler henüz okunmuyor.</span>
        </div>

        <div>
          <p className="text-sm font-semibold">Satırda garanti yazmıyorsa</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEFAULT_WARRANTIES.map((w) => (
              <Chip key={w.label} selected={defaultWarranty === w.id} onClick={() => setDefaultWarranty(w.id)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => read()}
            disabled={!text.trim() || pending}
            className="h-12 rounded-lg bg-ink px-6 font-semibold text-paper disabled:opacity-50"
          >
            Listeyi oku
          </button>
          {fileName && <span className="font-mono text-xs text-muted">{fileName}</span>}
          {message && !drafts && (
            <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
              {message.text}
            </p>
          )}
        </div>
      </section>

      {drafts && drafts.length > 0 && (
        <section aria-labelledby="onizleme" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="onizleme" className="font-display text-xl font-bold [font-stretch:105%]">
              Önizleme
            </h2>
            <p className="text-sm text-muted">
              {drafts.length} satır · <strong className="text-ink">{ready.length} kaydedilecek</strong>
              {needsFix > 0 && <span className="text-stop"> · {needsFix} düzeltilmeli</span>}
            </p>
          </div>

          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {resolved.map(({ d, valid, warranty }) => {
              const variant = d.model?.variants.find((v) => v.id === d.variantId);
              const status: RowStatus | "fixed" = valid && d.row.status !== "ok" ? "fixed" : valid ? "ok" : d.row.status;
              return (
                <li key={d.key} className={clsx("space-y-2 px-3 py-3", !d.include && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={d.include}
                      disabled={!valid}
                      onChange={(e) => update(d.key, { include: e.target.checked })}
                      aria-label="Bu satırı kaydet"
                      className="mt-1 size-5 accent-[var(--ink)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-muted">
                        {d.row.line}. {d.row.raw}
                      </p>
                      <p className="mt-0.5 font-medium">
                        {d.model ? d.model.name : "—"}
                        {variant ? ` · ${variantLabel(variant)}` : d.row.storageGb ? ` · ${d.row.storageGb} GB?` : ""}
                        <span className="font-normal text-muted"> · {warranty ? WARRANTY_LABELS[warranty] : "Garanti belirtilmedi"}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs">
                        <StatusBadge status={status} />
                        {d.row.used && <span className="rounded bg-stop/10 px-1.5 py-0.5 font-medium text-stop">2. el ifadesi var</span>}
                        <button
                          type="button"
                          onClick={() => update(d.key, { editing: !d.editing })}
                          className="font-semibold underline underline-offset-2"
                        >
                          {d.editing ? "Kapat" : "Düzelt"}
                        </button>
                      </p>
                    </div>
                    <input
                      inputMode="numeric"
                      value={d.priceText}
                      onChange={(e) => update(d.key, { priceText: e.target.value })}
                      aria-label="Fiyat"
                      placeholder="Fiyat"
                      className="num h-10 w-28 shrink-0 rounded-lg border border-line bg-ground px-2 text-right text-lg font-bold"
                    />
                  </div>
                  {d.editing && (
                    <div className="space-y-2 pl-8">
                      <VariantSelect
                        catalog={catalog}
                        modelId={d.model?.id ?? null}
                        variantId={d.variantId}
                        onChange={(m, v) => update(d.key, { model: m, variantId: v, include: Boolean(v) && Boolean(parsePrice(d.priceText)) })}
                      />
                      {d.row.status === "no_model" && d.model && aliasCandidate(d.row.raw).length >= 2 && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={d.remember}
                            onChange={(e) => update(d.key, { remember: e.target.checked })}
                            className="size-4 accent-[var(--ink)]"
                          />
                          &ldquo;{aliasCandidate(d.row.raw)}&rdquo; yazımını {d.model.name} olarak hatırla
                        </label>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending || ready.length === 0}
              className="h-12 rounded-lg bg-ink px-6 font-semibold text-paper disabled:opacity-50"
            >
              {pending ? "Kaydediliyor…" : `${ready.length} fiyatı kaydet`}
            </button>
            {ready.length > 0 && (
              <span className="text-sm text-muted">
                Ortalama {formatTL(ready.reduce((s, r) => s + r.price!, 0) / ready.length)}
              </span>
            )}
            {message && (
              <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
                {message.text}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus | "fixed" }) {
  const ok = status === "ok" || status === "fixed";
  return (
    <span className={clsx("rounded px-1.5 py-0.5 font-medium", ok ? "bg-ok/10 text-ok" : "bg-stop/10 text-stop")}>
      {status === "fixed" ? "Düzeltildi" : STATUS_LABELS[status]}
    </span>
  );
}
