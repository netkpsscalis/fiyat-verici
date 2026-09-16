/** Kaynak durumu ve takip linkleri: sadece sunucuda. */
import { desc, eq } from "drizzle-orm";
import { suggestModelName } from "@/lib/sources/unmatched";
import { db, schema } from "@/lib/db/client";
import { SOURCES } from "@/lib/sources/run";

export async function getSourceStatuses() {
  const rows = await db.select().from(schema.sourceStatus);
  const byId = new Map(rows.map((r) => [r.source, r]));
  return SOURCES.map((id) => {
    const r = byId.get(id);
    return {
      id,
      enabled: r?.enabled ?? true,
      lastRunAt: r?.lastRunAt?.getTime() ?? null,
      lastOkAt: r?.lastOkAt?.getTime() ?? null,
      lastError: r?.lastError ?? null,
      lastCount: r?.lastCount ?? null,
    };
  });
}

export async function getTrackedUrls() {
  const rows = await db
    .select({ t: schema.trackedUrls, v: schema.variants, m: schema.models })
    .from(schema.trackedUrls)
    .innerJoin(schema.variants, eq(schema.trackedUrls.variantId, schema.variants.id))
    .innerJoin(schema.models, eq(schema.variants.modelId, schema.models.id))
    .orderBy(desc(schema.trackedUrls.createdAt));
  return rows.map(({ t, v, m }) => ({
    id: t.id,
    url: t.url,
    kind: t.kind,
    warranty: t.warranty,
    lastPrice: t.lastPrice,
    lastCheckedAt: t.lastCheckedAt?.getTime() ?? null,
    lastError: t.lastError,
    modelName: m.name,
    ramGb: v.ramGb,
    storageGb: v.storageGb,
  }));
}

/** Kaynaklarda görülen ama katalogda olmayan telefonlar, en çok görülenden başlayarak. */
export async function getUnmatchedProducts(limit = 60) {
  const rows = await db
    .select()
    .from(schema.unmatchedProducts)
    .orderBy(desc(schema.unmatchedProducts.seenCount), desc(schema.unmatchedProducts.lastSeenAt))
    .limit(limit);
  // Aynı modelin renkleri tek satırda toplanır
  const grouped = new Map<string, {
    id: number;
    source: string;
    name: string;
    price: number | null;
    brandId: string | null;
    ramGb: number | null;
    storageGb: number | null;
    seenCount: number;
    suggestedName: string;
    variantCount: number;
  }>();
  for (const r of rows) {
    const suggestedName = suggestModelName(r.name, r.brandId);
    if (!suggestedName) continue;
    const key = `${r.brandId}|${suggestedName.toLocaleLowerCase("tr")}|${r.storageGb ?? ""}`;
    const cur = grouped.get(key);
    if (cur) {
      cur.seenCount += r.seenCount;
      cur.variantCount++;
      if (r.price && (!cur.price || r.price < cur.price)) cur.price = r.price;
      continue;
    }
    grouped.set(key, {
      id: r.id,
      source: r.source,
      name: r.name,
      price: r.price,
      brandId: r.brandId,
      ramGb: r.ramGb,
      storageGb: r.storageGb,
      seenCount: r.seenCount,
      suggestedName,
      variantCount: 1,
    });
  }
  return [...grouped.values()].sort((a, b) => b.seenCount - a.seenCount);
}

export type UnmatchedRow = Awaited<ReturnType<typeof getUnmatchedProducts>>[number];
