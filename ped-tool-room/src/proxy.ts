import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySession } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/wipro-logo") ||
    // Static assets carry no data worth protecting, and the login page needs
    // them *before* anyone has a session — a media type missing from this list
    // gets redirected to /login and silently fails to render there. Video and
    // fonts were the gap: the logo (.jpg) loaded while the login background
    // (.mp4) was bounced.
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|ogg|woff|woff2|ttf)$/i)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
