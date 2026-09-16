"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { addModelToCatalog, dismissUnmatched } from "@/app/kaynaklar/actions";
import { formatTL, SOURCE_LABELS, variantLabel } from "@/lib/format";
import type { UnmatchedRow } from "@/lib/sourcesData";

/** Kaynaklarda görülüp katalogda olmayan telefonlar: onaylayınca katalog genişler. */
export function UnmatchedList({ items }: { items: UnmatchedRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">
        Katalog güncel: kaynaklardaki bütün telefonlar tanınıyor.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
      {items.map((item) => (
        <UnmatchedItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

function UnmatchedItem({ item }: { item: UnmatchedRow }) {
  const [name, setName] = useState(item.suggestedName);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const brandId = (item.brandId ?? "samsung") as "apple" | "samsung" | "xiaomi";
  const canAdd = Boolean(name.trim() && item.storageGb);

  function add() {
    start(async () => {
      const res = await addModelToCatalog({
        unmatchedId: item.id,
        brandId,
        name: name.trim(),
        ramGb: item.ramGb,
        storageGb: item.storageGb!,
      });
      setMessage(res.ok ? { tone: "ok", text: res.data.message } : { tone: "stop", text: res.error });
    });
  }

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {SOURCE_LABELS[item.source] ?? item.source}
            {item.storageGb ? ` · ${variantLabel({ ramGb: item.ramGb, storageGb: item.storageGb })}` : " · hafıza okunamadı"}
            {item.price ? ` · ${formatTL(item.price)}` : ""}
            {item.variantCount > 1 ? ` · ${item.variantCount} renk` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => start(async () => void (await dismissUnmatched(item.id)))}
          disabled={pending}
          aria-label="Listeden kaldır"
          className="rounded-md p-2 text-muted hover:bg-ground hover:text-stop disabled:opacity-50"
        >
          <X aria-hidden size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Kataloğa eklenecek model adı"
          placeholder="Model adı"
          className="h-11 min-w-44 flex-1 rounded-lg border border-line bg-ground px-3 text-base"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !canAdd}
          className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"
        >
          Kataloğa ekle
        </button>
      </div>
      {message && (
        <p role="status" className={message.tone === "ok" ? "text-sm font-medium text-ok" : "text-sm font-medium text-stop"}>
          {message.text}
        </p>
      )}
    </li>
  );
}
