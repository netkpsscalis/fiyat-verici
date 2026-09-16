import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (req.nextUrl.pathname === "/giris") return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/giris";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
