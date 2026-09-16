"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/ayarlar/actions";
import { type Adjustment, FACTORS, GROUPS, overrideKey, type Overrides } from "@/lib/pricing/conditions";
import { DEFAULT_SETTINGS, type PricingSettings } from "@/lib/pricing/settings";

const inputClass = "num h-11 w-24 rounded-lg border border-line bg-ground px-2 text-right text-lg font-bold";

function Field({
  label,
  help,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5">
      <span>
        <span className="font-medium">{label}</span>
        {help && <span className="block text-sm text-muted">{help}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className={inputClass}
        />
        <span className="w-4 text-sm text-muted">{suffix}</span>
      </span>
    </label>
  );
}

const pctOf = (ratio: number) => Math.round(ratio * 1000) / 10;

export function SettingsForm({ settings, overrides }: { settings: PricingSettings; overrides: Overrides }) {
  const [s, setS] = useState<PricingSettings>(settings);
  const [ov, setOv] = useState<Overrides>(overrides);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setM = (k: keyof PricingSettings["buyMargins"], v: number) => setS({ ...s, buyMargins: { ...s.buyMargins, [k]: v } });
  const setN = (k: keyof PricingSettings["newSale"], v: number) => setS({ ...s, newSale: { ...s.newSale, [k]: v } });

  function setOverride(factorId: string, optionId: string, def: Adjustment, next: Partial<Adjustment>) {
    const key = overrideKey(factorId, optionId);
    const cur = ov[key] ?? def;
    const merged = { ...cur, ...next };
    const copy = { ...ov };
    if (merged.mode === def.mode && merged.value === def.value) delete copy[key];
    else copy[key] = merged;
    setOv(copy);
  }

  function save() {
    start(async () => {
      const res = await saveSettings({
        settings: s,
        overrides: Object.entries(ov).map(([k, a]) => {
          const [factorId, optionId] = k.split(":");
          return { factorId, optionId, mode: a.mode, value: a.value };
        }),
      });
      setMessage(res.ok ? { tone: "ok", text: "Ayarlar kaydedildi. Yeni teklifler bu ayarlarla hesaplanır." } : { tone: "stop", text: res.error });
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-line bg-paper px-4 py-2 lg:px-6">
        <h2 className="eyebrow pt-3 pb-1 text-muted">Alış teklifi</h2>
        <div className="divide-y divide-line">
          <Field label="En çok teklif · kâr payı" help="Pazarlıkta çıkabileceğin üst sınır" value={s.buyMargins.max} onChange={(v) => setM("max", v)} suffix="%" />
          <Field label="Ortalama teklif · kâr payı" value={s.buyMargins.mid} onChange={(v) => setM("mid", v)} suffix="%" />
          <Field label="En az teklif · kâr payı" help="İlk söyleyeceğin fiyat" value={s.buyMargins.min} onChange={(v) => setM("min", v)} suffix="%" />
          <Field label="Cihaz başı en az kâr" value={s.minProfit} onChange={(v) => setS({ ...s, minProfit: v })} suffix="₺" step={50} />
          <Field
            label="İlan pazarlık payı"
            help="Sahibinden ilan fiyatından bu kadar düşülür"
            value={s.listingDiscount}
            onChange={(v) => setS({ ...s, listingDiscount: v })}
            suffix="%"
          />
          <Field
            label="Yenilenmiş fiyat oranı"
            help="Getmobil gibi yenilenmiş satış fiyatının dükkandaki satış fiyatına oranı"
            value={pctOf(s.refurbFactor)}
            onChange={(v) => setS({ ...s, refurbFactor: v / 100 })}
            suffix="%"
          />
          <Field
            label="Rakip alış oranı"
            help="Rakipler cihazı satış fiyatının yüzde kaçına alıyor"
            value={pctOf(s.buybackRatio)}
            onChange={(v) => setS({ ...s, buybackRatio: v / 100 })}
            suffix="%"
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-paper px-4 py-2 lg:px-6">
        <h2 className="eyebrow pt-3 pb-1 text-muted">Sıfır satış</h2>
        <div className="divide-y divide-line">
          <Field label="Maliyet üstü kâr" value={s.newSale.margin} onChange={(v) => setN("margin", v)} suffix="%" />
          <Field label="Cihaz başı en az kâr" value={s.newSale.minProfit} onChange={(v) => setN("minProfit", v)} suffix="₺" step={50} />
          <Field
            label="Toptan fiyat tahmini"
            help="Toptancı fiyatı yoksa piyasadaki en düşük fiyatın yüzde kaçı maliyet sayılır"
            value={pctOf(s.newSale.wholesaleFromRetail)}
            onChange={(v) => setN("wholesaleFromRetail", v / 100)}
            suffix="%"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold [font-stretch:105%]">Durum kesintileri</h2>
          <p className="mt-1 text-sm text-muted">
            Her cevabın kusursuz cihazın fiyatından ne kadar düşüreceği. Yüzde yerine sabit tutar da girebilirsin (ör. ekran
            değişimi 4.000 ₺). Eksi değer fiyatı artırır.
          </p>
        </div>
        {GROUPS.filter((g) => g.id !== "engel").map((g) => (
          <div key={g.id} className="rounded-lg border border-line bg-paper px-4 py-2 lg:px-6">
            <h3 className="eyebrow pt-3 pb-1 text-muted">{g.label}</h3>
            {FACTORS.filter((f) => f.group === g.id).map((f) => (
              <div key={f.id} className="border-t border-line py-2 first:border-t-0">
                <p className="pt-1 font-semibold">{f.label}</p>
                <ul>
                  {f.options.map((o) => {
                    const cur = ov[overrideKey(f.id, o.id)] ?? o.adj;
                    const changed = Boolean(ov[overrideKey(f.id, o.id)]);
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className={clsx("text-sm", changed && "font-semibold")}>
                          {o.label}
                          {changed && (
                            <span className="ml-1 font-mono text-[0.7rem] font-normal text-muted">
                              (varsayılan {o.adj.value}
                              {o.adj.mode === "pct" ? "%" : "₺"})
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={Number.isFinite(cur.value) ? cur.value : ""}
                            onChange={(e) => setOverride(f.id, o.id, o.adj, { value: e.target.valueAsNumber })}
                            aria-label={`${f.label}: ${o.label}`}
                            className="num h-10 w-24 rounded-lg border border-line bg-ground px-2 text-right text-base font-bold"
                          />
                          <select
                            value={cur.mode}
                            onChange={(e) => setOverride(f.id, o.id, o.adj, { mode: e.target.value as Adjustment["mode"] })}
                            aria-label="Birim"
                            className="h-10 rounded-lg border border-line bg-paper px-1 text-sm"
                          >
                            <option value="pct">%</option>
                            <option value="fixed">₺</option>
                          </select>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Telefonda içeriği az kapatsın diye tek satır */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-lg border border-line bg-paper p-2 lg:bottom-4">
        {message && (
          <p role="status" className={clsx("px-2 pb-2 text-sm font-medium", message.tone === "ok" ? "text-ok" : "text-stop")}>
            {message.text}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="h-11 flex-1 rounded-lg bg-ink px-4 font-semibold text-paper disabled:opacity-60 sm:flex-none sm:px-6">
            {pending ? "Kaydediliyor…" : "Ayarları kaydet"}
          </button>
          <button
            type="button"
            onClick={() => {
              setS(DEFAULT_SETTINGS);
              setOv({});
              setMessage(null);
            }}
            className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-muted hover:text-ink"
          >
            Varsayılanlar
          </button>
        </div>
      </div>
    </div>
  );
}
