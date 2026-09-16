"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshModelSources } from "@/app/kaynaklar/actions";

/** Modelin otomatik kaynaklarını hemen okur; bitince `onDone` ile fiyatlar yeniden yüklenir. */
export function RefreshSourcesButton({ modelId, onDone }: { modelId: string; onDone: () => void }) {
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
            const res = await refreshModelSources(modelId);
            setMessage(res.ok ? res.data.message : res.error);
            onDone();
          })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-sm font-medium hover:border-muted disabled:opacity-60"
      >
        <RotateCcw aria-hidden size={15} className={pending ? "animate-spin" : undefined} />
        {pending ? "Kaynaklar okunuyor…" : "Kaynakları güncelle"}
      </button>
      {message && (
        <p role="status" className="text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
