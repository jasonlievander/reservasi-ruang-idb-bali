import type {
  NotificationType,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";

export type NotificationInput = {
  recipientId: string;
  reservationId?: string | null;
  type: NotificationType;
};

export type NotificationTransport = {
  send(input: NotificationInput): Promise<void>;
};

type NotificationOptions = {
  db?: PrismaClient;
  transport?: NotificationTransport;
};

export const mockNotificationTransport: NotificationTransport = {
  async send(input) {
    if (process.env.NODE_ENV !== "test") {
      console.info(
        `[notifikasi] jenis=${input.type} penerima=${input.recipientId} reservasi=${input.reservationId ?? "-"}`,
      );
    }
  },
};

export async function tryNotify<T>(
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

export async function queueNotification(
  input: NotificationInput,
  options: NotificationOptions = {},
) {
  const db = options.db ?? defaultDb;
  const transport = options.transport ?? mockNotificationTransport;

  const record = await db.notification.create({
    data: {
      recipientId: input.recipientId,
      reservationId: input.reservationId ?? null,
      type: input.type,
    },
  });

  try {
    await transport.send(input);
    return db.notification.update({
      where: { id: record.id },
      data: { deliveryStatus: "TERKIRIM" },
    });
  } catch {
    return db.notification.update({
      where: { id: record.id },
      data: { deliveryStatus: "GAGAL" },
    });
  }
}

type ReservationNotificationTarget = {
  id: string;
  userId: string;
  roomId: string;
  status: ReservationStatus;
};

export async function notifyNewSubmission(
  reservation: ReservationNotificationTarget,
  options: NotificationOptions = {},
) {
  const db = options.db ?? defaultDb;

  if (reservation.status === "TERKONFIRMASI") {
    await queueNotification(
      {
        recipientId: reservation.userId,
        reservationId: reservation.id,
        type: "DISETUJUI",
      },
      options,
    );
    return;
  }

  await queueNotification(
    {
      recipientId: reservation.userId,
      reservationId: reservation.id,
      type: "PENGAJUAN_DITERIMA",
    },
    options,
  );

  const managers = await db.roomManager.findMany({
    where: { roomId: reservation.roomId },
    select: { userId: true },
  });

  for (const manager of managers) {
    if (manager.userId === reservation.userId) {
      continue;
    }

    await queueNotification(
      {
        recipientId: manager.userId,
        reservationId: reservation.id,
        type: "PENGAJUAN_BARU",
      },
      options,
    );
  }
}

export async function notifyBorrowerStatus(
  reservation: ReservationNotificationTarget,
  type: Extract<
    NotificationType,
    "DISETUJUI" | "DITOLAK" | "DIBATALKAN_PENGELOLA" | "KEDALUWARSA"
  >,
  options: NotificationOptions = {},
) {
  await queueNotification(
    {
      recipientId: reservation.userId,
      reservationId: reservation.id,
      type,
    },
    options,
  );
}
