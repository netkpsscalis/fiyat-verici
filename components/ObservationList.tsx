import clsx from "clsx";
import { formatAge, formatTL, KIND_LABELS, SOURCE_LABELS } from "@/lib/format";
import type { UsedObservation } from "@/lib/pricing/engine";

/** Bir fiyatın hangi verilerden hesaplandığını gösteren liste. */
export function ObservationList({ items }: { items: UsedObservation[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Hesaba giren veri yok.</p>;
  const sorted = [...items].sort((a, b) => a.ageDays - b.ageDays);
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
      {sorted.map((o, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {SOURCE_LABELS[o.source] ?? o.source}
              <span className="font-normal text-muted"> · {KIND_LABELS[o.kind] ?? o.kind}</span>
            </p>
            <p className="font-mono text-[0.7rem] text-muted">
              {formatAge(o.ageDays)}
              {(o.sampleSize ?? 1) > 1 ? ` · ${o.sampleSize} ilanın ortası` : ""}
              {o.warranty ? ` · ${o.warranty}` : ""}
              {o.url && (
                <>
                  {" · "}
                  <a href={o.url} target="_blank" rel="noreferrer" className="underline">
                    kaynak
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="num text-base font-bold">{formatTL(o.price)}</p>
            {Math.round(o.adjusted) !== Math.round(o.price) && (
              <p className={clsx("font-mono text-[0.7rem] text-muted")}>hesaba: {formatTL(o.adjusted)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
