import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "ruangidb_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "active"
>;

type SessionOptions = {
  db?: PrismaClient;
  now?: Date;
};

type SessionPayload = {
  sub: string;
  exp: number;
};

const SESSION_SECRET =
  process.env.DEMO_SESSION_SECRET ?? "siru-demo-session-secret";

const sign = (value: string) =>
  createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");

const encodeToken = (payload: SessionPayload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
};

const decodeToken = (token: string): SessionPayload | null => {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME && rest.length > 0) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export async function createSession(
  userId: string,
  options: SessionOptions = {},
): Promise<{ token: string; expiresAt: Date }> {
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  return {
    token: encodeToken({ sub: userId, exp: expiresAt.getTime() }),
    expiresAt,
  };
}

export async function getSessionUser(
  token: string | null,
  options: SessionOptions = {},
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  const payload = decodeToken(token);
  if (!payload) {
    return null;
  }

  const now = options.now ?? new Date();
  if (payload.exp <= now.getTime()) {
    return null;
  }

  const db = options.db ?? defaultDb;
  const user = await db.user.findUnique({ where: { id: payload.sub } });

  if (!user || !user.active) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

export async function revokeSession(
  token: string | null,
  options: SessionOptions = {},
): Promise<void> {
  void token;
  void options;
}
