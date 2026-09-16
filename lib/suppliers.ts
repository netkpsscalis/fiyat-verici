/** Toptancı verileri: sadece sunucuda. */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

export async function getSuppliers() {
  return db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers).orderBy(schema.suppliers.name);
}

export async function getLearnedAliases() {
  return db.select({ alias: schema.aliases.alias, modelId: schema.aliases.modelId }).from(schema.aliases);
}

export async function getRecentUploads(limit = 20) {
  const rows = await db
    .select({
      id: schema.supplierUploads.id,
      supplierName: schema.suppliers.name,
      fileName: schema.supplierUploads.fileName,
      savedCount: schema.supplierUploads.savedCount,
      createdAt: schema.supplierUploads.createdAt,
    })
    .from(schema.supplierUploads)
    .innerJoin(schema.suppliers, eq(schema.supplierUploads.supplierId, schema.suppliers.id))
    .orderBy(desc(schema.supplierUploads.createdAt), desc(schema.supplierUploads.id))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
}
