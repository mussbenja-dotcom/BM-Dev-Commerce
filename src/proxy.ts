import { NextResponse, type NextRequest } from "next/server";
import { findSlugByHost, isPlatformHost, STORE_HOST_HEADER } from "@/lib/store/resolve";

// Paths that always belong to the platform, never to a storefront rewrite.
// robots.txt and sitemap.xml are served by the app for every host: they detect the store by Host.
const PLATFORM_PREFIXES = ["/_next", "/api", "/admin", "/superadmin", "/login", "/uploads", "/s/", "/robots.txt", "/sitemap.xml"];

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Never let clients spoof the internal header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(STORE_HOST_HEADER);

  if (isPlatformHost(host) || PLATFORM_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const slug = await findSlugByHost(host.split(":")[0]);
  if (!slug) return NextResponse.next({ request: { headers: requestHeaders } });

  requestHeaders.set(STORE_HOST_HEADER, host);
  const url = request.nextUrl.clone();
  url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
