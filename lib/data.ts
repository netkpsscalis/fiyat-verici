/** Sunucu tarafı veri okuma. Sadece server component ve server action'lardan çağrılır. */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Overrides } from "@/lib/pricing/conditions";
import { mergeSettings, type PricingSettings } from "@/lib/pricing/settings";
import type { CatalogBrand, CatalogModel, CatalogVariant, ObservationDTO } from "@/lib/types";

export async function getCatalog(): Promise<CatalogBrand[]> {
  const [brands, models, variants] = await Promise.all([
    db.select().from(schema.brands).orderBy(schema.brands.sort),
    db.select().from(schema.models),
    db.select().from(schema.variants),
  ]);

  const variantsByModel = new Map<string, CatalogVariant[]>();
  for (const v of variants) {
    const list = variantsByModel.get(v.modelId) ?? [];
    list.push({ id: v.id, ramGb: v.ramGb, storageGb: v.storageGb });
    variantsByModel.set(v.modelId, list);
  }
  for (const list of variantsByModel.values()) {
    list.sort((a, b) => a.storageGb - b.storageGb || (a.ramGb ?? 0) - (b.ramGb ?? 0));
  }

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const modelsByBrand = new Map<string, CatalogModel[]>();
  // Yeni modeller önce: dükkana en çok onlar geliyor
  const byName = new Intl.Collator("tr", { numeric: true });
  // Aynı ailede üst model önce: "S25 Ultra, S25+, S25 Edge, S25, S25 FE"
  const TIERS: [RegExp, number][] = [
    [/\b(ultra|pro max)$/i, 0],
    [/\bpro$/i, 1],
    [/(\+|\bplus)$/i, 1.5],
    [/\b(edge|air)$/i, 2],
    [/(\bfe|\blite|\de)$/i, 4],
  ];
  const tier = (name: string) => TIERS.find(([re]) => re.test(name))?.[1] ?? 3;
  const family = (name: string) => name.replace(/\s*(\+|plus|ultra|pro max|pro|edge|fe|lite)\s*$/i, "").replace(/(\d)e$/i, "$1");
  for (const m of [...models].sort(
    (a, b) =>
      b.releaseYear - a.releaseYear || byName.compare(family(b.name), family(a.name)) || tier(a.name) - tier(b.name),
  )) {
    const list = modelsByBrand.get(m.brandId) ?? [];
    list.push({
      id: m.id,
      brandId: m.brandId,
      brandName: brandName.get(m.brandId) ?? m.brandId,
      name: m.name,
      series: m.series,
      releaseYear: m.releaseYear,
      family: m.family,
      hasBatteryHealth: m.hasBatteryHealth,
      variants: variantsByModel.get(m.id) ?? [],
    });
    modelsByBrand.set(m.brandId, list);
  }

  return brands.map((b) => ({ id: b.id, name: b.name, models: modelsByBrand.get(b.id) ?? [] }));
}

function toDTO(o: typeof schema.priceObservations.$inferSelect): ObservationDTO {
  return {
    id: o.id,
    kind: o.kind,
    source: o.source,
    price: o.price,
    sampleSize: o.sampleSize,
    observedAt: o.observedAt.getTime(),
    warranty: o.warranty,
    condition: o.condition,
    url: o.url,
    note: o.note,
  };
}

export async function getObservations(variantId: string): Promise<ObservationDTO[]> {
  const rows = await db
    .select()
    .from(schema.priceObservations)
    .where(eq(schema.priceObservations.variantId, variantId))
    .orderBy(desc(schema.priceObservations.observedAt))
    .limit(500);
  return rows.map(toDTO);
}

export interface RecentObservation extends ObservationDTO {
  variantId: string;
  modelName: string;
  ramGb: number | null;
  storageGb: number;
}

export async function getRecentObservations(opts: { variantId?: string; limit?: number } = {}): Promise<RecentObservation[]> {
  const rows = await db
    .select({ o: schema.priceObservations, v: schema.variants, m: schema.models })
    .from(schema.priceObservations)
    .innerJoin(schema.variants, eq(schema.priceObservations.variantId, schema.variants.id))
    .innerJoin(schema.models, eq(schema.variants.modelId, schema.models.id))
    .where(opts.variantId ? eq(schema.priceObservations.variantId, opts.variantId) : undefined)
    .orderBy(desc(schema.priceObservations.observedAt), desc(schema.priceObservations.id))
    .limit(opts.limit ?? 50);
  return rows.map(({ o, v, m }) => ({
    ...toDTO(o),
    variantId: v.id,
    modelName: m.name,
    ramGb: v.ramGb,
    storageGb: v.storageGb,
  }));
}

export async function getSettings(): Promise<PricingSettings> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "pricing"));
  return mergeSettings(row?.value as Partial<PricingSettings> | undefined);
}

export async function getOverrides(): Promise<Overrides> {
  const rows = await db.select().from(schema.deductionOverrides);
  return Object.fromEntries(rows.map((r) => [`${r.factorId}:${r.optionId}`, { mode: r.mode, value: r.value }]));
}
