/** Kaynak durumu ve takip linkleri: sadece sunucuda. */
import { desc, eq } from "drizzle-orm";
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
