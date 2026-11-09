import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import {
  RoomError,
  roomErrorStatus,
  updateRoom,
  type UpdateRoomInput,
} from "@/lib/rooms";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const has = (body: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(body, key);

export async function PATCH(request: Request, context: RouteContext) {
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
  const body = await parseJsonObject(request);

  if (!body) {
    return jsonError(400, "INVALID_JSON", "Body permintaan harus JSON.");
  }

  const input: UpdateRoomInput = {};

  if (has(body, "name")) input.name = body.name as string;
  if (has(body, "building")) input.building = body.building as string;
  if (has(body, "floor")) input.floor = body.floor as string;
  if (has(body, "capacity")) input.capacity = body.capacity as number;
  if (has(body, "facilities")) input.facilities = body.facilities as string[];
  if (has(body, "roomType")) input.roomType = body.roomType as string;
  if (has(body, "openTime")) input.openTime = body.openTime as string;
  if (has(body, "closeTime")) input.closeTime = body.closeTime as string;
  if (has(body, "requiresApproval")) {
    input.requiresApproval = body.requiresApproval as boolean;
  }
  if (has(body, "maxDurationMinutes")) {
    input.maxDurationMinutes = body.maxDurationMinutes as number;
  }
  if (has(body, "cancellationDeadlineMinutes")) {
    input.cancellationDeadlineMinutes =
      body.cancellationDeadlineMinutes as number;
  }
  if (has(body, "attachmentRequired")) {
    input.attachmentRequired = body.attachmentRequired as boolean;
  }
  if (has(body, "active")) input.active = body.active as boolean;

  try {
    const room = await updateRoom(id, input, {
      id: actor.user.id,
      role: actor.user.role,
    });

    return NextResponse.json({ room });
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
