import type { PrismaClient } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";

export const COMPLETION_REASON = "Selesai otomatis";

type CompletionOptions = {
  db?: PrismaClient;
  now?: Date;
};

export async function completeFinishedReservations(
  options: CompletionOptions = {},
): Promise<number> {
  const db = options.db ?? defaultDb;
  const now = options.now ?? new Date();

  const hasCandidate = await db.reservation.findFirst({
    where: {
      status: "TERKONFIRMASI",
      end: { lte: now },
    },
    select: { id: true },
  });

  if (!hasCandidate) {
    return 0;
  }

  return db.$transaction(async (tx) => {
    const candidates = await tx.reservation.findMany({
      where: {
        status: "TERKONFIRMASI",
        end: { lte: now },
      },
      select: { id: true },
    });

    let completed = 0;

    for (const candidate of candidates) {
      const updated = await tx.reservation.updateMany({
        where: {
          id: candidate.id,
          status: "TERKONFIRMASI",
        },
        data: { status: "SELESAI" },
      });

      if (updated.count !== 1) {
        continue;
      }

      await tx.statusHistory.create({
        data: {
          reservationId: candidate.id,
          oldStatus: "TERKONFIRMASI",
          newStatus: "SELESAI",
          actorId: null,
          reason: COMPLETION_REASON,
          createdAt: now,
        },
      });

      completed += 1;
    }

    return completed;
  });
}
