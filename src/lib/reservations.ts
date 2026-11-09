import { Prisma, type PrismaClient, type Reservation } from "@prisma/client";
import { generateApprovalCard } from "@/lib/approval-card";
import {
  notifyNewSubmission,
  tryNotify,
  type NotificationTransport,
} from "@/lib/notifications";
import { prisma as defaultDb } from "@/lib/prisma";
import {
  validateReservation,
  type ValidationError,
} from "@/lib/validation";

const ACTIVE_STATUSES = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] as const;
const MAX_WRITE_ATTEMPTS = 6;

export type ReservationErrorCode =
  | "INVALID_INPUT"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "ROOM_NOT_FOUND"
  | "ROOM_INACTIVE"
  | "ORGANIZATION_NOT_FOUND"
  | "ATTACHMENT_REQUIRED"
  | "SLOT_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  | "LIMIT_EXCEEDED"
  | "ADVANCE_WINDOW_EXCEEDED"
  | "WRITE_CONFLICT";

type FieldIssue = {
  field: string;
  code: string;
  message: string;
};

export class ReservationError extends Error {
  readonly code: ReservationErrorCode;
  readonly fieldErrors: FieldIssue[];

  constructor(
    code: ReservationErrorCode,
    message: string,
    fieldErrors: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ReservationError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type CreateReservationInput = {
  userId: string;
  roomId: string;
  organizationId?: string | null;
  start: Date;
  end: Date;
  type: "ORGANISASI" | "PRIBADI";
  activityName: string;
  participantCount: number;
  idempotencyKey: string;
  attachmentUrl?: string | null;
};

export type CreateReservationOptions = {
  db?: PrismaClient;
  now?: Date;
  notificationTransport?: NotificationTransport;
};

type NormalizedInput = {
  userId: string;
  roomId: string;
  organizationId: string | null;
  start: Date;
  end: Date;
  type: "ORGANISASI" | "PRIBADI";
  activityName: string;
  participantCount: number;
  idempotencyKey: string;
  attachmentUrl: string | null;
};

const invalid = (fieldErrors: FieldIssue[], message = "Input reservasi tidak valid.") =>
  new ReservationError("INVALID_INPUT", message, fieldErrors);

const normalizeInput = (input: CreateReservationInput): NormalizedInput => {
  const fieldErrors: FieldIssue[] = [];

  if (!input.userId) {
    fieldErrors.push({
      field: "userId",
      code: "REQUIRED",
      message: "Pengguna wajib diisi.",
    });
  }

  if (!input.roomId) {
    fieldErrors.push({
      field: "roomId",
      code: "REQUIRED",
      message: "Ruangan wajib diisi.",
    });
  }

  const activityName = input.activityName?.trim() ?? "";
  if (!activityName) {
    fieldErrors.push({
      field: "activityName",
      code: "REQUIRED",
      message: "Nama kegiatan wajib diisi.",
    });
  }

  const idempotencyKey = input.idempotencyKey?.trim() ?? "";
  if (!idempotencyKey) {
    fieldErrors.push({
      field: "idempotencyKey",
      code: "REQUIRED",
      message: "Idempotency key wajib diisi.",
    });
  }

  if (input.type !== "ORGANISASI" && input.type !== "PRIBADI") {
    fieldErrors.push({
      field: "type",
      code: "INVALID",
      message: "Jenis keperluan harus organisasi atau pribadi.",
    });
  }

  const organizationId =
    input.type === "ORGANISASI" ? input.organizationId?.trim() || null : null;

  if (input.type === "ORGANISASI" && !organizationId) {
    fieldErrors.push({
      field: "organizationId",
      code: "REQUIRED",
      message: "Organisasi wajib diisi untuk keperluan organisasi.",
    });
  }

  if (!Number.isInteger(input.participantCount)) {
    fieldErrors.push({
      field: "participantCount",
      code: "INVALID",
      message: "Jumlah peserta harus bilangan bulat.",
    });
  }

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

  return {
    userId: input.userId,
    roomId: input.roomId,
    organizationId,
    start: input.start,
    end: input.end,
    type: input.type,
    activityName,
    participantCount: input.participantCount,
    idempotencyKey,
    attachmentUrl: input.attachmentUrl?.trim() || null,
  };
};

const samePayload = (reservation: Reservation, input: NormalizedInput) =>
  reservation.roomId === input.roomId &&
  reservation.organizationId === input.organizationId &&
  reservation.start.getTime() === input.start.getTime() &&
  reservation.end.getTime() === input.end.getTime() &&
  reservation.type === input.type &&
  reservation.activityName === input.activityName &&
  reservation.participantCount === input.participantCount &&
  reservation.attachmentUrl === input.attachmentUrl;

const replayOrReject = (
  reservation: Reservation,
  input: NormalizedInput,
): Reservation => {
  if (!samePayload(reservation, input)) {
    throw new ReservationError(
      "IDEMPOTENCY_KEY_REUSED",
      "Idempotency key sudah dipakai untuk pengajuan dengan data berbeda.",
    );
  }

  return reservation;
};

const toFieldIssues = (errors: ValidationError[]): FieldIssue[] =>
  errors.map((error) => ({
    field: error.field,
    code: error.code,
    message: error.message,
  }));

const isRetryableWriteError = (error: unknown): boolean => {
  const code = (error as { code?: string }).code;

  if (
    code === "P2002" ||
    code === "P2024" ||
    code === "P2028" ||
    code === "P2034" ||
    code === "P1008"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : "";
  return /SQLITE_BUSY|database is locked|write conflict|deadlock/i.test(message);
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withWriteRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      if (!isRetryableWriteError(error)) {
        throw error;
      }

      if (attempt === MAX_WRITE_ATTEMPTS) {
        throw new ReservationError(
          "WRITE_CONFLICT",
          "Slot sedang diproses. Coba lagi.",
        );
      }

      await sleep(25 * attempt);
    }
  }

  throw new ReservationError("WRITE_CONFLICT", "Slot sedang diproses. Coba lagi.");
}

export async function createReservation(
  input: CreateReservationInput,
  options: CreateReservationOptions = {},
): Promise<Reservation> {
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();
  const normalized = normalizeInput(input);

  const existing = await db.reservation.findUnique({
    where: {
      userId_idempotencyKey: {
        userId: normalized.userId,
        idempotencyKey: normalized.idempotencyKey,
      },
    },
  });

  if (existing) {
    return replayOrReject(existing, normalized);
  }

  const [user, room, organization] = await Promise.all([
    db.user.findUnique({ where: { id: normalized.userId } }),
    db.room.findUnique({ where: { id: normalized.roomId } }),
    normalized.organizationId
      ? db.organization.findUnique({ where: { id: normalized.organizationId } })
      : Promise.resolve(null),
  ]);

  if (!user) {
    throw new ReservationError("USER_NOT_FOUND", "Pengguna tidak ditemukan.");
  }

  if (!user.active) {
    throw new ReservationError("USER_INACTIVE", "Akun pengguna tidak aktif.");
  }

  if (!room) {
    throw new ReservationError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
  }

  if (!room.active) {
    throw new ReservationError("ROOM_INACTIVE", "Ruangan sedang tidak aktif.");
  }

  if (normalized.organizationId && !organization) {
    throw new ReservationError(
      "ORGANIZATION_NOT_FOUND",
      "Organisasi tidak ditemukan.",
    );
  }

  if (room.attachmentRequired && !normalized.attachmentUrl) {
    throw new ReservationError(
      "ATTACHMENT_REQUIRED",
      "Ruangan ini mewajibkan lampiran surat atau izin.",
      [
        {
          field: "attachmentUrl",
          code: "REQUIRED",
          message: "Lampiran wajib diunggah untuk ruangan ini.",
        },
      ],
    );
  }

  const validation = validateReservation(
    {
      start: normalized.start,
      end: normalized.end,
      participantCount: normalized.participantCount,
    },
    room,
    now,
  );

  if (!validation.valid) {
    throw invalid(toFieldIssues(validation.errors));
  }

  const result = await withWriteRetry(() =>
    db.$transaction(
      async (tx) => {
        const replayed = await tx.reservation.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: normalized.userId,
              idempotencyKey: normalized.idempotencyKey,
            },
          },
        });

