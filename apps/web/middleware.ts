// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isHomePage = nextUrl.pathname === "/";
  const isAuthPage = nextUrl.pathname.startsWith("/login") ||
                     nextUrl.pathname.startsWith("/register") ||
                     nextUrl.pathname.startsWith("/forgot-password") ||
                     nextUrl.pathname.startsWith("/reset-password");
  const isMarketingPage = nextUrl.pathname.startsWith("/pricing") ||
                          nextUrl.pathname.startsWith("/about") ||
                          nextUrl.pathname.startsWith("/terms") ||
                          nextUrl.pathname.startsWith("/privacy");
  const isPublicPage = isHomePage || isAuthPage || isMarketingPage;
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isApiRoute = nextUrl.pathname.startsWith("/api/");
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard") ||
                           nextUrl.pathname.startsWith("/agents") ||
                           nextUrl.pathname.startsWith("/conversations") ||
                           nextUrl.pathname.startsWith("/settings") ||
                           nextUrl.pathname.startsWith("/api-keys") ||
                           nextUrl.pathname.startsWith("/billing") ||
                           nextUrl.pathname.startsWith("/branding") ||
                           nextUrl.pathname.startsWith("/sub-accounts");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  // Allow API routes
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Allow public pages
  if (isPublicPage) {
    return NextResponse.next();
  }

  // Admin routes: require ADMIN role
  if (isAdminRoute) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has admin role
    const user = req.auth?.user as { role?: string } | undefined;
    if (user?.role !== "ADMIN") {
      // Redirect non-admins to dashboard with error
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized", nextUrl));
    }

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
