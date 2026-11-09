import { NextResponse } from "next/server";
import { jsonError, parseJsonObject } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import {
  createBlock,
  listBlocks,
  RoomError,
  roomErrorStatus,
} from "@/lib/rooms";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const asDate = (value: unknown): Date =>
  typeof value === "string" ? new Date(value) : new Date(Number.NaN);

export async function GET(request: Request, context: RouteContext) {
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

  try {
    const blocks = await listBlocks(id, {
      id: actor.user.id,
      role: actor.user.role,
    });
    return NextResponse.json({ blocks });
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
  const body = await parseJsonObject(request);

  if (!body) {
    return jsonError(400, "INVALID_JSON", "Body permintaan harus JSON.");
  }

  try {
    const block = await createBlock(
      {
        roomId: id,
        start: asDate(body.start),
        end: asDate(body.end),
        reason: typeof body.reason === "string" ? body.reason : "",
      },
      {
        id: actor.user.id,
        role: actor.user.role,
      },
    );

    return NextResponse.json({ block }, { status: 201 });
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
