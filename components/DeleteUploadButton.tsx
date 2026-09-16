"use client";

import { useTransition } from "react";
import { deleteUpload } from "@/app/toptanci/actions";

export function DeleteUploadButton({ id, count }: { id: number; count: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Bu liste ve ${count} fiyatı silinsin mi?`)) start(async () => void (await deleteUpload(id)));
      }}
      className="rounded-md px-2 py-1 text-sm font-medium text-muted hover:bg-ground hover:text-stop disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Geri al"}
    </button>
  );
}
