"use client";

import { useEffect } from "react";

/** Uygulamanın telefona kurulabilmesi ve ağ yokken açılabilmesi için. Geliştirmede kapalı. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
