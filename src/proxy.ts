import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "ransay_session";
type CurrentUserRole = "ADMIN" | "SUPERADMIN";

const protectedRoutes = [
  "/",
  "/analytics",
  "/orders",
  "/all-orders",
  "/create-order",
  "/selected-orders",
  "/stocks",
  "/customers",
  "/products",
  "/finance",
  "/import",
];

const authApiRoutes = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
];

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isAllowedPath(pathname: string) {
  return (
    authApiRoutes.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

async function getSessionRole(request: NextRequest): Promise<CurrentUserRole | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = getAuthSecret();

  if (!token || !secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "SUPERADMIN" || payload.role === "ADMIN"
      ? payload.role
      : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAllowedPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    const role = await getSessionRole(request);

    if (role) {
      return NextResponse.redirect(new URL("/analytics", request.url));
    }

    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const role = await getSessionRole(request);

  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/orders" && role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/selected-orders", request.url));
  }

  if (pathname === "/all-orders" && role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/selected-orders", request.url));
  }

  if (pathname === "/analytics/total-sales" && role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/analytics/sales", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/orders",
    "/orders/:path*",
    "/all-orders",
    "/create-order",
    "/selected-orders",
    "/stocks",
    "/customers",
    "/customers/:path*",
    "/products",
    "/products/:path*",
    "/analytics",
    "/analytics/:path*",
    "/finance",
    "/finance/:path*",
    "/import",
  ],
};
