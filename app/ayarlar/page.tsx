import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions";
import { SettingsForm } from "@/components/SettingsForm";
import { authEnabled } from "@/lib/auth";
import { getOverrides, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ayarlar" };

export default async function AyarlarPage() {
  const [settings, overrides] = await Promise.all([getSettings(), getOverrides()]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
            Ayarlar
          </h1>
          <p className="mt-2 max-w-2xl text-muted">Kâr payların ve durum kesintilerin. Değişiklik bundan sonraki tekliflere uygulanır.</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/gecmis" className="rounded-md border border-line bg-paper px-3 py-2 hover:border-muted">
            Geçmiş
          </Link>
          <Link href="/kaynaklar" className="rounded-md border border-line bg-paper px-3 py-2 hover:border-muted">
            Kaynaklar
          </Link>
          {authEnabled() && (
            <form action={logout}>
              <button type="submit" className="rounded-md border border-line bg-paper px-3 py-2 hover:border-muted">
                Çıkış yap
              </button>
            </form>
          )}
        </nav>
      </header>
      <SettingsForm settings={settings} overrides={overrides} />
    </div>
  );
}
