import type { Prisma, PrismaClient, Room } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";
import { isSameWitaDay, parseTimeOfDay, witaMillisecondsOfDay } from "@/lib/wita";

const ACTIVE_STATUSES = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] as const;
const MS_PER_MINUTE = 60_000;

export type RoomErrorCode =
  | "INVALID_INPUT"
  | "ROOM_NOT_FOUND"
  | "BLOCK_NOT_FOUND"
  | "FORBIDDEN"
  | "SLOT_CONFLICT"
  | "ROOM_CONFLICT";

type FieldIssue = {
  field: string;
  code: string;
  message: string;
};

export const roomErrorStatus: Record<RoomErrorCode, number> = {
  INVALID_INPUT: 400,
  ROOM_NOT_FOUND: 404,
  BLOCK_NOT_FOUND: 404,
  FORBIDDEN: 403,
  SLOT_CONFLICT: 409,
  ROOM_CONFLICT: 409,
};

export class RoomError extends Error {
  readonly code: RoomErrorCode;
  readonly fieldErrors: FieldIssue[];

  constructor(
    code: RoomErrorCode,
    message: string,
    fieldErrors: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "RoomError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type RoomView = {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  roomType: string;
  photoUrl: string | null;
  openTime: string;
  closeTime: string;
  requiresApproval: boolean;
  maxDurationMinutes: number;
  cancellationDeadlineMinutes: number;
  attachmentRequired: boolean;
  active: boolean;
};

export type ListRoomsInput = {
  capacity?: number;
  roomType?: string;
  managerId?: string;
};

export type SearchRoomsInput = {
  start: Date;
  end: Date;
  capacity?: number;
  roomType?: string;
};

export type UpdateRoomInput = {
  name?: string;
  building?: string;
  floor?: string;
  capacity?: number;
  facilities?: string[];
  roomType?: string;
  openTime?: string;
  closeTime?: string;
  requiresApproval?: boolean;
  maxDurationMinutes?: number;
  cancellationDeadlineMinutes?: number;
  attachmentRequired?: boolean;
  active?: boolean;
};

export type CreateBlockInput = {
  roomId: string;
  start: Date;
  end: Date;
  reason: string;
};

export type RoomActor = {
  id: string;
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN";
};

type RoomOptions = {
  db?: PrismaClient;
};

const invalid = (fieldErrors: FieldIssue[], message = "Input ruangan tidak valid.") =>
  new RoomError("INVALID_INPUT", message, fieldErrors);

export const parseFacilities = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export const toRoomView = (room: Room): RoomView => ({
  id: room.id,
  name: room.name,
  building: room.building,
  floor: room.floor,
  capacity: room.capacity,
  facilities: parseFacilities(room.facilities),
  roomType: room.roomType,
  photoUrl: room.photoUrl,
  openTime: room.openTime,
  closeTime: room.closeTime,
  requiresApproval: room.requiresApproval,
  maxDurationMinutes: room.maxDurationMinutes,
  cancellationDeadlineMinutes: room.cancellationDeadlineMinutes,
  attachmentRequired: room.attachmentRequired,
  active: room.active,
});

const normalizeRoomType = (value: string) => value.trim().toLowerCase();

export async function canManageRoom(
  actor: RoomActor,
  roomId: string,
  options: RoomOptions = {},
): Promise<boolean> {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role !== "PENGELOLA") {
    return false;
  }

  const db = options.db ?? defaultDb;
  const assignment = await db.roomManager.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId: actor.id,
      },
    },
  });

  return assignment !== null;
}

export async function assertCanManageRoom(
  actor: RoomActor,
  roomId: string,
  options: RoomOptions = {},
): Promise<void> {
  if (!(await canManageRoom(actor, roomId, options))) {
    throw new RoomError(
      "FORBIDDEN",
      "Anda hanya dapat mengelola ruangan yang ditugaskan kepada Anda.",
    );
  }
}

