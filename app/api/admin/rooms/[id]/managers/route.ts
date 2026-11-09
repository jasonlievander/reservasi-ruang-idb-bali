import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import { AdminError, adminErrorStatus, assignRoomManager } from "@/lib/admin";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const body = await parseJsonObject(request);

  if (!body || typeof body.userId !== "string" || !body.userId) {
    return jsonError(400, "INVALID_INPUT", "userId wajib diisi.");
  }

  try {
    const assignment = await assignRoomManager(
      id,
      body.userId,
      { id: actor.user.id, role: actor.user.role },
    );
    return NextResponse.json({ assignment }, { status: 201 });
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
