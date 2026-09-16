/**
 * Yerel piyasa düzeltmesi: dükkanın gerçek alış ve satışlarıyla uygulamanın o gün önereceği
 * fiyatları karşılaştırır. Teklifler sürekli yüksek çıkıyorsa katsayı düşer.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { getCatalog, getOverrides, getSettings } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { computeCalibrationFactor, type CalibrationSample } from "@/lib/pricing/calibrate";
import type { Selection } from "@/lib/pricing/conditions";
import { computeAdjustments, computeReference, type Observation } from "@/lib/pricing/engine";
import { DEFAULT_SETTINGS } from "@/lib/pricing/settings";
import { DAY_MS } from "@/lib/pricing/stats";

const LOOKBACK_DAYS = 180;
/** Bir işlemin fiyatı, o tarihe bu kadar yakın gözlemlerle karşılaştırılır */
const NEAR_DAYS = 10;

type ObsRow = typeof schema.priceObservations.$inferSelect;

const toObservation = (o: ObsRow): Observation => ({
  kind: o.kind,
  source: o.source,
  price: o.price,
  observedAt: o.observedAt,
  warranty: o.warranty,
  sampleSize: o.sampleSize,
});

export interface CalibrationResult {
  factor: number;
  samples: number;
  fromBuys: number;
  fromSells: number;
}

export async function recalculateCalibration(): Promise<CalibrationResult> {
  const [settings, overrides, catalog] = await Promise.all([getSettings(), getOverrides(), getCatalog()]);
  // Düzeltmeyi hesaplarken eski düzeltme uygulanmaz, yoksa kendi kendini beslerdi
  const base = { ...settings, calibration: DEFAULT_SETTINGS.calibration };
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);

  const models = catalog.flatMap((b) => b.models);
  const modelOf = new Map<string, (typeof models)[number]>();
  for (const m of models) for (const v of m.variants) modelOf.set(v.id, m);

  const [sales, buys] = await Promise.all([
    db
      .select()
      .from(schema.priceObservations)
      .where(and(eq(schema.priceObservations.kind, "own_sell"), gte(schema.priceObservations.observedAt, since))),
    db.select().from(schema.transactions).where(and(eq(schema.transactions.type, "buy"), gte(schema.transactions.createdAt, since))),
  ]);

  const variantIds = [...new Set([...sales.map((s) => s.variantId), ...buys.map((b) => b.variantId)])];
  if (variantIds.length === 0) return save({ factor: 1, samples: 0, fromBuys: 0, fromSells: 0 });

  const all = await db.select().from(schema.priceObservations).where(inArray(schema.priceObservations.variantId, variantIds));

  /** İşlem tarihinde, o işlemin kendisi dışındaki kaynaklardan tahmini satış değeri */
  function referenceAt(variantId: string, at: Date, excludeKinds: string[]) {
    const model = modelOf.get(variantId);
    if (!model) return null;
    const near = all.filter(
      (o) =>
        o.variantId === variantId &&
        !excludeKinds.includes(o.kind) &&
        Math.abs(o.observedAt.getTime() - at.getTime()) <= NEAR_DAYS * DAY_MS,
    );
    if (near.length === 0) return null;
    const ref = computeReference(near.map(toObservation), { now: at, settings: base, releaseYear: model.releaseYear });
    return ref.method === "market" && ref.value ? { value: ref.value, model } : null;
  }

  const samples: CalibrationSample[] = [];
  let fromSells = 0;
  let fromBuys = 0;

  for (const sale of sales) {
    const ref = referenceAt(sale.variantId, sale.observedAt, ["own_sell", "own_buy"]);
    if (!ref) continue;
    samples.push({ actual: sale.price, predicted: ref.value });
    fromSells++;
  }

  for (const buy of buys) {
    const ref = referenceAt(buy.variantId, buy.createdAt, ["own_sell", "own_buy"]);
    if (!ref) continue;
    const adj = computeAdjustments(ref.model.family, (buy.conditions ?? {}) as Selection, overrides);
    if (adj.blocked.length) continue;
    const resale = ref.value * adj.multiplier - adj.fixedTotal;
    const suggestedMid = resale * (1 - base.buyMargins.mid / 100);
    if (suggestedMid <= 0) continue;
    samples.push({ actual: buy.price, predicted: suggestedMid });
    fromBuys++;
  }

  const { factor, samples: used } = computeCalibrationFactor(samples);
  return save({ factor, samples: used, fromBuys, fromSells });
}

async function save(result: CalibrationResult): Promise<CalibrationResult> {
  // Sadece düzeltme alanı yazılır; diğer ayarlar kullanıcı değiştirmedikçe varsayılanlardan gelir
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "pricing"));
  const stored = (row?.value ?? {}) as Record<string, unknown>;
  const value = { ...stored, calibration: { factor: result.factor, samples: result.samples, updatedAt: Date.now() } };
  await db
    .insert(schema.settings)
    .values({ key: "pricing", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  return result;
}