export async function listRooms(
  input: ListRoomsInput = {},
  options: RoomOptions = {},
): Promise<RoomView[]> {
  const db = options.db ?? defaultDb;
  const capacity = input.capacity;
  const roomType = input.roomType?.trim();

  const rooms = await db.room.findMany({
    where: {
      active: true,
      ...(capacity !== undefined ? { capacity: { gte: capacity } } : {}),
      ...(roomType ? { roomType: normalizeRoomType(roomType) } : {}),
      ...(input.managerId
        ? { managers: { some: { userId: input.managerId } } }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return rooms.map(toRoomView);
}

const isWithinRoomHours = (room: Room, start: Date, end: Date): boolean => {
  const openMinutes = parseTimeOfDay(room.openTime);
  const closeMinutes = parseTimeOfDay(room.closeTime);

  if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
    return false;
  }

  const startOfDay = witaMillisecondsOfDay(start);
  const endOfDay = witaMillisecondsOfDay(end);

  return (
    startOfDay >= openMinutes * MS_PER_MINUTE &&
    endOfDay <= closeMinutes * MS_PER_MINUTE
  );
};

export async function searchAvailableRooms(
  input: SearchRoomsInput,
  options: RoomOptions = {},
): Promise<RoomView[]> {
  const fieldErrors: FieldIssue[] = [];

  if (!(input.start instanceof Date) || Number.isNaN(input.start.getTime())) {
    fieldErrors.push({
      field: "start",
      code: "INVALID_DATE",
      message: "Waktu mulai tidak valid.",
    });
  }

  if (!(input.end instanceof Date) || Number.isNaN(input.end.getTime())) {
    fieldErrors.push({
      field: "end",
      code: "INVALID_DATE",
      message: "Waktu selesai tidak valid.",
    });
  }

  if (fieldErrors.length > 0) {
    throw invalid(fieldErrors);
  }

  if (input.start.getTime() >= input.end.getTime()) {
    throw invalid([
      {
        field: "end",
        code: "START_NOT_BEFORE_END",
        message: "Waktu selesai harus setelah waktu mulai.",
      },
    ]);
  }

  if (!isSameWitaDay(input.start, input.end)) {
    throw invalid([
      {
        field: "end",
        code: "OUTSIDE_SINGLE_DAY",
        message: "Rentang pencarian harus dalam satu hari WITA.",
      },
    ]);
  }

  if (
    input.capacity !== undefined &&
    (!Number.isInteger(input.capacity) || input.capacity < 1)
  ) {
    throw invalid([
      {
        field: "capacity",
        code: "INVALID",
        message: "Kapasitas minimum harus bilangan bulat minimal 1.",
      },
    ]);
  }

  const db = options.db ?? defaultDb;
  const roomType = input.roomType?.trim();

  const candidates = await db.room.findMany({
    where: {
      active: true,
      ...(input.capacity !== undefined
        ? { capacity: { gte: input.capacity } }
        : {}),
      ...(roomType ? { roomType: normalizeRoomType(roomType) } : {}),
    },
    orderBy: { name: "asc" },
  });

  const inHours = candidates.filter((room) =>
    isWithinRoomHours(room, input.start, input.end),
  );

  if (inHours.length === 0) {
    return [];
  }

  const roomIds = inHours.map((room) => room.id);

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: [...ACTIVE_STATUSES] },
        start: { lt: input.end },
        end: { gt: input.start },
      },
      select: { roomId: true },
    }),
    db.slotBlock.findMany({
      where: {
        roomId: { in: roomIds },
        start: { lt: input.end },
        end: { gt: input.start },
      },
      select: { roomId: true },
    }),
  ]);

  const busy = new Set([
    ...reservations.map((item) => item.roomId),
    ...blocks.map((item) => item.roomId),
  ]);

  return inHours.filter((room) => !busy.has(room.id)).map(toRoomView);
}

