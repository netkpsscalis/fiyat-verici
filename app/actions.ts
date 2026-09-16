"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authEnabled, createSessionToken, safeEqual, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { getObservations } from "@/lib/data";
import { db, schema } from "@/lib/db/client";
import { OBSERVATION_KINDS, WARRANTY_TYPES } from "@/lib/db/schema";
import type { ActionResult, ObservationDTO } from "@/lib/types";

export async function fetchMarket(variantId: string): Promise<ObservationDTO[]> {
  return getObservations(z.string().min(1).parse(variantId));
}

const observationInput = z.object({
  variantId: z.string().min(1, "Model ve hafıza seç."),
  kind: z.enum(OBSERVATION_KINDS),
  source: z.string().trim().min(1).max(40),
  price: z.number({ error: "Fiyat gir." }).positive("Fiyat sıfırdan büyük olmalı.").max(2_000_000, "Fiyat çok yüksek."),
  warranty: z.enum(WARRANTY_TYPES).nullable().optional(),
  condition: z.string().trim().max(60).nullable().optional(),
  url: z.union([z.url({ error: "Bağlantı geçerli bir adres değil." }).max(500), z.literal("")]).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

export async function addObservation(input: z.input<typeof observationInput>): Promise<ActionResult> {
  const parsed = observationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgiler eksik." };
  const d = parsed.data;
  await db.insert(schema.priceObservations).values({
    variantId: d.variantId,
    kind: d.kind,
    source: d.source,
    price: d.price,
    warranty: d.warranty ?? null,
    condition: d.condition || null,
    url: d.url || null,
    note: d.note || null,
    observedAt: new Date(),
  });
  revalidatePath("/piyasa");
  return { ok: true, data: undefined };
}

export async function deleteObservation(id: number): Promise<ActionResult> {
  await db.delete(schema.priceObservations).where(eq(schema.priceObservations.id, z.number().int().parse(id)));
  revalidatePath("/piyasa");
  return { ok: true, data: undefined };
}

const quoteInput = z.object({
  mode: z.enum(["buy", "sell_new"]),
  variantId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
});

export async function saveQuote(input: z.input<typeof quoteInput>): Promise<ActionResult<{ id: number }>> {
  const d = quoteInput.parse(input);
  const [row] = await db.insert(schema.quotes).values(d).returning({ id: schema.quotes.id });
  return { ok: true, data: { id: row.id } };
}

const transactionInput = z.object({
  type: z.enum(["buy", "sell"]),
  variantId: z.string().min(1),
  price: z.number().positive("Fiyat sıfırdan büyük olmalı.").max(2_000_000),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  quoteId: z.number().int().nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  /** Sıfır cihaz satışı: 2. el değerini etkilemesin diye sıfır perakende olarak işlenir */
  isNew: z.boolean().optional(),
  warranty: z.enum(WARRANTY_TYPES).nullable().optional(),
});

/** Kendi alım/satımını kaydeder; aynı zamanda piyasa verisi olarak da işler. */
export async function recordTransaction(input: z.input<typeof transactionInput>): Promise<ActionResult> {
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgiler eksik." };
  const d = parsed.data;
  await db.insert(schema.transactions).values({
    type: d.type,
    variantId: d.variantId,
    price: d.price,
    conditions: d.conditions ?? null,
    quoteId: d.quoteId ?? null,
    note: d.note || null,
  });
  await db.insert(schema.priceObservations).values({
    variantId: d.variantId,
    kind: d.type === "buy" ? "own_buy" : d.isNew ? "new_retail" : "own_sell",
    source: "own",
    warranty: d.warranty ?? null,
    price: d.price,
    observedAt: new Date(),
    note: d.note || null,
  });
  revalidatePath("/piyasa");
  return { ok: true, data: undefined };
}

export async function login(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  if (!authEnabled()) redirect("/al");
  const password = String(formData.get("sifre") ?? "");
  if (!safeEqual(password, process.env.APP_PASSWORD!)) return { error: "Şifre yanlış." };
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86_400,
    path: "/",
  });
  redirect("/al");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/giris");
}
