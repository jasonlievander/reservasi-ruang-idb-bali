import { approvalCardPath, generateApprovalCard } from "../src/lib/approval-card";
import { prisma } from "../src/lib/prisma";

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["TERKONFIRMASI", "SELESAI"] },
    },
    orderBy: { start: "asc" },
    include: {
      room: true,
      user: { select: { name: true } },
      history: {
        where: { newStatus: "TERKONFIRMASI" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { name: true, role: true } } },
      },
    },
  });

  let generated = 0;
  const failed: string[] = [];

  for (const reservation of reservations) {
    const approver = reservation.history.find(
      (entry) =>
        entry.actor?.role === "PENGELOLA" || entry.actor?.role === "ADMIN",
    );

    const url = await generateApprovalCard({
      reservationId: reservation.id,
      roomName: reservation.room.name,
      building: reservation.room.building,
      floor: reservation.room.floor,
      start: reservation.start,
      end: reservation.end,
      activityName: reservation.activityName,
      participantCount: reservation.participantCount,
      borrowerName: reservation.user.name,
      approverName: approver?.actor?.name ?? null,
    });

    if (url) {
      generated += 1;
      console.log(
        `OK     ${reservation.id} | ${reservation.room.name} | ${reservation.activityName}`,
      );
    } else {
      failed.push(reservation.id);
      console.error(
        `GAGAL  ${reservation.id} | ${reservation.room.name} | ${reservation.activityName}`,
      );
    }
  }

  console.log(
    `Backfill kartu selesai: ${generated}/${reservations.length} berhasil, ${failed.length} gagal.`,
  );

  if (failed.length > 0) {
    console.error(
      `Kartu yang gagal dibuat: ${failed
        .map((id) => approvalCardPath(id))
        .join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
