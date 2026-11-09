import { createHash, randomBytes } from "node:crypto";
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

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

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
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getSessionUser(
  token: string | null,
  options: SessionOptions = {},
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();

  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime() ||
    !session.user.active
  ) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    active: session.user.active,
  };
}

export async function revokeSession(
  token: string | null,
  options: SessionOptions = {},
): Promise<void> {
  if (!token) {
    return;
  }

  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();

  await db.session.updateMany({
    where: { tokenHash: tokenHash(token), revokedAt: null },
    data: { revokedAt: now },
  });
}