export async function updateRoom(
  roomId: string,
  input: UpdateRoomInput,
  actor: RoomActor,
  options: RoomOptions = {},
): Promise<RoomView> {
  const db = options.db ?? defaultDb;
  const room = await db.room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new RoomError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
  }

  await assertCanManageRoom(actor, roomId, { db });

  const fieldErrors: FieldIssue[] = [];
  const data: Prisma.RoomUpdateInput = {};

  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) {
      fieldErrors.push({
        field: "name",
        code: "REQUIRED",
        message: "Nama ruangan wajib diisi.",
      });
    } else {
      data.name = name;
    }
  }

  if (input.building !== undefined) {
    const building =
      typeof input.building === "string" ? input.building.trim() : "";
    if (!building) {
      fieldErrors.push({
        field: "building",
        code: "REQUIRED",
        message: "Gedung wajib diisi.",
      });
    } else {
      data.building = building;
    }
  }

  if (input.floor !== undefined) {
    const floor = typeof input.floor === "string" ? input.floor.trim() : "";
    if (!floor) {
      fieldErrors.push({
        field: "floor",
        code: "REQUIRED",
        message: "Lantai wajib diisi.",
      });
    } else {
      data.floor = floor;
    }
  }

  if (input.capacity !== undefined) {
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      fieldErrors.push({
        field: "capacity",
        code: "INVALID",
        message: "Kapasitas harus bilangan bulat minimal 1.",
      });
    } else {
      data.capacity = input.capacity;
    }
  }

  if (input.facilities !== undefined) {
    if (
      !Array.isArray(input.facilities) ||
      input.facilities.some((item) => typeof item !== "string")
    ) {
      fieldErrors.push({
        field: "facilities",
        code: "INVALID",
        message: "Fasilitas harus berupa daftar teks.",
      });
    } else {
      data.facilities = JSON.stringify(
        input.facilities.map((item) => item.trim()).filter(Boolean),
      );
    }
  }

  if (input.roomType !== undefined) {
    const roomType =
      typeof input.roomType === "string"
        ? normalizeRoomType(input.roomType)
        : "";
    if (!roomType) {
      fieldErrors.push({
        field: "roomType",
        code: "REQUIRED",
        message: "Jenis ruangan wajib diisi.",
      });
    } else {
      data.roomType = roomType;
    }
  }

  const nextOpen =
    typeof input.openTime === "string" ? input.openTime : room.openTime;
  const nextClose =
    typeof input.closeTime === "string" ? input.closeTime : room.closeTime;

  if (input.openTime !== undefined && typeof input.openTime !== "string") {
    fieldErrors.push({
      field: "openTime",
      code: "INVALID",
      message: "Jam buka harus teks HH:mm.",
    });
  }

  if (input.closeTime !== undefined && typeof input.closeTime !== "string") {
    fieldErrors.push({
      field: "closeTime",
      code: "INVALID",
      message: "Jam tutup harus teks HH:mm.",
    });
  }

  if (
    (input.openTime !== undefined || input.closeTime !== undefined) &&
    !fieldErrors.some((error) => error.field === "openTime" || error.field === "closeTime")
  ) {
    const openMinutes = parseTimeOfDay(nextOpen);
    const closeMinutes = parseTimeOfDay(nextClose);

    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
      fieldErrors.push({
        field: input.openTime !== undefined ? "openTime" : "closeTime",
        code: "INVALID",
        message: "Jam operasional harus valid dan buka sebelum tutup.",
      });
    } else {
      data.openTime = nextOpen;
      data.closeTime = nextClose;
    }
  }

  if (input.requiresApproval !== undefined) {
    if (typeof input.requiresApproval !== "boolean") {
      fieldErrors.push({
        field: "requiresApproval",
        code: "INVALID",
        message: "Butuh persetujuan harus boolean.",
      });
    } else {
      data.requiresApproval = input.requiresApproval;
    }
  }

  if (input.maxDurationMinutes !== undefined) {
    if (
      !Number.isInteger(input.maxDurationMinutes) ||
      input.maxDurationMinutes < 1
    ) {
      fieldErrors.push({
        field: "maxDurationMinutes",
        code: "INVALID",
        message: "Durasi maksimum harus bilangan bulat minimal 1.",
      });
    } else {
      data.maxDurationMinutes = input.maxDurationMinutes;
    }
  }

  if (input.cancellationDeadlineMinutes !== undefined) {
    if (
      !Number.isInteger(input.cancellationDeadlineMinutes) ||
      input.cancellationDeadlineMinutes < 0
    ) {
      fieldErrors.push({
        field: "cancellationDeadlineMinutes",
        code: "INVALID",
        message: "Batas pembatalan harus bilangan bulat minimal 0.",
      });
    } else {
      data.cancellationDeadlineMinutes = input.cancellationDeadlineMinutes;
    }
  }

  if (input.attachmentRequired !== undefined) {
    if (typeof input.attachmentRequired !== "boolean") {
      fieldErrors.push({
        field: "attachmentRequired",
        code: "INVALID",
        message: "Wajib lampiran harus boolean.",
      });
    } else {
      data.attachmentRequired = input.attachmentRequired;
    }
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      fieldErrors.push({
        field: "active",
        code: "INVALID",
        message: "Status aktif harus boolean.",
      });
    } else {
      data.active = input.active;
    }
  }

  if (fieldErrors.length > 0) {
    throw invalid(fieldErrors);
  }

  if (Object.keys(data).length === 0) {
    throw invalid([], "Tidak ada perubahan yang dikirim.");
  }

  try {
    const updated = await db.room.update({
      where: { id: roomId },
      data,
    });
    return toRoomView(updated);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new RoomError(
        "ROOM_CONFLICT",
        "Ruangan dengan nama, gedung, dan lantai tersebut sudah ada.",
      );
    }
    throw error;
  }
}

