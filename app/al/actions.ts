"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { runGetmobil } from "@/lib/sources/run";
import type { ActionResult } from "@/lib/types";
import { variantId as buildVariantId } from "@/data/seed/devices";

/** Bakılan cihazın Getmobil fiyatlarını hemen yeniler. */
export async function refreshSources(input: { modelId: string; variantId?: string | null }): Promise<ActionResult<{ message: string }>> {
  const modelId = z.string().min(1).parse(input.modelId);
  const model = (await getCatalog()).flatMap((b) => b.models).find((m) => m.id === modelId);
  if (!model) return { ok: false, error: "Model bulunamadı." };
  const g = await runGetmobil({ modelIds: [model.id] });
  const message = `Getmobil: ${g.ok ? (g.count ? `${g.count} hafıza güncellendi` : "bu model yok") : g.message}`;
  return { ok: true, data: { message } };
}

const variantInput = z.object({
  modelId: z.string().min(1),
  ramGb: z.number().int().min(1).max(32).nullable(),
  storageGb: z.number().int().min(16).max(2048),
});

/** Katalogdaki bir modele hafıza seçeneği ekler. */
export async function addVariantToModel(input: z.input<typeof variantInput>): Promise<ActionResult<{ variantId: string }>> {
  const parsed = variantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Hafıza bilgisi geçersiz." };
  const d = parsed.data;
  const [model] = await db.select().from(schema.models).where(eq(schema.models.id, d.modelId));
  if (!model) return { ok: false, error: "Model bulunamadı." };
  const variant = { ramGb: d.ramGb, storageGb: d.storageGb };
  const variantId = buildVariantId(d.modelId, variant);
  await db.insert(schema.variants).values({ id: variantId, modelId: d.modelId, ...variant }).onConflictDoNothing();
  revalidatePath("/", "layout");
  return { ok: true, data: { variantId } };
}
