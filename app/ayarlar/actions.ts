"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { FACTORS } from "@/lib/pricing/conditions";
import { DEFAULT_SETTINGS } from "@/lib/pricing/settings";
import type { ActionResult } from "@/lib/types";

const pct = (max: number) => z.number().min(0).max(max);

const settingsInput = z.object({
  buyMargins: z
    .object({ max: pct(60), mid: pct(60), min: pct(80) })
    .refine((m) => m.max <= m.mid && m.mid <= m.min, "Kâr payları sırayla artmalı: en çok ≤ ortalama ≤ en az."),
  minProfit: z.number().min(0).max(100_000),
  listingDiscount: pct(30),
  refurbFactor: z.number().min(0.5).max(1.2),
  buybackRatio: z.number().min(0.4).max(1),
  newSale: z.object({
    margin: pct(50),
    minProfit: z.number().min(0).max(100_000),
    wholesaleFromRetail: z.number().min(0.5).max(1),
  }),
});

const overrideInput = z.object({
  factorId: z.string(),
  optionId: z.string(),
  mode: z.enum(["pct", "fixed"]),
  value: z.number().min(-50).max(500_000),
});

export async function saveSettings(input: {
  settings: z.input<typeof settingsInput>;
  overrides: z.input<typeof overrideInput>[];
}): Promise<ActionResult> {
  const s = settingsInput.safeParse(input.settings);
  if (!s.success) return { ok: false, error: s.error.issues[0]?.message ?? "Ayarlar geçersiz." };
  const o = z.array(overrideInput).max(200).safeParse(input.overrides);
  if (!o.success) return { ok: false, error: "Kesinti değerlerinden biri geçersiz." };

  const known = new Set(FACTORS.flatMap((f) => f.options.map((op) => `${f.id}:${op.id}`)));
  const overrides = o.data.filter((x) => known.has(`${x.factorId}:${x.optionId}`));
  if (overrides.some((x) => x.mode === "pct" && x.value > 100)) return { ok: false, error: "Yüzde kesinti 100'ü geçemez." };

  const value = { ...DEFAULT_SETTINGS, ...s.data };
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.settings)
      .values({ key: "pricing", value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
    await tx.delete(schema.deductionOverrides);
    if (overrides.length) await tx.insert(schema.deductionOverrides).values(overrides);
  });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
