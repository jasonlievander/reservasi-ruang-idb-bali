import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cancelPOST } from "../app/api/reservations/[id]/cancel/route";
import { createSession } from "@/lib/auth/session";
import { cancelReservation } from "@/lib/cancellations";
import { searchAvailableRooms } from "@/lib/rooms";
import { formatWitaDate, fromWitaDateTime } from "@/lib/wita";

const db = new PrismaClient();
const day = formatWitaDate(new Date(Date.now() + 2 * 86_400_000));

const at = (time: string): Date => {
  const value = fromWitaDateTime(day, time);
  if (!value) {
    throw new Error(`Tanggal uji tidak valid: ${day} ${time}`);
  }
  return value;
};

type Actor = {
  id: string;
  cookie: string;
};

let admin: Actor;
let managerA: Actor;
let managerB: Actor;
let borrowerA: Actor;
let borrowerB: Actor;
let roomA: { id: string };
let roomB: { id: string };

const resetDatabase = async () => {
  await db.notification.deleteMany();
  await db.statusHistory.deleteMany();
  await db.reservation.deleteMany();
  await db.slotBlock.deleteMany();
  await db.roomManager.deleteMany();
  await db.organizationMember.deleteMany();
  await db.organization.deleteMany();
  await db.session.deleteMany();
  await db.loginThrottle.deleteMany();
  await db.room.deleteMany();
  await db.user.deleteMany();
  await db.systemConfig.deleteMany();
};

const createActor = async (
  name: string,
  email: string,
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN",
): Promise<Actor> => {
  const user = await db.user.create({ data: { name, email, role } });
  const session = await createSession(user.id, { db });
  return {
    id: user.id,
    cookie: `ruangidb_session=${session.token}`,
  };
};

const createReservation = async (input: {
  roomId?: string;
  userId?: string;
  start?: Date;
  end?: Date;
  status?: "MENUNGGU_PERSETUJUAN" | "TERKONFIRMASI" | "DIBATALKAN";
}) => {
  const start = input.start ?? at("09:00");
  const end = input.end ?? at("10:00");

  return db.reservation.create({
    data: {
      userId: input.userId ?? borrowerA.id,
      roomId: input.roomId ?? roomA.id,
      start,
      end,
      type: "PRIBADI",
      activityName: "Kegiatan Pembatalan Sintetis",
      participantCount: 3,
      status: input.status ?? "MENUNGGU_PERSETUJUAN",
      idempotencyKey: `cancel-${randomBytes(8).toString("hex")}`,
    },
  });
};

