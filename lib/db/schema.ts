import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    name: text("name").notNull(),
    series: text("series").notNull(),
    releaseYear: integer("release_year").notNull(),
    /** "iphone" veya "android": hangi durum sorularının sorulacağını belirler */
    family: text("family", { enum: ["iphone", "android"] }).notNull(),
    hasBatteryHealth: integer("has_battery_health", { mode: "boolean" }).notNull().default(false),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("models_brand_idx").on(t.brandId)],
);

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    ramGb: integer("ram_gb"),
    storageGb: integer("storage_gb").notNull(),
  },
  (t) => [index("variants_model_idx").on(t.modelId)],
);

/** Toptancı listelerindeki model adlarını eşleştirirken öğrenilen takma adlar */
export const aliases = sqliteTable(
  "aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("aliases_alias_idx").on(t.alias)],
);

export const OBSERVATION_KINDS = [
  "new_retail",
  "new_wholesale",
  "buyback",
  "refurb_retail",
  "used_listing",
  "own_buy",
  "own_sell",
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export const WARRANTY_TYPES = ["resmi", "ithalatci", "yurtdisi", "yok"] as const;
export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export const priceObservations = sqliteTable(
  "price_observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    kind: text("kind", { enum: OBSERVATION_KINDS }).notNull(),
    /** "akakce", "easycep", "manual", "supplier" ... */
    source: text("source").notNull(),
    warranty: text("warranty", { enum: WARRANTY_TYPES }),
    /** Serbest metin: "A", "kusursuz", "B kalite" ... */
    condition: text("condition"),
    price: real("price").notNull(),
    /** Bu kayıt kaç ilanın ortası: Getmobil gibi toplu kaynaklarda 1'den büyük */
    sampleSize: integer("sample_size").notNull().default(1),
    observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
    url: text("url"),
    note: text("note"),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    uploadId: integer("upload_id").references(() => supplierUploads.id),
    createdAt: createdAt(),
  },
  (t) => [index("obs_variant_kind_idx").on(t.variantId, t.kind, t.observedAt)],
);

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  note: text("note"),
  createdAt: createdAt(),
});

export const supplierUploads = sqliteTable("supplier_uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  fileName: text("file_name"),
  rawText: text("raw_text").notNull(),
  savedCount: integer("saved_count").notNull().default(0),
  createdAt: createdAt(),
});

/** Varsayılan kesinti oranlarının kullanıcı tarafından değiştirilmiş halleri */
export const deductionOverrides = sqliteTable(
  "deduction_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factorId: text("factor_id").notNull(),
    optionId: text("option_id").notNull(),
    mode: text("mode", { enum: ["pct", "fixed"] }).notNull(),
    value: real("value").notNull(),
  },
  (t) => [uniqueIndex("deduction_factor_option_idx").on(t.factorId, t.optionId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["buy", "sell"] }).notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    price: real("price").notNull(),
    conditions: text("conditions", { mode: "json" }),
    quoteId: integer("quote_id").references(() => quotes.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("tx_variant_idx").on(t.variantId)],
);

export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mode: text("mode", { enum: ["buy", "sell_new"] }).notNull(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  input: text("input", { mode: "json" }).notNull(),
  result: text("result", { mode: "json" }).notNull(),
  createdAt: createdAt(),
});

/** Kullanıcının eklediği ürün sayfası linkleri (ör. Trendyol'daki bir iPhone sayfası). Her gün fiyatı okunur. */
export const trackedUrls = sqliteTable(
  "tracked_urls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    kind: text("kind", { enum: OBSERVATION_KINDS }).notNull(),
    url: text("url").notNull(),
    warranty: text("warranty", { enum: WARRANTY_TYPES }),
    lastPrice: real("last_price"),
    lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tracked_variant_url_idx").on(t.variantId, t.url)],
);

export const sourceStatus = sqliteTable("source_status", {
  source: text("source").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastOkAt: integer("last_ok_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  lastCount: integer("last_count"),
});
