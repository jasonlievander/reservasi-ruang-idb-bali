import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cleanDatabase = async () => {
  await prisma.notification.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.slotBlock.deleteMany();
  await prisma.roomManager.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginThrottle.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();
};

beforeAll(cleanDatabase);

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe("skema data dan relasi", () => {
  it("menyimpan pengguna, organisasi, ruangan, reservasi, riwayat, dan blokir", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Peminjam Sintetis",
        email: "peminjam@example.test",
        role: "PEMINJAM",
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "Pengelola Sintetis",
        email: "pengelola@example.test",
        role: "PENGELOLA",
      },
    });

    const organization = await prisma.organization.create({
      data: {
        name: "UKM Sintetis",
        advisor: "Pembina Sintetis",
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "PENGURUS",
      },
    });

    const room = await prisma.room.create({
      data: {
        name: "Ruang Sintetis",
        building: "Gedung Uji",
        floor: "2",
        capacity: 20,
        facilities: JSON.stringify(["proyektor", "AC"]),
        openTime: "08:00",
        closeTime: "17:00",
        requiresApproval: true,
        maxDurationMinutes: 180,
        cancellationDeadlineMinutes: 60,
      },
    });

    await prisma.roomManager.create({
      data: {
        roomId: room.id,
        userId: manager.id,
      },
    });

    const reservation = await prisma.reservation.create({
      data: {
        userId: user.id,
        roomId: room.id,
        organizationId: organization.id,
        start: new Date("2026-10-21T01:00:00.000Z"),
        end: new Date("2026-10-21T02:00:00.000Z"),
        type: "ORGANISASI",
        activityName: "Rapat Sintetis",
        participantCount: 15,
        idempotencyKey: "uji-relasi-1",
        status: "MENUNGGU_PERSETUJUAN",
        history: {
          create: {
            newStatus: "MENUNGGU_PERSETUJUAN",
            actorId: user.id,
          },
        },
      },
    });

    await prisma.slotBlock.create({
      data: {
        roomId: room.id,
        start: new Date("2026-10-22T01:00:00.000Z"),
        end: new Date("2026-10-22T02:00:00.000Z"),
        reason: "Perawatan sintetis",
        createdById: manager.id,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: manager.id,
        reservationId: reservation.id,
        type: "PENGAJUAN_BARU",
      },
    });

    await prisma.systemConfig.create({
      data: {
        id: "default",
        maxActiveReservations: 3,
        maxAdvanceDays: 30,
      },
    });

    const loaded = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: {
        user: true,
        room: { include: { managers: true } },
        organization: { include: { memberships: true } },
        history: true,
      },
    });

    expect(loaded.user.email).toBe("peminjam@example.test");
    expect(loaded.room.name).toBe("Ruang Sintetis");
    expect(loaded.room.managers[0]?.userId).toBe(manager.id);
    expect(loaded.organization?.memberships[0]?.role).toBe("PENGURUS");
    expect(loaded.history[0]?.newStatus).toBe("MENUNGGU_PERSETUJUAN");

    const config = await prisma.systemConfig.findUniqueOrThrow({
      where: { id: "default" },
    });
    expect(config.maxActiveReservations).toBe(3);
  });

  it("menolak email pengguna yang duplikat", async () => {
    const data = {
      name: "Pengguna Uji",
      email: "duplikat@example.test",
      role: "PEMINJAM" as const,
    };

    await prisma.user.create({ data });

    await expect(prisma.user.create({ data })).rejects.toThrow();
  });

  it("menolak idempotency key yang sama untuk pengguna yang sama", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Peminjam Idempoten",
        email: "idempoten@example.test",
      },
    });

    const room = await prisma.room.create({
      data: {
        name: "Ruang Idempoten",
        building: "Gedung Uji",
        floor: "1",
        capacity: 10,
        openTime: "08:00",
        closeTime: "17:00",
      },
    });

    const reservation = {
      userId: user.id,
      roomId: room.id,
      start: new Date("2026-10-23T01:00:00.000Z"),
      end: new Date("2026-10-23T02:00:00.000Z"),
      type: "PRIBADI" as const,
      activityName: "Kegiatan Sintetis",
      participantCount: 5,
      idempotencyKey: "kunci-sama",
    };

    await prisma.reservation.create({ data: reservation });

    await expect(
      prisma.reservation.create({ data: reservation }),
    ).rejects.toThrow();
  });
});
