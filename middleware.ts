import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isNextAuthRoute = pathname.startsWith("/api/auth");
  const isApiRoute = pathname.startsWith("/api/");

  const isPublicAsset =
    /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|css|js)$/i.test(
      pathname
    );

  const publicRoutes = ["/", "/login", "/signup"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Allow NextAuth routes and files from /public.
  if (pathname === "/api/auth/signin") {
  return NextResponse.redirect(new URL("/login", req.nextUrl));
}

if (isNextAuthRoute || isPublicAsset) {
  return NextResponse.next();
}

  // Logged-in users should not see login or signup.
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Protect non-auth API routes.
  if (!isLoggedIn && isApiRoute) {
    return NextResponse.json(
      { error: "NOT_AUTHENTICATED" },
      { status: 401 }
    );
  }

  // Allow public pages.
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protect all other pages.
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