const cancelRequest = (id: string, body: unknown, cookie?: string) =>
  cancelPOST(
    new Request(`http://localhost/api/reservations/${id}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeAll(async () => {
  await resetDatabase();

  admin = await createActor(
    "Admin Pembatalan",
    "cancel-admin@example.test",
    "ADMIN",
  );
  managerA = await createActor(
    "Pengelola A Pembatalan",
    "cancel-a@example.test",
    "PENGELOLA",
  );
  managerB = await createActor(
    "Pengelola B Pembatalan",
    "cancel-b@example.test",
    "PENGELOLA",
  );
  borrowerA = await createActor(
    "Peminjam A Pembatalan",
    "cancel-peminjam-a@example.test",
    "PEMINJAM",
  );
  borrowerB = await createActor(
    "Peminjam B Pembatalan",
    "cancel-peminjam-b@example.test",
    "PEMINJAM",
  );

  const roomARecord = await db.room.create({
    data: {
      name: "Ruang Pembatalan A",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      roomType: "cancel",
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 180,
      cancellationDeadlineMinutes: 0,
    },
  });
  const roomBRecord = await db.room.create({
    data: {
      name: "Ruang Pembatalan B",
      building: "Gedung Uji",
      floor: "2",
      capacity: 20,
      roomType: "cancel",
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 180,
      cancellationDeadlineMinutes: 120,
    },
  });

  roomA = roomARecord;
  roomB = roomBRecord;

  await db.roomManager.createMany({
    data: [
      { roomId: roomA.id, userId: managerA.id },
      { roomId: roomB.id, userId: managerB.id },
    ],
  });
});

beforeEach(async () => {
  await db.notification.deleteMany();
  await db.statusHistory.deleteMany();
  await db.reservation.deleteMany();
  await db.slotBlock.deleteMany();
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("AC-PB-01 akun lain ditolak", () => {
  it("menolak pembatalan oleh akun lain dan tidak mengubah data", async () => {
    const reservation = await createReservation({ userId: borrowerA.id });

    const response = await cancelRequest(
      reservation.id,
      {},
      borrowerB.cookie,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });

    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(unchanged.status).toBe("MENUNGGU_PERSETUJUAN");
  });
});

describe("AC-PB-02 pembatalan sendiri", () => {
  it("membatalkan sebelum batas dan melepas slot", async () => {
    const reservation = await createReservation({ userId: borrowerA.id });

    const response = await cancelRequest(
      reservation.id,
      {},
      borrowerA.cookie,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).reservation.status).toBe("DIBATALKAN");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: "MENUNGGU_PERSETUJUAN",
      newStatus: "DIBATALKAN",
      actorId: borrowerA.id,
      reason: "Dibatalkan peminjam",
    });
    expect(history[0].createdAt).toBeInstanceOf(Date);

    const available = await searchAvailableRooms({
      start: at("09:00"),
      end: at("10:00"),
      capacity: 1,
      roomType: "cancel",
    });

    expect(available.map((room) => room.id)).toContain(roomA.id);
  });

  it("menolak pembatalan tepat setelah batas waktu ruangan", async () => {
    const reservation = await createReservation({
      roomId: roomB.id,
      userId: borrowerA.id,
    });

    await expect(
      cancelReservation(
        reservation.id,
        { id: borrowerA.id, role: "PEMINJAM" },
        {},
        { db, now: at("08:30") },
      ),
    ).rejects.toMatchObject({
      code: "CANCELLATION_DEADLINE_PASSED",
    });

    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(unchanged.status).toBe("MENUNGGU_PERSETUJUAN");
  });

  it("menolak pembatalan setelah waktu mulai pada ruangan tanpa batas", async () => {
    const reservation = await createReservation({
      roomId: roomA.id,
      userId: borrowerA.id,
    });

    await expect(
      cancelReservation(
        reservation.id,
        { id: borrowerA.id, role: "PEMINJAM" },
        {},
        { db, now: at("09:00") },
      ),
    ).rejects.toMatchObject({
      code: "CANCELLATION_DEADLINE_PASSED",
    });
  });
});

describe("PB-02 pembatalan oleh pengelola", () => {
  it("mewajibkan alasan dan mencatat pelaku serta waktu", async () => {
    const reservation = await createReservation({
      status: "TERKONFIRMASI",
      userId: borrowerA.id,
    });

    await expect(
      cancelReservation(
        reservation.id,
        { id: managerA.id, role: "PENGELOLA" },
        {},
        { db, now: at("07:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: [expect.objectContaining({ field: "reason" })],
    });

    const cancelled = await cancelReservation(
      reservation.id,
      { id: managerA.id, role: "PENGELOLA" },
      { reason: "Ruangan dipakai untuk kegiatan kampus" },
      { db, now: at("07:00") },
    );

    expect(cancelled.status).toBe("DIBATALKAN");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: "TERKONFIRMASI",
      newStatus: "DIBATALKAN",
      actorId: managerA.id,
      reason: "Ruangan dipakai untuk kegiatan kampus",
    });
    expect(history[0].createdAt.getTime()).toBe(at("07:00").getTime());
  });

  it("menolak pengelola ruangan lain", async () => {
    const reservation = await createReservation({});

    await expect(
      cancelReservation(
        reservation.id,
        { id: managerB.id, role: "PENGELOLA" },
        { reason: "Bukan ruangannya" },
        { db, now: at("07:00") },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("mengizinkan admin membatalkan dengan alasan", async () => {
    const reservation = await createReservation({});

    const cancelled = await cancelReservation(
      reservation.id,
      { id: admin.id, role: "ADMIN" },
      { reason: "Kebijakan kampus" },
      { db, now: at("07:00") },
    );

    expect(cancelled.status).toBe("DIBATALKAN");
  });

  it("menolak pembatalan pada status yang tidak dapat dibatalkan", async () => {
    const reservation = await createReservation({
      status: "DIBATALKAN",
      userId: borrowerA.id,
    });

    await expect(
      cancelReservation(
        reservation.id,
        { id: borrowerA.id, role: "PEMINJAM" },
        {},
        { db, now: at("07:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("menolak pengguna anonim", async () => {
    const reservation = await createReservation({});
    const response = await cancelRequest(reservation.id, {});

    expect(response.status).toBe(401);
  });
});
