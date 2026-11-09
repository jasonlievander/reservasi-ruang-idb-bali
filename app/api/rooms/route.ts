import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import {
  authenticateRequest,
  AuthorizationError,
  requireRole,
  type AuthContext,
} from "@/lib/auth/authorization";
import { listRooms } from "@/lib/rooms";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const capacityText = url.searchParams.get("capacity");
  const roomType = url.searchParams.get("type") ?? undefined;
  const managed = url.searchParams.get("managed") === "true";
  let managerId: string | undefined;

  let capacity: number | undefined;

  if (capacityText !== null) {
    capacity = Number(capacityText);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return jsonError(
        400,
        "INVALID_INPUT",
        "Kapasitas minimum harus bilangan bulat minimal 1.",
      );
    }
  }

  if (managed) {
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

    if (actor.user.role === "PENGELOLA") {
      managerId = actor.user.id;
    }
  }

  const rooms = await listRooms({ capacity, roomType, managerId });

  return NextResponse.json({ rooms });
}
