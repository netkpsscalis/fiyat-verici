import clsx from "clsx";

export function Chip({
  selected,
  onClick,
  children,
  sub,
  tone = "ink",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Küçük ikinci satır: fiyata etkisi gibi */
  sub?: string;
  tone?: "ink" | "stop";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left text-sm leading-tight transition-colors",
        selected
          ? tone === "stop"
            ? "border-stop bg-stop text-white"
            : "border-ink bg-ink text-paper"
          : "border-line bg-paper hover:border-muted",
      )}
    >
      <span className="font-medium">{children}</span>
      {sub && <span className={clsx("font-mono text-[0.68rem]", selected ? "opacity-80" : "text-muted")}>{sub}</span>}
    </button>
  );
}
