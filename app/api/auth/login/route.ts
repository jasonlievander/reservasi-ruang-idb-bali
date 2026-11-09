import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { loginWithPassword } from "@/lib/auth/login";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

const parseBody = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!body) {
    return jsonError(400, "INVALID_JSON", "Body permintaan harus JSON.");
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonError(400, "INVALID_INPUT", "Email dan password wajib diisi.");
  }

  const result = await loginWithPassword({ email, password });

  if (!result.ok) {
    if (result.code === "TOO_MANY_ATTEMPTS") {
      return NextResponse.json(
        {
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: "Terlalu banyak percobaan login. Coba lagi nanti.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds ?? 900),
          },
        },
      );
    }

    return jsonError(
      401,
      "INVALID_CREDENTIALS",
      "Email atau password salah.",
    );
  }

  const response = NextResponse.json({ user: result.user });

  response.cookies.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
  });

  return response;
}