export async function createBlock(
  input: CreateBlockInput,
  actor: RoomActor,
  options: RoomOptions = {},
) {
  const db = options.db ?? defaultDb;
  const fieldErrors: FieldIssue[] = [];

  if (!(input.start instanceof Date) || Number.isNaN(input.start.getTime())) {
    fieldErrors.push({
      field: "start",
      code: "INVALID_DATE",
      message: "Waktu mulai tidak valid.",
    });
  }

  if (!(input.end instanceof Date) || Number.isNaN(input.end.getTime())) {
    fieldErrors.push({
      field: "end",
      code: "INVALID_DATE",
      message: "Waktu selesai tidak valid.",
    });
  }

  const reason =
    typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) {
    fieldErrors.push({
      field: "reason",
      code: "REQUIRED",
      message: "Alasan blokir wajib diisi.",
    });
  }

  if (fieldErrors.length > 0) {
    throw invalid(fieldErrors);
  }

  if (input.start.getTime() >= input.end.getTime()) {
    throw invalid([
      {
        field: "end",
        code: "START_NOT_BEFORE_END",
        message: "Waktu selesai harus setelah waktu mulai.",
      },
    ]);
  }

  const room = await db.room.findUnique({ where: { id: input.roomId } });
  if (!room) {
    throw new RoomError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
  }

  await assertCanManageRoom(actor, room.id, { db });

  const conflictingReservation = await db.reservation.findFirst({
    where: {
      roomId: room.id,
      status: { in: [...ACTIVE_STATUSES] },
      start: { lt: input.end },
      end: { gt: input.start },
    },
    select: { id: true },
  });

  if (conflictingReservation) {
    throw new RoomError(
      "SLOT_CONFLICT",
      "Blokir beririsan dengan reservasi aktif. Batalkan reservasi lebih dulu.",
    );
  }

  return db.slotBlock.create({
    data: {
      roomId: room.id,
      start: input.start,
      end: input.end,
      reason,
      createdById: actor.id,
    },
  });
}

export async function listBlocks(
  roomId: string,
  actor: RoomActor,
  options: RoomOptions = {},
) {
  const db = options.db ?? defaultDb;
  const room = await db.room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new RoomError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
  }

  await assertCanManageRoom(actor, roomId, { db });

  return db.slotBlock.findMany({
    where: { roomId },
    orderBy: { start: "asc" },
  });
}

export async function deleteBlock(
  roomId: string,
  blockId: string,
  actor: RoomActor,
  options: RoomOptions = {},
): Promise<void> {
  const db = options.db ?? defaultDb;
  const block = await db.slotBlock.findUnique({ where: { id: blockId } });

  if (!block || block.roomId !== roomId) {
    throw new RoomError("BLOCK_NOT_FOUND", "Blokir tidak ditemukan.");
  }

  await assertCanManageRoom(actor, block.roomId, { db });

  await db.slotBlock.delete({ where: { id: blockId } });
}
