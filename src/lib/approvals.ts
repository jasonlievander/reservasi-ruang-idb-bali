import { Prisma, type PrismaClient } from "@prisma/client";
import { generateApprovalCard } from "@/lib/approval-card";
import {
  notifyBorrowerStatus,
  tryNotify,
  type NotificationTransport,
} from "@/lib/notifications";
import { prisma as defaultDb } from "@/lib/prisma";

const ACTIVE_STATUSES = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] as const;
const HISTORY_STATUSES = ["TERKONFIRMASI", "SELESAI"] as const;
export const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ApprovalErrorCode =
  | "INVALID_INPUT"
  | "RESERVATION_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "SLOT_CONFLICT"
  | "EXPIRED";

export const approvalErrorStatus: Record<ApprovalErrorCode, number> = {
  INVALID_INPUT: 400,
  RESERVATION_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  SLOT_CONFLICT: 409,
  EXPIRED: 409,
};

type FieldIssue = {
  field: string;
  code: string;
  message: string;
};

export class ApprovalError extends Error {
  readonly code: ApprovalErrorCode;
  readonly fieldErrors: FieldIssue[];

  constructor(
    code: ApprovalErrorCode,
    message: string,
    fieldErrors: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type ApprovalActor = {
  id: string;
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN";
};

type ApprovalOptions = {
  db?: PrismaClient;
  now?: Date;
  notificationTransport?: NotificationTransport;
};

const assertReviewerRole = (actor: ApprovalActor) => {
  if (actor.role !== "PENGELOLA" && actor.role !== "ADMIN") {
    throw new ApprovalError(
      "FORBIDDEN",
      "Hanya pengelola atau admin yang dapat meninjau pengajuan.",
    );
  }
};

const assertCanReviewRoom = async (
  actor: ApprovalActor,
  roomId: string,
  db: PrismaClient | Prisma.TransactionClient,
) => {
  assertReviewerRole(actor);

  if (actor.role === "ADMIN") {
    return;
  }

  const assignment = await db.roomManager.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId: actor.id,
      },
    },
  });

  if (!assignment) {
    throw new ApprovalError(
      "FORBIDDEN",
      "Anda hanya dapat meninjau ruangan yang ditugaskan kepada Anda.",
    );
  }
};

const assertPending = (status: string) => {
  if (status !== "MENUNGGU_PERSETUJUAN") {
    throw new ApprovalError(
      "INVALID_TRANSITION",
      "Hanya pengajuan yang menunggu persetujuan dapat diputuskan.",
    );
  }
};

const assertBeforeDeadline = (start: Date, now: Date) => {
  // Batas waktu persetujuan dihilangkan - pengelola/admin dapat menyetujui
  // meski pengajuan diajukan mendekati waktu kegiatan
};

