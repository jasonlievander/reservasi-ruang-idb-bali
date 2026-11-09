import type { PrismaClient } from "@prisma/client";
import {
  notifyBorrowerStatus,
  tryNotify,
  type NotificationTransport,
} from "@/lib/notifications";
import { prisma as defaultDb } from "@/lib/prisma";

const CANCELLABLE_STATUSES = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] as const;

export type CancellationErrorCode =
  | "INVALID_INPUT"
  | "RESERVATION_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "CANCELLATION_DEADLINE_PASSED";

export const cancellationErrorStatus: Record<CancellationErrorCode, number> = {
  INVALID_INPUT: 400,
  RESERVATION_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  CANCELLATION_DEADLINE_PASSED: 409,
};

type FieldIssue = {
  field: string;
  code: string;
  message: string;
};

export class CancellationError extends Error {
  readonly code: CancellationErrorCode;
  readonly fieldErrors: FieldIssue[];

  constructor(
    code: CancellationErrorCode,
    message: string,
    fieldErrors: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "CancellationError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type CancellationActor = {
  id: string;
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN";
};

export type CancelReservationInput = {
  reason?: string | null;
};

type CancellationOptions = {
  db?: PrismaClient;
  now?: Date;
  notificationTransport?: NotificationTransport;
};

export async function cancelReservation(
  reservationId: string,
  actor: CancellationActor,
  input: CancelReservationInput = {},
  options: CancellationOptions = {},
) {
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });

  if (!reservation) {
    throw new CancellationError(
      "RESERVATION_NOT_FOUND",
      "Reservasi tidak ditemukan.",
    );
  }

  const isOwner = reservation.userId === actor.id;

  let isRoomManager = false;
  if (!isOwner && (actor.role === "PENGELOLA" || actor.role === "ADMIN")) {
    if (actor.role === "ADMIN") {
      isRoomManager = true;
    } else {
      const assignment = await db.roomManager.findUnique({
        where: {
          roomId_userId: {
            roomId: reservation.roomId,
            userId: actor.id,
          },
        },
      });
      isRoomManager = assignment !== null;
    }
  }

  if (!isOwner && !isRoomManager) {
    throw new CancellationError(
      "FORBIDDEN",
      "Anda tidak berhak membatalkan reservasi ini.",
    );
  }

  if (
    !CANCELLABLE_STATUSES.includes(
      reservation.status as (typeof CANCELLABLE_STATUSES)[number],
    )
  ) {
    throw new CancellationError(
      "INVALID_TRANSITION",
      "Reservasi dengan status ini tidak dapat dibatalkan.",
    );
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (!isOwner && !reason) {
    throw new CancellationError(
      "INVALID_INPUT",
      "Alasan pembatalan wajib diisi.",
      [
        {
          field: "reason",
          code: "REQUIRED",
          message: "Alasan pembatalan wajib diisi.",
        },
      ],
    );
  }

  if (isOwner) {
    const deadline = new Date(
      reservation.start.getTime() -
        reservation.room.cancellationDeadlineMinutes * 60_000,
    );

    if (now.getTime() >= deadline.getTime()) {
      throw new CancellationError(
        "CANCELLATION_DEADLINE_PASSED",
        `Pembatalan hanya dapat dilakukan sebelum ${reservation.room.cancellationDeadlineMinutes} menit sebelum waktu mulai.`,
      );
    }
  }

  const recordedReason = reason || "Dibatalkan peminjam";

  const cancelled = await db.$transaction(
    async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: { in: [...CANCELLABLE_STATUSES] },
        },
        data: { status: "DIBATALKAN" },
      });

      if (updated.count !== 1) {
        throw new CancellationError(
          "INVALID_TRANSITION",
          "Status reservasi sudah berubah.",
        );
      }

      await tx.statusHistory.create({
        data: {
          reservationId: reservation.id,
          oldStatus: reservation.status,
          newStatus: "DIBATALKAN",
          actorId: actor.id,
          reason: recordedReason,
          createdAt: now,
        },
      });

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
    },
  );

  if (!isOwner) {
    await tryNotify(() =>
      notifyBorrowerStatus(cancelled, "DIBATALKAN_PENGELOLA", {
        db,
        transport: options.notificationTransport,
      }),
    );
  }

  return cancelled;
}
