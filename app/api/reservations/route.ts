import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getApprovalCardUrls } from "@/lib/approval-card";
import {
  authenticateRequest,
  AuthorizationError,
  requireAuth,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import { getSessionUser, readSessionToken } from "@/lib/auth/session";
import { completeFinishedReservations } from "@/lib/completion";
import { prisma } from "@/lib/prisma";
import {
  createReservation,
  ReservationError,
  type ReservationErrorCode,
} from "@/lib/reservations";

export const runtime = "nodejs";

const errorStatus: Record<ReservationErrorCode, number> = {
  INVALID_INPUT: 400,
  ATTACHMENT_REQUIRED: 400,
  USER_NOT_FOUND: 404,
  USER_INACTIVE: 403,
  ROOM_NOT_FOUND: 404,
  ROOM_INACTIVE: 409,
  ORGANIZATION_NOT_FOUND: 404,
  SLOT_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  LIMIT_EXCEEDED: 409,
  ADVANCE_WINDOW_EXCEEDED: 400,
  WRITE_CONFLICT: 409,
};

const parseBody = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asOptionalString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asDate = (value: unknown): Date =>
  typeof value === "string" ? new Date(value) : new Date(Number.NaN);

const asNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number.NaN;

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  let context: AuthContext;

  try {
    context = requireAuth(auth);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  await completeFinishedReservations({ db: prisma });

  const reservations = await prisma.reservation.findMany({
    where: { userId: context.user.id },
    orderBy: { start: "desc" },
    include: {
      history: { orderBy: { createdAt: "asc" } },
      room: {
        select: {
          id: true,
          name: true,
          building: true,
          floor: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const cardUrls = await getApprovalCardUrls(
    reservations.map((reservation) => reservation.id),
  );

  return NextResponse.json({
    reservations: reservations.map((reservation) => ({
      ...reservation,
      approvalCardUrl: cardUrls.get(reservation.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const token = readSessionToken(request);
  const user = token ? await getSessionUser(token) : null;
  const auth: AuthContext | null = user && token ? { user, token } : null;

  let context: AuthContext;

  try {
    context = requireRole(auth, ["PEMINJAM"]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }

  const body = await parseBody(request);

  if (!body) {
    return jsonError(400, "INVALID_JSON", "Body permintaan harus JSON.");
  }

  try {
    const reservation = await createReservation({
      userId: context.user.id,
      roomId: asString(body.roomId),
      organizationId: asOptionalString(body.organizationId),
      start: asDate(body.start),
      end: asDate(body.end),
      type: body.type as "ORGANISASI" | "PRIBADI",
      activityName: asString(body.activityName),
      participantCount: asNumber(body.participantCount),
      idempotencyKey: asString(body.idempotencyKey),
      attachmentUrl: asOptionalString(body.attachmentUrl),
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationError) {
      return jsonError(
        errorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
