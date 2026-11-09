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
import { getUsageReport, reportErrorStatus, ReportError } from "@/lib/reports";
import { buildUsageWorkbook, XLSX_CONTENT_TYPE } from "@/lib/report-xlsx";

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

  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");
  const fromText = url.searchParams.get("from");
  const toText = url.searchParams.get("to");
  const format = url.searchParams.get("format") ?? "json";

  if (!roomId || !fromText || !toText) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Parameter roomId, from, dan to wajib diisi.",
    );
  }

  try {
    await completeFinishedReservations();

    const report = await getUsageReport(
      {
        roomId,
        from: new Date(fromText),
        to: new Date(toText),
      },
      { id: actor.user.id, role: actor.user.role },
      { includeDetails: true },
    );

    const cardUrls = await getApprovalCardUrls(
      report.details.map((detail) => detail.id),
    );
    report.details = report.details.map((detail) => ({
      ...detail,
      approvalCardUrl: cardUrls.get(detail.id) ?? null,
    }));
    if (format === "xlsx") {
      const roomSlug = report.room.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const fileName = `rekap-${roomSlug || roomId}-${fromText.slice(0, 10)}-${toText.slice(0, 10)}.xlsx`;
      const workbook = await buildUsageWorkbook(report);

      return new NextResponse(new Uint8Array(workbook), {
        headers: {
          "content-type": XLSX_CONTENT_TYPE,
          "content-disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof ReportError) {
      return jsonError(
        reportErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
