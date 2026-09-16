"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteObservation } from "@/app/actions";

export function DeleteObservationButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Bu fiyat silinsin mi?")) start(async () => void (await deleteObservation(id)));
      }}
      className="rounded-md p-2 text-muted hover:bg-ground hover:text-stop disabled:opacity-50"
      aria-label="Fiyatı sil"
    >
      <Trash2 aria-hidden size={16} />
    </button>
  );
}