        if (replayed) {
          return {
            reservation: replayOrReject(replayed, normalized),
            created: false,
          };
        }

        const config = await tx.systemConfig.findUnique({
          where: { id: "default" },
        });
        const maxAdvanceDays = config?.maxAdvanceDays ?? 30;
        const maxActiveReservations = config?.maxActiveReservations ?? 3;
        const advanceLimit = new Date(
          now.getTime() + maxAdvanceDays * 86_400_000,
        );

        if (normalized.start.getTime() > advanceLimit.getTime()) {
          throw new ReservationError(
            "ADVANCE_WINDOW_EXCEEDED",
            `Reservasi hanya dapat diajukan maksimal ${maxAdvanceDays} hari ke depan.`,
          );
        }

        const activeCount = await tx.reservation.count({
          where: {
            userId: normalized.userId,
            status: { in: [...ACTIVE_STATUSES] },
            end: { gt: now },
          },
        });

        if (activeCount >= maxActiveReservations) {
          throw new ReservationError(
            "LIMIT_EXCEEDED",
            `Batas ${maxActiveReservations} reservasi aktif telah tercapai.`,
          );
        }

        const conflictingReservation = await tx.reservation.findFirst({
          where: {
            roomId: normalized.roomId,
            status: { in: [...ACTIVE_STATUSES] },
            start: { lt: normalized.end },
            end: { gt: normalized.start },
          },
          select: { id: true },
        });

