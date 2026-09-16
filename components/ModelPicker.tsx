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

/** Seri başlığı: veritabanındaki alan yerine model adından (otomatik eklenen modellerde tutarlı olsun) */
export function seriesOf(m: CatalogModel): string {
  if (m.brandId === "apple") return "iPhone";
  if (m.brandId === "samsung") {
    const x = /Galaxy (Note|Z|S|A|M|F)/i.exec(m.name);
    return x ? `Galaxy ${x[1].length > 1 ? "Note" : x[1].toUpperCase()}` : "Galaxy";
  }
  if (m.brandId === "xiaomi") {
    if (/^Redmi Note/i.test(m.name)) return "Redmi Note";
    if (/^Redmi/i.test(m.name)) return "Redmi";
    if (/^POCO/i.test(m.name)) return "POCO";
    return "Xiaomi";
  }
  return m.brandName;
}

export const SERIES_ORDER = ["iPhone", "Galaxy S", "Galaxy Z", "Galaxy A", "Galaxy M", "Galaxy F", "Galaxy Note", "Galaxy", "Xiaomi", "Redmi Note", "Redmi", "POCO"];

/** Dükkana en çok gelen markalar sekme olarak durur; diğerleri "Diğer" altında */
const PRIMARY_BRANDS = ["apple", "samsung", "xiaomi"];
const OTHER = "__diger";

export function ModelPicker({ catalog, onPick }: { catalog: CatalogBrand[]; onPick: (m: CatalogModel) => void }) {
  const primary = PRIMARY_BRANDS.map((id) => catalog.find((b) => b.id === id)).filter((b): b is CatalogBrand => !!b);
  const others = catalog
    .filter((b) => !PRIMARY_BRANDS.includes(b.id) && b.models.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const [brandId, setBrandId] = useState<string>(primary[0]?.id ?? catalog[0]?.id ?? "");
  const [otherBrandId, setOtherBrandId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecent()), []);

  const all = useMemo(() => catalog.flatMap((b) => b.models), [catalog]);
  const recent = recentIds.map((id) => all.find((m) => m.id === id)).filter((m): m is CatalogModel => !!m);

  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) {
      const id = brandId === OTHER ? otherBrandId : brandId;
      return id ? (catalog.find((b) => b.id === id)?.models ?? []) : [];
    }
    const tokens = q.split(" ");
    return all.filter((m) => {
      const hay = normalizeQuery(`${m.brandName} ${m.name}`);
      const compact = hay.replace(/ /g, "");
      return tokens.every((t) => hay.includes(t) || compact.includes(t));
    });
  }, [query, brandId, otherBrandId, catalog, all]);

  const bySeries = useMemo(() => {
    const groups = new Map<string, CatalogModel[]>();
    for (const m of results) {
      const key = query ? m.brandName : seriesOf(m);
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    const rank = (k: string) => (SERIES_ORDER.includes(k) ? SERIES_ORDER.indexOf(k) : SERIES_ORDER.length);
    return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
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
        <div className="space-y-2">
          <div role="tablist" aria-label="Marka" className="grid grid-cols-4 gap-1 rounded-lg bg-paper p-1 ring-1 ring-line">
            {[...primary.map((b) => ({ id: b.id, name: b.name })), ...(others.length ? [{ id: OTHER, name: "Diğer" }] : [])].map((b) => (
              <button
                key={b.id}
                role="tab"
                type="button"
                aria-selected={b.id === brandId}
                onClick={() => setBrandId(b.id)}
                className={clsx(
                  "h-10 rounded-md text-sm font-semibold transition-colors",
                  b.id === brandId ? "bg-ink text-paper" : "text-muted hover:text-ink",
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
          {brandId === OTHER && (
            <div className="flex flex-wrap gap-2">
              {others.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === otherBrandId}
                  onClick={() => setOtherBrandId(b.id)}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-sm",
                    b.id === otherBrandId ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-muted",
                  )}
                >
                  {b.name} <span className="opacity-60">{b.models.length}</span>
                </button>
              ))}
            </div>
          )}
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

      {bySeries.length === 0 &&
        (brandId === OTHER && !otherBrandId && !query ? (
          <p className="text-sm text-muted">Yukarıdan bir marka seç.</p>
        ) : (
          <p className="text-sm text-muted">Bu aramayla eşleşen model yok. Farklı yazmayı dene.</p>
        ))}

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
