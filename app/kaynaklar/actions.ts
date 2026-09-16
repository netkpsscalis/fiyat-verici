"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalog } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { WARRANTY_TYPES } from "@/lib/db/schema";
import { runGetmobil, runTracked, runTurkcell, runVatan, SOURCES } from "@/lib/sources/run";
import type { ActionResult } from "@/lib/types";
import { modelId as buildModelId, slug, variantId as buildVariantId } from "@/data/seed/devices";

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

/** Hızlı güncelleme: mağaza fiyatları, takip linkleri ve kendi işlemlerinden öğrenme. */
export async function refreshAll(): Promise<ActionResult<{ message: string }>> {
  const { recalculateCalibration } = await import("@/lib/calibration");
  const v = await runVatan();
  const t = await runTurkcell();
  const links = await runTracked();
  const cal = await recalculateCalibration();
  revalidatePath("/kaynaklar");
  revalidatePath("/piyasa");
  const parts = [`Vatan: ${v.count}`, `Turkcell: ${t.count}`];
  if (links.count) parts.push(`Linkler: ${links.count}`);
  parts.push(cal.samples >= 3 ? `Düzeltme: ×${cal.factor} (${cal.samples} işlem)` : "Düzeltme: yeterli işlem yok");
  return { ok: true, data: { message: parts.join(" · ") } };
}

/** Bakılan cihazın otomatik kaynaklarını hemen yeniler: Getmobil, Epey satıcı fiyatları ve takip linkleri. */
export async function refreshSources(input: { modelId: string; variantId?: string | null }): Promise<ActionResult<{ message: string }>> {
  const modelId = z.string().min(1).parse(input.modelId);
  const variantId = input.variantId ? z.string().min(1).parse(input.variantId) : null;
  const model = (await getCatalog()).flatMap((b) => b.models).find((m) => m.id === modelId);
  if (!model) return { ok: false, error: "Model bulunamadı." };

  const parts: string[] = [];
  const g = await runGetmobil({ modelIds: [model.id] });
  parts.push(`Getmobil: ${g.ok ? (g.count ? `${g.count} hafıza` : "bu model yok") : g.message}`);

  const v = await runVatan();
  parts.push(`Vatan: ${v.message}`);
  const tc = await runTurkcell();
  parts.push(`Turkcell: ${tc.message}`);

  const t = await runTracked({ variantIds: variantId ? [variantId] : model.variants.map((v) => v.id) });
  if (t.count || !t.ok) parts.push(`Linkler: ${t.message}`);

  revalidatePath("/piyasa");
  return { ok: true, data: { message: parts.join(" · ") } };
}

const catalogInput = z.object({
  unmatchedId: z.number().int().optional(),
  brandId: z.enum(["apple", "samsung", "xiaomi"]),
  name: z.string().trim().min(2, "Model adı yaz.").max(60),
  ramGb: z.number().int().min(1).max(32).nullable(),
  storageGb: z.number().int().min(16).max(2048),
});

/** Kaynakta görülen yeni bir telefonu kataloğa ekler. */
export async function addModelToCatalog(input: z.input<typeof catalogInput>): Promise<ActionResult<{ message: string }>> {
  const parsed = catalogInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgiler eksik." };
  const d = parsed.data;
  const id = buildModelId(d.brandId, d.name);
  const variant = { ramGb: d.ramGb, storageGb: d.storageGb };
  const vId = buildVariantId(id, variant);

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.models)
      .values({
        id,
        brandId: d.brandId,
        name: d.name,
        series: d.name.split(" ")[0],
        releaseYear: new Date().getFullYear(),
        family: d.brandId === "apple" ? "iphone" : "android",
        hasBatteryHealth: d.brandId === "apple",
        sort: 0,
      })
      .onConflictDoNothing();
    await tx.insert(schema.variants).values({ id: vId, modelId: id, ...variant }).onConflictDoNothing();
    // Aynı modelin diğer renkleri/kaynakları da listeden düşsün
    await tx.delete(schema.unmatchedProducts).where(like(schema.unmatchedProducts.name, `%${slug(d.name).replace(/-/g, " ")}%`));
    if (d.unmatchedId) await tx.delete(schema.unmatchedProducts).where(eq(schema.unmatchedProducts.id, d.unmatchedId));
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { message: `${d.name} kataloğa eklendi. Bir sonraki güncellemede fiyatı gelecek.` } };
}

/** Bu ürünü bir daha gösterme (telefon değilse ya da ilgilenmiyorsan). */
export async function dismissUnmatched(id: number): Promise<ActionResult> {
  await db.delete(schema.unmatchedProducts).where(eq(schema.unmatchedProducts.id, z.number().int().parse(id)));
  revalidatePath("/kaynaklar");
  return { ok: true, data: undefined };
}
