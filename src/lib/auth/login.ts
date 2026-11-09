import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export type PublicUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "active"
>;

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginFailure = {
  ok: false;
  code: "INVALID_CREDENTIALS" | "TOO_MANY_ATTEMPTS";
  retryAfterSeconds?: number;
};

export type LoginSuccess = {
  ok: true;
  user: PublicUser;
  token: string;
  expiresAt: Date;
};

export type LoginResult = LoginSuccess | LoginFailure;

type LoginOptions = {
  db?: PrismaClient;
  now?: Date;
};

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
});

const retryAfter = (lockedUntil: Date, now: Date) =>
  Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));

async function recordFailure(
  db: PrismaClient,
  key: string,
  now: Date,
): Promise<boolean> {
  const existing = await db.loginThrottle.findUnique({ where: { key } });

  if (
    !existing ||
    now.getTime() - existing.windowStartedAt.getTime() >= ATTEMPT_WINDOW_MS
  ) {
    await db.loginThrottle.upsert({
      where: { key },
      update: {
        failedCount: 1,
        windowStartedAt: now,
        lockedUntil: null,
      },
      create: {
        key,
        failedCount: 1,
        windowStartedAt: now,
      },
    });
    return false;
  }

  const failedCount = existing.failedCount + 1;
  const locked = failedCount >= MAX_FAILED_ATTEMPTS;

  await db.loginThrottle.update({
    where: { key },
    data: {
      failedCount,
      lockedUntil: locked ? new Date(now.getTime() + LOCK_MS) : null,
    },
  });

  return locked;
}

export async function loginWithPassword(
  input: LoginInput,
  options: LoginOptions = {},
): Promise<LoginResult> {
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();
  const email = input.email?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";

  if (!email || !password) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const throttle = await db.loginThrottle.findUnique({ where: { key: email } });

  if (throttle?.lockedUntil && throttle.lockedUntil.getTime() > now.getTime()) {
    return {
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      retryAfterSeconds: retryAfter(throttle.lockedUntil, now),
    };
  }

  if (
    throttle &&
    now.getTime() - throttle.windowStartedAt.getTime() >= ATTEMPT_WINDOW_MS
  ) {
    await db.loginThrottle.deleteMany({ where: { key: email } });
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordValid = await verifyPassword(password, user?.passwordHash);

  if (!user || !user.active || !passwordValid) {
    const locked = await recordFailure(db, email, now);

    if (locked) {
      return {
        ok: false,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: Math.ceil(LOCK_MS / 1000),
      };
    }

    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  await db.loginThrottle.deleteMany({ where: { key: email } });

  const session = await createSession(user.id, { db, now });

  return {
    ok: true,
    user: toPublicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}
