"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { WARRANTY_TYPES } from "@/lib/db/schema";
import { runGetmobil, runTracked, SOURCES } from "@/lib/sources/run";
import type { ActionResult } from "@/lib/types";

const trackedInput = z.object({
  variantId: z.string().min(1, "Model ve hafıza seç."),
  kind: z.enum(["new_retail", "refurb_retail", "buyback", "used_listing"]),
  url: z.url({ error: "Linki tam olarak yapıştır (https:// ile başlamalı)." }).max(600),
  warranty: z.enum(WARRANTY_TYPES).nullable(),
});

export async function addTrackedUrl(input: z.input<typeof trackedInput>): Promise<ActionResult<{ message: string }>> {
  const parsed = trackedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgiler eksik." };
  const d = parsed.data;
  if (!/^https:\/\//.test(d.url)) return { ok: false, error: "Link https:// ile başlamalı." };
  const [row] = await db
    .insert(schema.trackedUrls)
    .values(d)
    .onConflictDoNothing()
    .returning({ id: schema.trackedUrls.id });
  if (!row) return { ok: false, error: "Bu link bu cihaz için zaten ekli." };

  // Eklenir eklenmez bir kez okunur; hata olsa bile link kalır, kullanıcı sebebini listede görür
  const res = await runTracked({ variantIds: [d.variantId] });
  revalidatePath("/kaynaklar");
  revalidatePath("/piyasa");
  return { ok: true, data: { message: res.message } };
}

export async function deleteTrackedUrl(id: number): Promise<ActionResult> {
  await db.delete(schema.trackedUrls).where(eq(schema.trackedUrls.id, z.number().int().parse(id)));
  revalidatePath("/kaynaklar");
  return { ok: true, data: undefined };
}

export async function checkTrackedNow(): Promise<ActionResult<{ message: string }>> {
  const res = await runTracked();
  revalidatePath("/kaynaklar");
  revalidatePath("/piyasa");
  return res.ok ? { ok: true, data: { message: res.message } } : { ok: false, error: res.message };
}

export async function toggleSource(source: string, enabled: boolean): Promise<ActionResult> {
  const id = z.enum(SOURCES).parse(source);
  await db
    .insert(schema.sourceStatus)
    .values({ source: id, enabled })
    .onConflictDoUpdate({ target: schema.sourceStatus.source, set: { enabled } });
  revalidatePath("/kaynaklar");
  return { ok: true, data: undefined };
}

/** Bakılan modelin otomatik kaynaklarını hemen yeniler (Getmobil + o modelin takip linkleri). */
export async function refreshModelSources(modelId: string): Promise<ActionResult<{ message: string }>> {
  const model = (await getCatalog()).flatMap((b) => b.models).find((m) => m.id === z.string().parse(modelId));
  if (!model) return { ok: false, error: "Model bulunamadı." };
  const g = await runGetmobil({ modelIds: [model.id] });
  const t = await runTracked({ variantIds: model.variants.map((v) => v.id) });
  revalidatePath("/piyasa");
  const parts = [g.ok ? `Getmobil: ${g.count ? `${g.count} hafıza güncellendi` : "bu model yok"}` : `Getmobil: ${g.message}`];
  if (t.count || !t.ok) parts.push(`Linkler: ${t.message}`);
  return { ok: true, data: { message: parts.join(" · ") } };
}
