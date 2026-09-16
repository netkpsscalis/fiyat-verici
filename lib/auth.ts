/** Tek dükkan için basit giriş: şifre env'de, oturum imzalı çerezde. */
export const SESSION_COOKIE = "fv_oturum";
export const SESSION_DAYS = 90;

export function authEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

async function hmac(message: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET tanımlı değil");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const issued = String(now);
  return `${issued}.${await hmac(issued)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [issued, sig] = token.split(".");
  if (!issued || !sig) return false;
  const age = now - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_DAYS * 86_400_000) return false;
  return safeEqual(sig, await hmac(issued));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
