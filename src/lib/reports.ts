import type { PrismaClient, ReservationStatus } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";
import { formatWitaDate, formatWitaTime } from "@/lib/wita";

export const STATUSES: ReservationStatus[] = [
  "MENUNGGU_PERSETUJUAN",
  "TERKONFIRMASI",
  "DITOLAK",
  "DIBATALKAN",
  "KEDALUWARSA",
  "SELESAI",
  "GAGAL",
];

export type ReportErrorCode =
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "INVALID_INPUT";

export const reportErrorStatus: Record<ReportErrorCode, number> = {
  FORBIDDEN: 403,
  ROOM_NOT_FOUND: 404,
  INVALID_INPUT: 400,
};

export class ReportError extends Error {
  readonly code: ReportErrorCode;
  readonly fieldErrors: Array<{
    field: string;
    code: string;
    message: string;
  }>;

  constructor(
    code: ReportErrorCode,
    message: string,
    fieldErrors: Array<{ field: string; code: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ReportError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type ReportActor = {
  id: string;
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN";
};

export type UsageReportInput = {
  roomId: string;
  from: Date;
  to: Date;
};

export type UsageDetail = {
  id: string;
  status: ReservationStatus;
  statusLabel: string;
  date: string;
  start: string;
  end: string;
  durationHours: number;
  activityName: string;
  participantCount: number;
  type: "ORGANISASI" | "PRIBADI";
  organizationName: string | null;
  borrowerName: string;
  approvalCardUrl?: string | null;
};

export type UsageReport = {
  room: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  from: string;
  to: string;
  totalReservations: number;
  usedHours: number;
  cancellations: number;
  byStatus: Record<ReservationStatus, number>;
  details: UsageDetail[];
};

type ReportOptions = {
  db?: PrismaClient;
  includeDetails?: boolean;
};

export const statusLabels: Record<ReservationStatus, string> = {
  MENUNGGU_PERSETUJUAN: "Menunggu persetujuan",
  TERKONFIRMASI: "Terkonfirmasi",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
  KEDALUWARSA: "Kedaluwarsa",
  SELESAI: "Selesai",
  GAGAL: "Gagal",
};

const invalid = (field: string, message: string) =>
  new ReportError("INVALID_INPUT", message, [
    { field, code: "INVALID", message },
  ]);

export async function getUsageReport(
  input: UsageReportInput,
  actor: ReportActor,
  options: ReportOptions = {},
): Promise<UsageReport> {
  if (actor.role !== "PENGELOLA" && actor.role !== "ADMIN") {
    throw new ReportError(
      "FORBIDDEN",
      "Hanya pengelola atau admin yang dapat melihat rekap.",
    );
  }

  if (!(input.from instanceof Date) || Number.isNaN(input.from.getTime())) {
    throw invalid("from", "Tanggal awal tidak valid.");
  }

  if (!(input.to instanceof Date) || Number.isNaN(input.to.getTime())) {
    throw invalid("to", "Tanggal akhir tidak valid.");
  }

  if (input.from.getTime() >= input.to.getTime()) {
    throw invalid("to", "Tanggal akhir harus setelah tanggal awal.");
  }

  const db = options.db ?? defaultDb;
  const room = await db.room.findUnique({
    where: { id: input.roomId },
    select: { id: true, name: true, building: true, floor: true },
  });

  if (!room) {
    throw new ReportError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
  }

  if (actor.role === "PENGELOLA") {
    const assignment = await db.roomManager.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: actor.id,
        },
      },
    });

    if (!assignment) {
      throw new ReportError(
        "FORBIDDEN",
        "Anda hanya dapat melihat rekap ruangan yang ditugaskan kepada Anda.",
      );
    }
  }

  const reservations = await db.reservation.findMany({
    where: {
      roomId: room.id,
      start: { gte: input.from, lt: input.to },
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      start: true,
      end: true,
      status: true,
      activityName: true,
      participantCount: true,
      type: true,
      organization: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  const byStatus = Object.fromEntries(
    STATUSES.map((status) => [status, 0]),
  ) as Record<ReservationStatus, number>;

  let usedMinutes = 0;

  for (const reservation of reservations) {
    byStatus[reservation.status] += 1;

    if (
      reservation.status === "TERKONFIRMASI" ||
      reservation.status === "SELESAI"
    ) {
      usedMinutes +=
        (reservation.end.getTime() - reservation.start.getTime()) / 60_000;
    }
  }

  const details: UsageDetail[] = reservations.map((reservation) => {
    const durationMinutes =
      (reservation.end.getTime() - reservation.start.getTime()) / 60_000;

    return {
      id: reservation.id,
      status: reservation.status,
      statusLabel: statusLabels[reservation.status],
      date: formatWitaDate(reservation.start),
      start: formatWitaTime(reservation.start),
      end: formatWitaTime(reservation.end),
      durationHours: Math.round((durationMinutes / 60) * 100) / 100,
      activityName: reservation.activityName,
      participantCount: reservation.participantCount,
      type: reservation.type,
      organizationName: reservation.organization?.name ?? null,
      borrowerName: reservation.user.name,
    };
  });

  return {
    room,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    totalReservations: reservations.length,
    usedHours: Math.round((usedMinutes / 60) * 100) / 100,
    cancellations: byStatus.DIBATALKAN,
    byStatus,
    details: options.includeDetails === false ? [] : details,
  };
}

