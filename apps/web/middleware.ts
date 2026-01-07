// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isHomePage = nextUrl.pathname === "/";
  const isAuthPage = nextUrl.pathname.startsWith("/login") ||
                     nextUrl.pathname.startsWith("/register");
  const isPublicPage = isHomePage || isAuthPage;
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard") ||
                           nextUrl.pathname.startsWith("/agents") ||
                           nextUrl.pathname.startsWith("/conversations") ||
                           nextUrl.pathname.startsWith("/settings") ||
                           nextUrl.pathname.startsWith("/api-keys");

  // Allow API auth routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Allow public pages
  if (isPublicPage) {
    return NextResponse.next();
  }

  // Redirect non-logged-in users to login for protected routes
  if (isDashboardRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files and API routes (except auth)
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.png$|.*\\.jpg$|api(?!/auth)).*)",
  ],
};
