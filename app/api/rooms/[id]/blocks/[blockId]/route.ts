import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import { deleteBlock, RoomError, roomErrorStatus } from "@/lib/rooms";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; blockId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authenticateRequest(request);
  let actor: AuthContext;

  try {
    actor = requireRole(auth, ["PENGELOLA", "ADMIN"]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  const { id, blockId } = await context.params;

  try {
    await deleteBlock(id, blockId, {
      id: actor.user.id,
      role: actor.user.role,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RoomError) {
      return jsonError(
        roomErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
