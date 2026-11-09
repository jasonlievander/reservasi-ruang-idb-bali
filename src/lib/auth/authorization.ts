import type { PrismaClient, Role } from "@prisma/client";
import {
  getSessionUser,
  readSessionToken,
  type SessionUser,
} from "@/lib/auth/session";

export type AuthContext = {
  user: SessionUser;
  token: string;
};

export class AuthorizationError extends Error {
  readonly status: number;
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN";

  constructor(
    status: number,
    code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
    this.code = code;
  }
}

export async function authenticateRequest(
  request: Request,
  options: { db?: PrismaClient; now?: Date } = {},
): Promise<AuthContext | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }

  const user = await getSessionUser(token, options);
  return user ? { user, token } : null;
}

export function requireAuth(auth: AuthContext | null): AuthContext {
  if (!auth) {
    throw new AuthorizationError(
      401,
      "UNAUTHENTICATED",
      "Anda harus login terlebih dahulu.",
    );
  }

  return auth;
}

export function requireRole(
  auth: AuthContext | null,
  allowedRoles: Role[],
): AuthContext {
  const context = requireAuth(auth);

  if (!allowedRoles.includes(context.user.role)) {
    throw new AuthorizationError(
      403,
      "FORBIDDEN",
      "Anda tidak memiliki akses untuk tindakan ini.",
    );
  }

  return context;
}
