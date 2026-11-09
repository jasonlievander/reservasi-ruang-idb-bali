import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getApprovalCardUrls } from "@/lib/approval-card";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import { completeFinishedReservations } from "@/lib/completion";
import {
  ApprovalError,
  approvalErrorStatus,
  listApprovalHistory,
  listPendingApprovals,
} from "@/lib/approvals";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  try {
    await completeFinishedReservations();

    const approvals = await listPendingApprovals({
      id: actor.user.id,
      role: actor.user.role,
    });
    const history = await listApprovalHistory({
      id: actor.user.id,
      role: actor.user.role,
    });
    const cardUrls = await getApprovalCardUrls(
      history.map((item) => item.id),
    );

    return NextResponse.json({
      approvals,
      history: history.map((item) => ({
        ...item,
        approvalCardUrl: cardUrls.get(item.id) ?? null,
      })),
    });
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
