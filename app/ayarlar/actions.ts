"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { FACTORS } from "@/lib/pricing/conditions";
import { DEFAULT_SETTINGS } from "@/lib/pricing/settings";
import type { ActionResult } from "@/lib/types";

const pct = (max: number) => z.number().min(0).max(max);
const sourceAdjust = z.object({
  factor: z.number().min(0.3).max(1.5),
  weight: z.number().min(0).max(5),
});

const groupInput = z.object({
  margins: z
    .object({ max: pct(60), mid: pct(60), min: pct(80) })
    .refine((m) => m.max <= m.mid && m.mid <= m.min, "Kâr payları sırayla artmalı: en çok ≤ ortalama ≤ en az."),
  minProfit: z.number().min(0).max(100_000),
  saleFactor: z.number().min(0.5, "Satış oranı %50'den az olamaz.").max(1.1, "Satış oranı %110'dan fazla olamaz."),
});

const settingsInput = z.object({
  groups: z.object({
    apple: groupInput,
    samsung: groupInput,
    xiaomi: groupInput,
    diger: groupInput,
  }),
  sourceAdjust: z.object({
    own_sell: sourceAdjust,
    used_listing: sourceAdjust,
    refurb_retail: sourceAdjust,
  }),
  buybackRatio: z.number().min(0.4).max(1),
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

  // Otomatik hesaplanan düzeltme kullanıcı kaydında korunur
  const [current] = await db.select().from(schema.settings).where(eq(schema.settings.key, "pricing"));
  const stored = (current?.value ?? {}) as { calibration?: unknown };
  const value = { ...DEFAULT_SETTINGS, ...s.data, calibration: stored.calibration ?? DEFAULT_SETTINGS.calibration };
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

/** Kendi alış-satışlarına bakarak yerel piyasa düzeltmesini yeniden hesaplar. */
export async function recalibrate(): Promise<ActionResult<{ message: string }>> {
  const { recalculateCalibration } = await import("@/lib/calibration");
  const r = await recalculateCalibration();
  revalidatePath("/", "layout");
  const message =
    r.samples < 3
      ? `Düzeltme için en az 3 işlem gerekiyor (şu an ${r.samples}). Aldıkça ve sattıkça kaydet, sistem kendini ayarlar.`
      : `Düzeltme: ×${r.factor} (${r.fromBuys} alış, ${r.fromSells} satış kaydından).`;
  return { ok: true, data: { message } };
}
