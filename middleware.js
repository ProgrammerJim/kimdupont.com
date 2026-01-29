import { NextResponse } from "next/server";

export function middleware(request) {
  const url = request.nextUrl;
  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.geo?.country ||
    "UNKNOWN";

  // Only protect /diary and everything under it
  if (url.pathname.startsWith("/diary")) {
    // Allow France only
    if (country !== "FR") {
      return new NextResponse("403 Forbidden — Diary is only available in France.", {
        status: 403,
        headers: {
          "content-type": "text/plain",
        },
      });

      // OR, if you prefer redirect instead of hard block:
      // url.pathname = "/";
      // return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Tell Vercel which paths this runs on
export const config = {
  matcher: ["/diary/:path*"],
};
