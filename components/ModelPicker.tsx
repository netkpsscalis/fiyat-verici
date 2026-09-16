"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CatalogBrand, CatalogModel } from "@/lib/types";

const RECENT_KEY = "fv_son_modeller";

export function normalizeQuery(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9ğüşöç ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberModel(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // tarayıcı depolaması kapalıysa son modeller gösterilmez
  }
}

export function ModelPicker({ catalog, onPick }: { catalog: CatalogBrand[]; onPick: (m: CatalogModel) => void }) {
  const [brandId, setBrandId] = useState<string>(catalog[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecent()), []);

  const all = useMemo(() => catalog.flatMap((b) => b.models), [catalog]);
  const recent = recentIds.map((id) => all.find((m) => m.id === id)).filter((m): m is CatalogModel => !!m);

  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return catalog.find((b) => b.id === brandId)?.models ?? [];
    const tokens = q.split(" ");
    return all.filter((m) => {
      const hay = normalizeQuery(`${m.brandName} ${m.name}`);
      const compact = hay.replace(/ /g, "");
      return tokens.every((t) => hay.includes(t) || compact.includes(t));
    });
  }, [query, brandId, catalog, all]);

  const bySeries = useMemo(() => {
    const groups = new Map<string, CatalogModel[]>();
    for (const m of results) {
      const key = query ? m.brandName : m.series;
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups.entries()];
  }, [results, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search aria-hidden size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Model ara: 15 pro max, s24 ultra, note 13"
          aria-label="Model ara"
          className="h-12 w-full rounded-lg border border-line bg-paper pr-3 pl-10 text-base"
        />
      </div>

      {!query && (
        <div role="tablist" aria-label="Marka" className="flex gap-1 rounded-lg bg-paper p-1 ring-1 ring-line">
          {catalog.map((b) => (
            <button
              key={b.id}
              role="tab"
              type="button"
              aria-selected={b.id === brandId}
              onClick={() => setBrandId(b.id)}
              className={clsx(
                "h-10 flex-1 rounded-md text-sm font-semibold transition-colors",
                b.id === brandId ? "bg-ink text-paper" : "text-muted hover:text-ink",
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {!query && recent.length > 0 && (
        <div>
          <p className="eyebrow mb-2 text-muted">Son bakılanlar</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m)}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm hover:border-muted"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {bySeries.length === 0 && <p className="text-sm text-muted">Bu aramayla eşleşen model yok. Farklı yazmayı dene.</p>}

      {bySeries.map(([group, list]) => (
        <section key={group}>
          {/* Seri adları (iPhone, POCO) Türkçe büyük harfe çevrilmesin: "İPHONE" olmasın */}
          <h3 className="mb-2 font-mono text-xs font-medium text-muted">{group}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m)}
                className="flex min-h-12 items-center rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm font-medium hover:border-ink"
              >
                {m.name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
