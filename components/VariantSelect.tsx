"use client";

import { useMemo } from "react";
import { variantLabel } from "@/lib/format";
import type { CatalogBrand, CatalogModel } from "@/lib/types";

const selectClass = "h-12 w-full rounded-lg border border-line bg-paper px-3 text-base";

/** Model ve varyant seçimi. Telefonda yerel seçim listesi açıldığı için hızlıdır. */
export function VariantSelect({
  catalog,
  modelId,
  variantId,
  onChange,
}: {
  catalog: CatalogBrand[];
  modelId: string | null;
  variantId: string | null;
  onChange: (model: CatalogModel | null, variantId: string | null) => void;
}) {
  const groups = useMemo(
    () =>
      catalog.flatMap((b) => {
        const bySeries = new Map<string, CatalogModel[]>();
        for (const m of b.models) bySeries.set(m.series, [...(bySeries.get(m.series) ?? []), m]);
        return [...bySeries.entries()].map(([series, models]) => ({ label: `${b.name} · ${series}`, models }));
      }),
    [catalog],
  );
  const model = groups.flatMap((g) => g.models).find((m) => m.id === modelId) ?? null;

  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
      <label className="block">
        <span className="sr-only">Model</span>
        <select
          className={selectClass}
          value={modelId ?? ""}
          onChange={(e) => {
            const m = groups.flatMap((g) => g.models).find((x) => x.id === e.target.value) ?? null;
            onChange(m, m && m.variants.length === 1 ? m.variants[0].id : null);
          }}
        >
          <option value="">Model seç</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="sr-only">Hafıza</span>
        <select
          className={selectClass}
          value={variantId ?? ""}
          disabled={!model}
          onChange={(e) => onChange(model, e.target.value || null)}
        >
          <option value="">Hafıza seç</option>
          {model?.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {variantLabel(v)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
