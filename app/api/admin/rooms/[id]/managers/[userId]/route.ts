import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { AdminError, adminErrorStatus, removeRoomManager } from "@/lib/admin";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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

  const { id, userId } = await context.params;

  try {
    const result = await removeRoomManager(
      id,
      userId,
      { id: actor.user.id, role: actor.user.role },
    );
    return NextResponse.json(result);
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
