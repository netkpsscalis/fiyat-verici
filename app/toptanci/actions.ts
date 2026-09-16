"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { WARRANTY_TYPES } from "@/lib/db/schema";
import { tokenize } from "@/lib/parsers/normalize";
import type { ActionResult } from "@/lib/types";

const saveInput = z.object({
  supplierId: z.number().int().nullable(),
  newSupplierName: z.string().trim().max(80).nullable(),
  rawText: z.string().max(500_000),
  fileName: z.string().max(200).nullable(),
  rows: z
    .array(
      z.object({
        variantId: z.string().min(1),
        price: z.number().positive().max(2_000_000),
        warranty: z.enum(WARRANTY_TYPES).nullable(),
      }),
    )
    .min(1, "Kaydedilecek fiyat yok. En az bir satırı işaretle.")
    .max(3000),
  aliases: z.array(z.object({ alias: z.string().trim().min(2).max(60), modelId: z.string().min(1) })).max(300),
});

/** Önizlemede onaylanan toptancı fiyatlarını kaydeder ve düzeltilen yazımları öğrenir. */
export async function saveSupplierPrices(
  input: z.input<typeof saveInput>,
): Promise<ActionResult<{ count: number; supplierId: number }>> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgiler eksik." };
  const d = parsed.data;
  if (!d.supplierId && !d.newSupplierName) return { ok: false, error: "Toptancı seç ya da yeni toptancının adını yaz." };

  const supplierId = await db.transaction(async (tx) => {
    let supplierId = d.supplierId;
    if (!supplierId) {
      // Aynı adla ikinci kez eklenmesin: varsa mevcut toptancıyı kullan
      const [existing] = await tx
        .select({ id: schema.suppliers.id })
        .from(schema.suppliers)
        .where(eq(schema.suppliers.name, d.newSupplierName!));
      supplierId =
        existing?.id ??
        (await tx.insert(schema.suppliers).values({ name: d.newSupplierName! }).returning({ id: schema.suppliers.id }))[0].id;
    }
    const [upload] = await tx
      .insert(schema.supplierUploads)
      .values({ supplierId, fileName: d.fileName, rawText: d.rawText, savedCount: d.rows.length })
      .returning({ id: schema.supplierUploads.id });

    const observedAt = new Date();
    for (let i = 0; i < d.rows.length; i += 400) {
      await tx.insert(schema.priceObservations).values(
        d.rows.slice(i, i + 400).map((r) => ({
          variantId: r.variantId,
          kind: "new_wholesale" as const,
          source: "supplier",
          warranty: r.warranty,
          price: r.price,
          observedAt,
          supplierId,
          uploadId: upload.id,
        })),
      );
    }

    for (const a of d.aliases) {
      const alias = tokenize(a.alias).join(" ");
      if (alias.length < 2) continue;
      await tx
        .insert(schema.aliases)
        .values({ alias, modelId: a.modelId })
        .onConflictDoUpdate({ target: schema.aliases.alias, set: { modelId: a.modelId } });
    }
    return supplierId;
  });

  revalidatePath("/toptanci");
  revalidatePath("/piyasa");
  return { ok: true, data: { count: d.rows.length, supplierId } };
}

/** Yanlış yüklenen listeyi fiyatlarıyla birlikte geri alır. */
export async function deleteUpload(id: number): Promise<ActionResult> {
  const uploadId = z.number().int().parse(id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.priceObservations).where(eq(schema.priceObservations.uploadId, uploadId));
    await tx.delete(schema.supplierUploads).where(eq(schema.supplierUploads.id, uploadId));
  });
  revalidatePath("/toptanci");
  revalidatePath("/piyasa");
  return { ok: true, data: undefined };
}
