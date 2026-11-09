import { randomUUID } from "node:crypto";
import type { ReservationStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as approvalsGET } from "../app/api/approvals/route";
import { GET as reportsGET } from "../app/api/reports/usage/route";
import { GET as reservationsGET } from "../app/api/reservations/route";
import { createSession } from "@/lib/auth/session";
import {
  COMPLETION_REASON,
  completeFinishedReservations,
} from "@/lib/completion";

const db = new PrismaClient();
const HOUR = 3_600_000;

type Actor = {
  id: string;
  cookie: string;
};

let borrower: Actor;
let manager: Actor;
let room: { id: string };

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
  await db.auditLog.deleteMany();
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

const makeReservation = (input: {
  start?: Date;
  end?: Date;
  status?: ReservationStatus;
  activityName?: string;
}) => {
  const end = input.end ?? new Date(Date.now() - HOUR);
  const start = input.start ?? new Date(end.getTime() - HOUR);

  return db.reservation.create({
    data: {
      userId: borrower.id,
      roomId: room.id,
      start,
      end,
      type: "PRIBADI",
      activityName: input.activityName ?? "Kegiatan Selesai Sintetis",
      participantCount: 4,
      status: input.status ?? "TERKONFIRMASI",
      idempotencyKey: `selesai-${randomUUID()}`,
    },
  });
};

const request = (path: string, cookie?: string) =>
  new Request(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  });

beforeAll(async () => {
  await resetDatabase();

  borrower = await createActor(
    "Peminjam Selesai",
    "selesai-peminjam@example.test",
    "PEMINJAM",
  );
  manager = await createActor(
    "Pengelola Selesai",
    "selesai-pengelola@example.test",
    "PENGELOLA",
  );

  room = await db.room.create({
    data: {
      name: "Ruang Selesai",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "00:00",
      closeTime: "23:59",
      requiresApproval: true,
    },
  });

  await db.roomManager.create({
    data: { roomId: room.id, userId: manager.id },
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

describe("penyelesaian otomatis reservasi", () => {
  it("menyelesaikan reservasi terkonfirmasi yang sudah lewat dan mencatat riwayat", async () => {
    const now = new Date();
    const reservation = await makeReservation({
      start: new Date(now.getTime() - 2 * HOUR),
      end: new Date(now.getTime() - HOUR),
    });

    const completed = await completeFinishedReservations({ db, now });

    expect(completed).toBe(1);

    const updated = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(updated.status).toBe("SELESAI");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: "TERKONFIRMASI",
      newStatus: "SELESAI",
      actorId: null,
      reason: COMPLETION_REASON,
    });
  });

  it("menyelesaikan reservasi tepat pada waktu selesai", async () => {
    const now = new Date();
    const reservation = await makeReservation({
      start: new Date(now.getTime() - HOUR),
      end: now,
    });

    const completed = await completeFinishedReservations({ db, now });

    expect(completed).toBe(1);
    const updated = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(updated.status).toBe("SELESAI");
  });

  it("tidak menyentuh reservasi yang belum selesai atau berstatus lain", async () => {
    const now = new Date();
    const future = await makeReservation({
      start: new Date(now.getTime() + HOUR),
      end: new Date(now.getTime() + 2 * HOUR),
    });
    const pending = await makeReservation({
      start: new Date(now.getTime() - 2 * HOUR),
      end: new Date(now.getTime() - HOUR),
      status: "MENUNGGU_PERSETUJUAN",
    });

    const completed = await completeFinishedReservations({ db, now });

    expect(completed).toBe(0);

    const futureAfter = await db.reservation.findUniqueOrThrow({
      where: { id: future.id },
    });
    const pendingAfter = await db.reservation.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(futureAfter.status).toBe("TERKONFIRMASI");
    expect(pendingAfter.status).toBe("MENUNGGU_PERSETUJUAN");
    expect(
      await db.statusHistory.count({
        where: { reservationId: { in: [future.id, pending.id] } },
      }),
    ).toBe(0);
  });

  it("idempoten saat dijalankan berulang", async () => {
    const now = new Date();
    const reservation = await makeReservation({
      start: new Date(now.getTime() - 2 * HOUR),
      end: new Date(now.getTime() - HOUR),
    });

    expect(await completeFinishedReservations({ db, now })).toBe(1);
    expect(await completeFinishedReservations({ db, now })).toBe(0);

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });
    expect(history).toHaveLength(1);
  });

  it("berjalan otomatis saat daftar reservasi dibuka", async () => {
    const reservation = await makeReservation({
      start: new Date(Date.now() - 2 * HOUR),
      end: new Date(Date.now() - HOUR),
    });

    const response = await reservationsGET(
      request("/api/reservations", borrower.cookie),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const item = body.reservations.find(
      (reservationItem: { id: string }) => reservationItem.id === reservation.id,
    );

    expect(item.status).toBe("SELESAI");
    expect(
      item.history.some(
        (entry: { newStatus: string }) => entry.newStatus === "SELESAI",
      ),
    ).toBe(true);
  });

  it("mengategorikan reservasi selesai pada rekap", async () => {
    const reservation = await makeReservation({
      start: new Date(Date.now() - 2 * HOUR),
      end: new Date(Date.now() - HOUR),
    });

    const params = new URLSearchParams({
      roomId: room.id,
      from: new Date(Date.now() - 3 * HOUR).toISOString(),
      to: new Date(Date.now() + HOUR).toISOString(),
    });
    const response = await reportsGET(
      request(`/api/reports/usage?${params}`, manager.cookie),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.report.byStatus.SELESAI).toBe(1);
    expect(body.report.byStatus.TERKONFIRMASI).toBe(0);
    expect(
      body.report.details.find(
        (detail: { id: string }) => detail.id === reservation.id,
      ).status,
    ).toBe("SELESAI");
  });

  it("tetap tampil pada riwayat persetujuan pengelola", async () => {
    const reservation = await makeReservation({
      start: new Date(Date.now() - 2 * HOUR),
      end: new Date(Date.now() - HOUR),
    });

    const response = await approvalsGET(
      request("/api/approvals", manager.cookie),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.history).toHaveLength(1);
    expect(body.history[0].id).toBe(reservation.id);
    expect(body.history[0].status).toBe("SELESAI");
  });
});
