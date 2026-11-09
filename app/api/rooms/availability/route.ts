import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import {
  RoomError,
  roomErrorStatus,
  searchAvailableRooms,
} from "@/lib/rooms";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startText = url.searchParams.get("start");
  const endText = url.searchParams.get("end");
  const capacityText = url.searchParams.get("capacity");
  const roomType = url.searchParams.get("type") ?? undefined;

  if (!startText || !endText) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Parameter start dan end wajib diisi.",
    );
  }

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

  try {
    const rooms = await searchAvailableRooms({
      start: new Date(startText),
      end: new Date(endText),
      capacity,
      roomType,
    });

    return NextResponse.json({ rooms });
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
