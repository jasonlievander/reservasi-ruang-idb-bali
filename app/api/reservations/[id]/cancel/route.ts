import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireAuth,
  type AuthContext,
} from "@/lib/auth/authorization";
import {
  CancellationError,
  cancellationErrorStatus,
  cancelReservation,
} from "@/lib/cancellations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateRequest(request);
  let actor: AuthContext;

  try {
    actor = requireAuth(auth);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  const { id } = await context.params;
  const body = (await parseJsonObject(request)) ?? {};
  const reason = typeof body.reason === "string" ? body.reason : null;

  try {
    const reservation = await cancelReservation(
      id,
      { id: actor.user.id, role: actor.user.role },
      { reason },
    );

    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof CancellationError) {
      return jsonError(
        cancellationErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
