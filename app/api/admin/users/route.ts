import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { AdminError, adminErrorStatus, listUsers } from "@/lib/admin";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  let actor: AuthContext;

  try {
    actor = requireRole(auth, ["ADMIN"]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  try {
    const users = await listUsers({
      id: actor.user.id,
      role: actor.user.role,
    });
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(
        adminErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
