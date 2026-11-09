import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import {
  AdminError,
  adminErrorStatus,
  updateUser,
  type UpdateUserInput,
} from "@/lib/admin";
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

export async function PATCH(request: Request, context: RouteContext) {
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

  if (!body) {
    return jsonError(400, "INVALID_JSON", "Body permintaan harus JSON.");
  }

  const input: UpdateUserInput = {
    ...(Object.prototype.hasOwnProperty.call(body, "role")
      ? { role: body.role as UpdateUserInput["role"] }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "active")
      ? { active: body.active as boolean }
      : {}),
  };

  try {
    const user = await updateUser(
      id,
      input,
      { id: actor.user.id, role: actor.user.role },
    );
    return NextResponse.json({ user });
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