export async function listPendingApprovals(
  actor: ApprovalActor,
  options: ApprovalOptions = {},
) {
  assertReviewerRole(actor);

  const db = options.db ?? defaultDb;
  const where = {
    status: "MENUNGGU_PERSETUJUAN" as const,
    ...(actor.role === "PENGELOLA"
      ? { room: { managers: { some: { userId: actor.id } } } }
      : {}),
  };

  return db.reservation.findMany({
    where,
    orderBy: { start: "asc" },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      room: {
        select: {
          id: true,
          name: true,
          building: true,
          floor: true,
        },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });
}

const APPROVAL_HISTORY_LIMIT = 12;

export async function listApprovalHistory(
  actor: ApprovalActor,
  options: ApprovalOptions = {},
) {
  assertReviewerRole(actor);

  const db = options.db ?? defaultDb;
  const where = {
    status: { in: [...HISTORY_STATUSES] },
    ...(actor.role === "PENGELOLA"
      ? { room: { managers: { some: { userId: actor.id } } } }
      : {}),
  };

  return db.reservation.findMany({
    where,
    orderBy: { start: "desc" },
    take: APPROVAL_HISTORY_LIMIT,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      room: {
        select: {
          id: true,
          name: true,
          building: true,
          floor: true,
        },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function approveReservation(
  reservationId: string,
  actor: ApprovalActor,
  reasonInput?: string | null,
  options: ApprovalOptions = {},
) {
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();
  const reason = reasonInput?.trim() || "Disetujui pengelola";

  const approved = await db.$transaction(
    async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: {
          user: true,
          room: true,
          organization: true,
        },
      });

      if (!reservation) {
        throw new ApprovalError(
          "RESERVATION_NOT_FOUND",
          "Reservasi tidak ditemukan.",
        );
      }

      await assertCanReviewRoom(actor, reservation.roomId, tx);
      assertPending(reservation.status);
      assertBeforeDeadline(reservation.start, now);

      const reviewer = await tx.user.findUnique({
        where: { id: actor.id },
        select: { name: true },
      });

      const conflictingReservation = await tx.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: reservation.roomId,
          status: { in: [...ACTIVE_STATUSES] },
          start: { lt: reservation.end },
          end: { gt: reservation.start },
        },
        select: { id: true },
      });

      if (conflictingReservation) {
        throw new ApprovalError(
          "SLOT_CONFLICT",
          "Slot sudah dipakai reservasi aktif lain. Pengajuan tidak dapat disetujui.",
        );
      }

      const conflictingBlock = await tx.slotBlock.findFirst({
        where: {
          roomId: reservation.roomId,
          start: { lt: reservation.end },
          end: { gt: reservation.start },
        },
        select: { id: true },
      });

      if (conflictingBlock) {
        throw new ApprovalError(
          "SLOT_CONFLICT",
          "Slot diblokir. Pengajuan tidak dapat disetujui.",
        );
      }

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: "MENUNGGU_PERSETUJUAN",
        },
        data: { status: "TERKONFIRMASI" },
      });

      if (updated.count !== 1) {
        throw new ApprovalError(
          "INVALID_TRANSITION",
          "Status pengajuan sudah berubah.",
        );
      }

      await tx.statusHistory.create({
        data: {
          reservationId: reservation.id,
          oldStatus: "MENUNGGU_PERSETUJUAN",
          newStatus: "TERKONFIRMASI",
          actorId: actor.id,
          reason,
        },
      });

      const reservationAfter = await tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: {
          user: true,
          room: true,
          organization: true,
        },
      });

      return {
        reservation: reservationAfter,
        reviewerName: reviewer?.name ?? null,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );

  await generateApprovalCard({
    reservationId: approved.reservation.id,
    roomName: approved.reservation.room.name,
    building: approved.reservation.room.building,
    floor: approved.reservation.room.floor,
    start: approved.reservation.start,
    end: approved.reservation.end,
    activityName: approved.reservation.activityName,
    participantCount: approved.reservation.participantCount,
    borrowerName: approved.reservation.user.name,
    approverName: approved.reviewerName,
  });

  await tryNotify(() => 
    notifyBorrowerStatus(approved.reservation, "DISETUJUI", {
      db,
      transport: options.notificationTransport,
    }),
  );

  return approved.reservation;
}

export async function rejectReservation(
  reservationId: string,
  actor: ApprovalActor,
  reasonInput: string,
  options: ApprovalOptions = {},
) {
  const reason = typeof reasonInput === "string" ? reasonInput.trim() : "";

  if (!reason) {
    throw new ApprovalError(
      "INVALID_INPUT",
      "Alasan penolakan wajib diisi.",
      [
        {
          field: "reason",
          code: "REQUIRED",
          message: "Alasan penolakan wajib diisi.",
        },
      ],
    );
  }

  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();

  const rejected = await db.$transaction(
    async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new ApprovalError(
          "RESERVATION_NOT_FOUND",
          "Reservasi tidak ditemukan.",
        );
      }

      await assertCanReviewRoom(actor, reservation.roomId, tx);
      assertPending(reservation.status);
      assertBeforeDeadline(reservation.start, now);

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: "MENUNGGU_PERSETUJUAN",
        },
        data: { status: "DITOLAK" },
      });

      if (updated.count !== 1) {
        throw new ApprovalError(
          "INVALID_TRANSITION",
          "Status pengajuan sudah berubah.",
        );
      }

      await tx.statusHistory.create({
        data: {
          reservationId: reservation.id,
          oldStatus: "MENUNGGU_PERSETUJUAN",
          newStatus: "DITOLAK",
          actorId: actor.id,
          reason,
        },
      });

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );

  await tryNotify(() =>
    notifyBorrowerStatus(rejected, "DITOLAK", {
      db,
      transport: options.notificationTransport,
    }),
  );

  return rejected;
}

export async function expireOverdueReservations(
  options: ApprovalOptions = {},
): Promise<number> {
  // Batas kedaluwarsa pengajuan dihilangkan
  return 0;
}