        if (conflictingReservation) {
          throw new ReservationError(
            "SLOT_CONFLICT",
            "Slot sudah dipakai pengajuan lain. Pilih waktu lain.",
          );
        }

        const conflictingBlock = await tx.slotBlock.findFirst({
          where: {
            roomId: normalized.roomId,
            start: { lt: normalized.end },
            end: { gt: normalized.start },
          },
          select: { id: true },
        });

        if (conflictingBlock) {
          throw new ReservationError(
            "SLOT_CONFLICT",
            "Slot diblokir untuk keperluan lain. Pilih waktu lain.",
          );
        }

        const status = room.requiresApproval
          ? "MENUNGGU_PERSETUJUAN"
          : "TERKONFIRMASI";

        const reservation = await tx.reservation.create({
          data: {
            userId: normalized.userId,
            roomId: normalized.roomId,
            organizationId: normalized.organizationId,
            start: normalized.start,
            end: normalized.end,
            type: normalized.type,
            activityName: normalized.activityName,
            participantCount: normalized.participantCount,
            idempotencyKey: normalized.idempotencyKey,
            attachmentUrl: normalized.attachmentUrl,
            status,
          },
        });

        await tx.statusHistory.create({
          data: {
            reservationId: reservation.id,
            newStatus: status,
            actorId: normalized.userId,
          },
        });

        return { reservation, created: true };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      },
    ),
  );

  if (result.created && result.reservation.status === "TERKONFIRMASI") {
    await generateApprovalCard({
      reservationId: result.reservation.id,
      roomName: room.name,
      building: room.building,
      floor: room.floor,
      start: result.reservation.start,
      end: result.reservation.end,
      activityName: result.reservation.activityName,
      participantCount: result.reservation.participantCount,
      borrowerName: user.name,
      approverName: null,
    });
  }

  if (result.created) {
    await tryNotify(() =>
      notifyNewSubmission(result.reservation, {
        db,
        transport: options.notificationTransport,
      }),
    );
  }

  return result.reservation;
}
