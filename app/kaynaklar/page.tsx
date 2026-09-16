import type { Metadata } from "next";
import Link from "next/link";
import { CheckTrackedButton, DeleteTrackedButton, SourceToggle, TrackedUrlForm } from "@/components/SourceControls";
import { getCatalog } from "@/lib/data";
import { formatAge, formatTL, KIND_LABELS, SOURCE_LABELS, variantLabel } from "@/lib/format";
import { DAY_MS } from "@/lib/pricing/stats";
import { sourceNameFromUrl } from "@/lib/sources/http";
import { getSourceStatuses, getTrackedUrls } from "@/lib/sourcesData";

export const dynamic = "force-dynamic";
/** Linkleri kontrol etmek birkaç siteyi sırayla okur; ücretsiz Vercel planında üst sınır 60 sn */
export const maxDuration = 60;
export const metadata: Metadata = { title: "Kaynaklar" };

const DESCRIPTIONS: Record<string, string> = {
  getmobil: "Yenilenmiş cihaz satış fiyatları. Katalogdaki her model için Getmobil'deki ilanlar okunur.",
  tracked: "Senin eklediğin ürün sayfaları.",
};

export default async function KaynaklarPage() {
  const [catalog, statuses, tracked] = await Promise.all([getCatalog(), getSourceStatuses(), getTrackedUrls()]);
  const now = Date.now();
  const age = (t: number | null) => (t ? formatAge((now - t) / DAY_MS) : "hiç çalışmadı");

  return (
    <div className="space-y-8">
      <header>
        <Link href="/piyasa" className="text-sm text-muted underline underline-offset-2">
          ← Piyasa
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
          Kaynaklar
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Otomatik kaynaklar her sabah 07:00&apos;de okunur. Akakçe, Cimri, Hepsiburada ve Sahibinden bot doğrulaması
          istediği için otomatik okunamaz; oradaki fiyatları Piyasa sayfasından elle ekle.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {statuses.map((s) => (
          <div key={s.id} className="space-y-2 rounded-lg border border-line bg-paper p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold [font-stretch:105%]">{SOURCE_LABELS[s.id] ?? s.id}</h2>
              <span
                className={
                  !s.lastRunAt ? "text-sm font-medium text-muted" : s.lastError ? "text-sm font-medium text-stop" : "text-sm font-medium text-ok"
                }
              >
                {s.lastRunAt ? (s.lastError ? "Hata" : "Çalışıyor") : "Bekliyor"}
              </span>
            </div>
            <p className="text-sm text-muted">{DESCRIPTIONS[s.id]}</p>
            <p className="font-mono text-xs text-muted">
              Son okuma: {age(s.lastRunAt)}
              {s.lastCount !== null ? ` · ${s.lastCount} kayıt` : ""}
            </p>
            {s.lastError && <p className="text-sm text-stop">{s.lastError}</p>}
            <SourceToggle source={s.id} enabled={s.enabled} />
          </div>
        ))}
      </section>

      <TrackedUrlForm catalog={catalog} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow text-muted">Takip edilen linkler</h2>
          {tracked.length > 0 && <CheckTrackedButton />}
        </div>
        {tracked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-muted">
            Henüz link eklenmedi.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {tracked.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {t.modelName} · {variantLabel(t)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {KIND_LABELS[t.kind]} ·{" "}
                    <a href={t.url} target="_blank" rel="noreferrer" className="underline">
                      {SOURCE_LABELS[sourceNameFromUrl(t.url)] ?? sourceNameFromUrl(t.url)}
                    </a>{" "}
                    · {age(t.lastCheckedAt)}
                  </p>
                  {t.lastError && <p className="text-xs text-stop">{t.lastError}</p>}
                </div>
                <p className="num shrink-0 text-lg font-bold">{formatTL(t.lastPrice)}</p>
                <DeleteTrackedButton id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
