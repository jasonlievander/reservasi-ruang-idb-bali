import { NextResponse } from "next/server";
import {
  readSessionToken,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readSessionToken(request);

  if (token) {
    await revokeSession(token);
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
