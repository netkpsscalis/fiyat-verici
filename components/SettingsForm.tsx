"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { recalibrate, saveSettings } from "@/app/ayarlar/actions";
import { type Adjustment, FACTORS, GROUPS, overrideKey, type Overrides } from "@/lib/pricing/conditions";
import { DEFAULT_SETTINGS, type PricingSettings, type SourceAdjust } from "@/lib/pricing/settings";

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

type SourceKey = keyof PricingSettings["sourceAdjust"];

const SOURCE_ROWS: { key: SourceKey; label: string; help: string }[] = [
  { key: "own_sell", label: "Kendi satışların", help: "Dükkanda sattığın fiyatlar. En güvenilir kaynak." },
  { key: "used_listing", label: "2. el ilanlar (Sahibinden vb.)", help: "Sahibinden, Dolap, Letgo ilan fiyatları. Dükkandaki satış fiyatın sayılır." },
  { key: "refurb_retail", label: "Yenilenmiş cihaz fiyatları (Getmobil)", help: "Garantili yenilenmiş fiyat. İlan ya da kendi satışın yoksa kullanılır." },
];

export function SettingsForm({ settings, overrides }: { settings: PricingSettings; overrides: Overrides }) {
  const [s, setS] = useState<PricingSettings>(settings);
  const [ov, setOv] = useState<Overrides>(overrides);
  const [message, setMessage] = useState<{ tone: "ok" | "stop"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setM = (k: keyof PricingSettings["buyMargins"], v: number) => setS({ ...s, buyMargins: { ...s.buyMargins, [k]: v } });
  const setAdjust = (key: SourceKey, patch: Partial<SourceAdjust>) =>
    setS({ ...s, sourceAdjust: { ...s.sourceAdjust, [key]: { ...s.sourceAdjust[key], ...patch } } });

  function setOverride(factorId: string, optionId: string, def: Adjustment, next: Partial<Adjustment>) {
    const key = overrideKey(factorId, optionId);
    const cur = ov[key] ?? def;
    const merged = { ...cur, ...next };
    const copy = { ...ov };
    if (merged.mode === def.mode && merged.value === def.value) delete copy[key];
    else copy[key] = merged;
    setOv(copy);
  }

  function runCalibration() {
    start(async () => {
      const res = await recalibrate();
      setMessage(res.ok ? { tone: "ok", text: res.data.message } : { tone: "stop", text: res.error });
    });
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
            label="Rakip alış oranı"
            help="Rakipler cihazı satış fiyatının yüzde kaçına alıyor"
            value={pctOf(s.buybackRatio)}
            onChange={(v) => setS({ ...s, buybackRatio: v / 100 })}
            suffix="%"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-paper px-4 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-xl font-bold [font-stretch:105%]">2. el fiyat kaynakları</h2>
          <p className="mt-1 text-sm text-muted">
            Her kaynağın fiyatı, senin dükkanında satabileceğin fiyata çevrilir. Oran ne kadar düşükse teklifin o kadar düşer.
            Yenilenmiş cihaz fiyatları garantili ve temizlenmiş cihaz fiyatı olduğu için dükkan 2. el fiyatının üstündedir.
          </p>
        </div>
        <div className="divide-y divide-line">
          {SOURCE_ROWS.map((row) => (
            <div key={row.key} className="py-3">
              <p className="font-medium">{row.label}</p>
              <p className="text-sm text-muted">{row.help}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span>Dükkan fiyatına oranı</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={Math.round(s.sourceAdjust[row.key].factor * 100)}
                    onChange={(e) => setAdjust(row.key, { factor: e.target.valueAsNumber / 100 })}
                    className="num h-10 w-20 rounded-lg border border-line bg-ground px-2 text-right text-base font-bold"
                  />
                  <span className="text-muted">%</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span>Ağırlık</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    value={s.sourceAdjust[row.key].weight}
                    onChange={(e) => setAdjust(row.key, { weight: e.target.valueAsNumber })}
                    className="num h-10 w-20 rounded-lg border border-line bg-ground px-2 text-right text-base font-bold"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-ground p-3">
          <p className="font-medium">Kendi işlemlerinden öğrenme</p>
          <p className="mt-1 text-sm text-muted">
            Uygulama, önerdiği fiyatlarla senin gerçekten aldığın ve sattığın fiyatları karşılaştırır; sürekli yüksek ya da
            düşük öneriyorsa kendini düzeltir. Şu anki düzeltme:{" "}
            <strong className="text-ink">
              ×{s.calibration.factor}
              {s.calibration.samples ? ` (${s.calibration.samples} işlem)` : " (henüz yeterli işlem yok)"}
            </strong>
          </p>
          <button
            type="button"
            onClick={runCalibration}
            disabled={pending}
            className="mt-2 h-10 rounded-lg border border-ink px-4 text-sm font-semibold disabled:opacity-60"
          >
            Şimdi hesapla
          </button>
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
