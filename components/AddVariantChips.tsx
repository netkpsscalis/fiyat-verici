"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addVariantToModel } from "@/app/al/actions";
import { Chip } from "@/components/Chip";
import { formatStorage } from "@/lib/format";

const STORAGES = [64, 128, 256, 512, 1024];
const RAMS = [4, 6, 8, 12, 16];

/** Katalogda hafıza seçeneği olmayan modeller için: tek dokunuşla hafıza ekle. */
export function AddVariantChips({
  modelId,
  family,
  onAdded,
}: {
  modelId: string;
  family: "iphone" | "android";
  onAdded: (variantId: string) => void;
}) {
  const router = useRouter();
  const [ramGb, setRamGb] = useState<number | null>(family === "iphone" ? null : 8);
  const [added, setAdded] = useState<{ ramGb: number | null; storageGb: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(storageGb: number) {
    start(async () => {
      const res = await addVariantToModel({ modelId, ramGb: family === "iphone" ? null : ramGb, storageGb });
      if (res.ok) {
        setAdded({ ramGb: family === "iphone" ? null : ramGb, storageGb });
        setMessage(null);
        onAdded(res.data.variantId);
        router.refresh();
      } else setMessage(res.error);
    });
  }

  if (added) {
    return (
      <p className="rounded-lg border border-line bg-paper px-3 py-2.5 text-sm">
        <strong>{added.ramGb ? `${added.ramGb} GB RAM · ` : ""}{formatStorage(added.storageGb)}</strong> kataloğa eklendi ve
        seçildi.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
      <p className="text-sm text-muted">
        Bu model kataloğa yeni girdi, hafıza seçeneği yok. Cihazın hafızasına dokun, hemen eklensin.
      </p>
      {family === "android" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">RAM</span>
          {RAMS.map((r) => (
            <Chip key={r} selected={ramGb === r} onClick={() => setRamGb(r)}>
              {r} GB
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Hafıza</span>
        {STORAGES.map((s) => (
          <Chip key={s} selected={false} onClick={() => !pending && add(s)}>
            {formatStorage(s)}
          </Chip>
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm font-medium text-ok">
          {message}
        </p>
      )}
    </div>
  );
}
