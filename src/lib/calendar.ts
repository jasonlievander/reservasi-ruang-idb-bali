import type { PrismaClient, ReservationStatus } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";

const ACTIVE_STATUSES = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] as const;
const MAX_DAYS = 14;

export type CalendarErrorCode = "INVALID_INPUT";

export const calendarErrorStatus: Record<CalendarErrorCode, number> = {
  INVALID_INPUT: 400,
};

export class CalendarError extends Error {
  readonly code: CalendarErrorCode;
  readonly fieldErrors: Array<{
    field: string;
    code: string;
    message: string;
  }>;

  constructor(
    code: CalendarErrorCode,
    message: string,
    fieldErrors: Array<{ field: string; code: string; message: string }> = [],
  ) {
    super(message);
    this.name = "CalendarError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type CalendarSlot = {
  id: string;
  kind: "RESERVASI" | "BLOKIR";
  start: string;
  end: string;
  status: ReservationStatus | null;
};

export type CalendarRoom = {
  id: string;
  name: string;
  building: string;
  floor: string;
  roomType: string;
  capacity: number;
  openTime: string;
  closeTime: string;
  slots: CalendarSlot[];
};

export type CalendarInput = {
  from: Date;
  to: Date;
};

type CalendarOptions = {
  db?: PrismaClient;
};

const invalid = (field: string, message: string) =>
  new CalendarError("INVALID_INPUT", message, [
    { field, code: "INVALID", message },
  ]);

export async function getRoomCalendar(
  input: CalendarInput,
  options: CalendarOptions = {},
): Promise<{ from: string; to: string; rooms: CalendarRoom[] }> {
  if (
    !(input.from instanceof Date) ||
    Number.isNaN(input.from.getTime()) ||
    !(input.to instanceof Date) ||
    Number.isNaN(input.to.getTime())
  ) {
    throw invalid("date", "Rentang tanggal tidak valid.");
  }

  if (input.from.getTime() >= input.to.getTime()) {
    throw invalid("date", "Tanggal akhir harus setelah tanggal awal.");
  }

  const spanDays = (input.to.getTime() - input.from.getTime()) / 86_400_000;
  if (spanDays > MAX_DAYS) {
    throw invalid("date", `Rentang maksimal ${MAX_DAYS} hari.`);
  }

  const db = options.db ?? defaultDb;

  const rooms = await db.room.findMany({
    where: { active: true },
    orderBy: [{ building: "asc" }, { floor: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      building: true,
      floor: true,
      roomType: true,
      capacity: true,
      openTime: true,
      closeTime: true,
    },
  });

  if (rooms.length === 0) {
    return {
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      rooms: [],
    };
  }

  const roomIds = rooms.map((room) => room.id);

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: [...ACTIVE_STATUSES] },
        start: { lt: input.to },
        end: { gt: input.from },
      },
      orderBy: { start: "asc" },
      select: {
        id: true,
        roomId: true,
        start: true,
        end: true,
        status: true,
      },
    }),
    db.slotBlock.findMany({
      where: {
        roomId: { in: roomIds },
        start: { lt: input.to },
        end: { gt: input.from },
      },
      orderBy: { start: "asc" },
      select: {
        id: true,
        roomId: true,
        start: true,
        end: true,
      },
    }),
  ]);

  const slotsByRoom = new Map<string, CalendarSlot[]>();

  for (const room of rooms) {
    slotsByRoom.set(room.id, []);
  }

  for (const reservation of reservations) {
    slotsByRoom.get(reservation.roomId)?.push({
      id: reservation.id,
      kind: "RESERVASI",
      start: reservation.start.toISOString(),
      end: reservation.end.toISOString(),
      status: reservation.status,
    });
  }

  for (const block of blocks) {
    slotsByRoom.get(block.roomId)?.push({
      id: block.id,
      kind: "BLOKIR",
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      status: null,
    });
  }

  return {
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    rooms: rooms.map((room) => ({
      ...room,
      slots: slotsByRoom.get(room.id) ?? [],
    })),
  };
}
