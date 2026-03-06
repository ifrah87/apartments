import { NextRequest, NextResponse } from "next/server";
import { getAuthSecret, signSession, verifySession } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Hostname detection
// ---------------------------------------------------------------------------
function getHost(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost"
  ).split(":")[0];
}

const MARKETING_HOSTS = new Set([
  "orfanerealestate.so",
  "www.orfanerealestate.so",
  "orfanerealestate.localhost", // local dev preview
]);

const APP_HOSTS = new Set([
  "app.orfanerealestate.so",
]);

// localhost always goes to the app (ERP)
function isMarketing(host: string) { return MARKETING_HOSTS.has(host); }
function isApp(host: string)       { return APP_HOSTS.has(host) || host.startsWith("localhost") || host.startsWith("127.0.0.1"); }

function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_BYPASS !== "0";
}

async function buildDevSession() {
  return signSession(
    {
      sub: "dev-admin",
      role: "admin",
      name: "Local Admin",
      phone: null,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    },
    getAuthSecret(),
  );
}

// ---------------------------------------------------------------------------
// Paths that never need an auth check
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/health",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
  maxAge: 60 * 60 * 12,
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(req: NextRequest) {
  const host = getHost(req);
  const { pathname } = req.nextUrl;

  // ── Always pass through: Next.js internals + static assets ──────────────
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/fonts/") ||
    pathname.includes(".")           // .ico, .png, .svg, .js, .css, etc.
  ) {
    return NextResponse.next();
  }

  // ── Marketing domain: pass through (no auth) ────────────────────────────
  if (isMarketing(host)) {
    return NextResponse.next();
  }

  // ── App domain: enforce authentication on ALL routes ────────────────────
  if (isApp(host)) {
    // Public paths never need auth
    if (isPublic(pathname)) return NextResponse.next();

    // Verify session cookie
    const token = req.cookies.get("session")?.value;
    let authenticated = false;
    if (token) {
      try {
        const payload = await verifySession(token, getAuthSecret());
        if (payload) authenticated = true;
      } catch {
        // expired / tampered — fall through
      }
    }

    // Dev bypass: auto-inject a valid session instead of blocking
    if (!authenticated && isDevAuthBypassEnabled()) {
      const session = await buildDevSession();

      if (pathname === "/login") {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/dashboard";
        redirectUrl.search = "";
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set("session", session, SESSION_COOKIE_OPTS);
        return response;
      }

      const response = NextResponse.next();
      response.cookies.set("session", session, SESSION_COOKIE_OPTS);
      return response;
    }

    if (authenticated) return NextResponse.next();

    // Not authenticated ──────────────────────────────────────────────────
    // API routes: return 401 JSON (don't redirect, callers expect JSON)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // UI routes: redirect to /login preserving destination
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Unknown host — pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
