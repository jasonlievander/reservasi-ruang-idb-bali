import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import {
  ApprovalError,
  approvalErrorStatus,
  rejectReservation,
} from "@/lib/approvals";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const body = (await parseJsonObject(request)) ?? {};
  const reason = typeof body.reason === "string" ? body.reason : "";

  try {
    const reservation = await rejectReservation(
      id,
      { id: actor.user.id, role: actor.user.role },
      reason,
    );

    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return jsonError(
        approvalErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
