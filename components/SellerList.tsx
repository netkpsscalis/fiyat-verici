import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { formatAge, formatTL, sourceLabel, WARRANTY_LABELS } from "@/lib/format";
import { DAY_MS } from "@/lib/pricing/stats";
import type { ObservationDTO } from "@/lib/types";

/** Sıfır cihazın satıcılardaki fiyatları: en ucuzdan pahalıya. */
export function SellerList({ items, now = Date.now() }: { items: ObservationDTO[]; now?: number }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0].price;

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
      {sorted.map((o, i) => (
        <li key={o.id} className={clsx("flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3", i === 0 && "bg-tag/10")}>
          <span className="num w-5 shrink-0 text-right text-sm text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {sourceLabel(o.source)}
              {i === 0 && (
                <span className="ml-1.5 rounded bg-tag px-1 py-0.5 align-middle text-[0.6rem] font-bold text-tag-ink">
                  EN UCUZ
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted">
              {o.warranty ? WARRANTY_LABELS[o.warranty] : "Garanti belirtilmemiş"}
              {o.price > cheapest && <span> · +{formatTL(o.price - cheapest)}</span>}
              <span className="hidden sm:inline"> · {formatAge((now - o.observedAt) / DAY_MS)}</span>
            </p>
          </div>
          <p className="num shrink-0 text-base font-bold whitespace-nowrap sm:text-lg">{formatTL(o.price)}</p>
          {o.url && (
            <a
              href={o.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`${sourceLabel(o.source)} sayfasını aç`}
              className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ground hover:text-ink"
            >
              <ExternalLink aria-hidden size={15} />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
