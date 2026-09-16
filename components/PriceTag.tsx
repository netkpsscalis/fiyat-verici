import clsx from "clsx";
import { formatTL } from "@/lib/format";
import type { Confidence, PriceTriple } from "@/lib/pricing/engine";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  yuksek: "Güven yüksek",
  orta: "Güven orta",
  dusuk: "Güven düşük",
  yok: "Veri yok",
};

/**
 * Sarı fiyat etiketi: 3 fiyat, ortadaki en büyük.
 * `compact` telefonda ekranın altına yapışan sürüm.
 */
export function PriceTag({
  title,
  subtitle,
  prices,
  labels = ["En az", "Ortalama", "En çok"],
  footer,
  blocked,
  empty,
  loading,
  compact,
}: {
  title: string;
  subtitle?: string;
  prices: PriceTriple | null;
  labels?: [string, string, string];
  footer?: React.ReactNode;
  blocked?: string;
  empty?: React.ReactNode;
  loading?: boolean;
  compact?: boolean;
}) {
  if (blocked) {
    return (
      <div className={clsx("price-tag bg-stop! text-white", compact ? "px-5 pt-5 pb-3" : "px-6 pt-8 pb-6")}>
        <p className="eyebrow pl-4">{title}</p>
        <p className={clsx("font-display font-black uppercase leading-none [font-stretch:120%]", compact ? "mt-1 text-3xl" : "mt-3 text-5xl")}>
          Alınmaz
        </p>
        <p className="mt-2 text-sm">{blocked}</p>
      </div>
    );
  }

  return (
    <div className={clsx("price-tag", compact ? "px-4 pt-3 pb-3" : "px-6 pt-7 pb-5")} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 pl-5">
        <p className="eyebrow shrink-0">{title}</p>
        {/* Model adı büyük harfe çevrilmez: Türkçede "iPhone" → "İPHONE" olur */}
        {subtitle && <p className="min-w-0 truncate font-mono text-[0.7rem] opacity-75">{subtitle}</p>}
      </div>

      {prices ? (
        <div className={clsx("grid grid-cols-[1fr_1.35fr_1fr] items-end gap-2", compact ? "mt-1" : "mt-4")}>
          <Figure label={labels[0]} value={prices.min} size={compact ? "sm" : "md"} loading={loading} />
          <Figure label={labels[1]} value={prices.mid} size={compact ? "md" : "lg"} loading={loading} center />
          <Figure label={labels[2]} value={prices.max} size={compact ? "sm" : "md"} loading={loading} right />
        </div>
      ) : (
        <div className={clsx("text-sm font-medium", compact ? "mt-1 pl-5" : "mt-4")}>{empty}</div>
      )}

      {footer && <div className={clsx("border-t border-tag-ink/15 text-xs", compact ? "mt-2 pt-1.5" : "mt-4 pt-3")}>{footer}</div>}
    </div>
  );
}

function Figure({
  label,
  value,
  size,
  center,
  right,
  loading,
}: {
  label: string;
  value: number;
  size: "sm" | "md" | "lg";
  center?: boolean;
  right?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={clsx("min-w-0", center && "text-center", right && "text-right", loading && "opacity-50")}>
      <p className="eyebrow truncate opacity-75">{label}</p>
      {/* Dar ekranda 3 fiyat yan yana sığsın diye boyutlar kademeli */}
      <p
        key={value}
        className={clsx(
          "num tick font-extrabold leading-none tracking-tight whitespace-nowrap",
          size === "sm" && "text-lg min-[400px]:text-xl",
          size === "md" && (center ? "text-2xl min-[400px]:text-[1.7rem]" : "text-xl sm:text-2xl"),
          size === "lg" && "text-3xl sm:text-5xl",
        )}
      >
        {formatTL(value)}
      </p>
    </div>
  );
}
