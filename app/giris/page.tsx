"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col justify-center">
      <div className="price-tag px-7 pt-9 pb-6">
        <p className="eyebrow">Dükkan girişi</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold uppercase leading-none [font-stretch:118%]">Fiyat Verici</h1>
      </div>
      <form action={action} className="mt-6 space-y-3">
        <label htmlFor="sifre" className="block text-sm font-medium">
          Şifre
        </label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-base"
        />
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-stop">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-ink font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
