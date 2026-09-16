/**
 * Kurallı sayfa okuma: kendini açıkça tanıtır, robots.txt'e uyar, aynı siteye art arda
 * istek atmaz. Bot doğrulaması isteyen siteleri atlatmaya çalışmaz; hata verip geçer.
 */
import { isAllowed, parseRobots, type RobotsRules } from "./robots";

export const USER_AGENT = "Mozilla/5.0 (compatible; FiyatVerici/0.1; dukkan fiyat takibi)";

/** Site erişime izin vermiyor: robots.txt yasağı, 403/429 ya da bot doğrulaması */
export class BlockedError extends Error {}

const robotsCache = new Map<string, RobotsRules | null>();
const lastHit = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function robotsFor(origin: string): Promise<RobotsRules | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  let rules: RobotsRules | null = null;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // robots.txt okunamazsa kısıtlama yok sayılır
  }
  robotsCache.set(origin, rules);
  return rules;
}

export async function politeFetch(
  url: string,
  opts: { delayMs?: number; timeoutMs?: number; retryAfterMs?: number } = {},
): Promise<string> {
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  if (rules && !isAllowed(rules, u.pathname + u.search)) {
    throw new BlockedError(`${u.hostname} bu sayfanın otomatik okunmasına izin vermiyor (robots.txt).`);
  }

  const wait = (lastHit.get(u.host) ?? 0) + (opts.delayMs ?? 2500) - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(u.host, Date.now());

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "tr-TR,tr;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    redirect: "follow",
  });
  if (res.status === 403 || res.status === 429) {
    // Kısa sürede çok istek atılmışsa site geçici kısıtlar: bir kez bekleyip yeniden dene
    if (opts.retryAfterMs) {
      await sleep(opts.retryAfterMs);
      lastHit.set(u.host, Date.now());
      const retry = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr-TR,tr;q=0.9", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
        redirect: "follow",
      });
      if (retry.ok) return retry.text();
      throw new BlockedError(`${u.hostname} erişimi engelledi (${retry.status}). Biraz sonra tekrar dene.`);
    }
    throw new BlockedError(`${u.hostname} erişimi engelledi (${res.status}).`);
  }
  if (!res.ok) throw new Error(`${u.hostname} sayfası açılamadı (${res.status}).`);
  const text = await res.text();
  if (text.length < 20_000 && /cf-chl|challenge-platform|captcha/i.test(text)) {
    throw new BlockedError(`${u.hostname} bot doğrulaması istiyor; bu kaynak otomatik okunamaz.`);
  }
  return text;
}

/** Linkten kısa kaynak adı: "https://www.trendyol.com/..." → "trendyol" */
export function sourceNameFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host.split(".")[0];
}
