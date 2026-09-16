"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshSources } from "@/app/al/actions";

/** Modelin Getmobil fiyatlarını hemen okur; bitince `onDone` ile fiyatlar yeniden yüklenir. */
export function RefreshSourcesButton({
  modelId,
  variantId,
  onDone,
}: {
  modelId: string;
  variantId?: string | null;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const res = await refreshSources({ modelId, variantId });
            setMessage(res.ok ? res.data.message : res.error);
            onDone();
          })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-sm font-medium hover:border-muted disabled:opacity-60"
      >
        <RotateCcw aria-hidden size={15} className={pending ? "animate-spin" : undefined} />
        {pending ? "Getmobil okunuyor…" : "Getmobil fiyatlarını yenile"}
      </button>
      {message && (
        <p role="status" className="text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
