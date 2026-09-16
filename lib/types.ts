import type { ObservationKind, WarrantyType } from "@/lib/db/schema";
import type { Family } from "@/lib/pricing/conditions";

export interface CatalogVariant {
  id: string;
  ramGb: number | null;
  storageGb: number;
}

export interface CatalogModel {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  series: string;
  releaseYear: number;
  family: Family;
  hasBatteryHealth: boolean;
  variants: CatalogVariant[];
}

export interface CatalogBrand {
  id: string;
  name: string;
  models: CatalogModel[];
}

export interface ObservationDTO {
  id: number;
  kind: ObservationKind;
  source: string;
  price: number;
  /** Kaç ilanın ortası (toplu kaynaklar) */
  sampleSize: number;
  /** milisaniye */
  observedAt: number;
  warranty: WarrantyType | null;
  condition: string | null;
  url: string | null;
  note: string | null;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
