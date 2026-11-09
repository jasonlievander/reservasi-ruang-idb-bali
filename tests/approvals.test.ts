import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as approvalsGET } from "../app/api/approvals/route";
import { POST as approvePOST } from "../app/api/approvals/[id]/approve/route";
import { POST as rejectPOST } from "../app/api/approvals/[id]/reject/route";
import {
  approvalCardPath,
  approvalCardUrl,
  getApprovalCardUrl,
} from "@/lib/approval-card";
import {
  approveReservation,
  expireOverdueReservations,
  rejectReservation,
} from "@/lib/approvals";
import { createSession } from "@/lib/auth/session";

const db = new PrismaClient();

type Actor = {
  id: string;
  cookie: string;
};

let admin: Actor;
let managerA: Actor;
let managerB: Actor;
let borrower: { id: string };
let roomA: { id: string };
let roomB: { id: string };

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

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
  const user = await db.user.create({
    data: { name, email, role },
  });
  const session = await createSession(user.id, { db });

  return {
    id: user.id,
    cookie: `ruangidb_session=${session.token}`,
  };
};

const createReservation = async (input: {
  roomId?: string;
  status?: "MENUNGGU_PERSETUJUAN" | "TERKONFIRMASI" | "DIBATALKAN";
  start?: Date;
  end?: Date;
  userId?: string;
  activityName?: string;
}) => {
  const start = input.start ?? hoursFromNow(30);
  const end = input.end ?? new Date(start.getTime() + 60 * 60 * 1000);

  return db.reservation.create({
    data: {
      userId: input.userId ?? borrower.id,
      roomId: input.roomId ?? roomA.id,
      start,
      end,
      type: "PRIBADI",
      activityName: input.activityName ?? "Kegiatan Persetujuan Sintetis",
      participantCount: 5,
      status: input.status ?? "MENUNGGU_PERSETUJUAN",
      idempotencyKey: `approval-${randomBytes(8).toString("hex")}`,
    },
  });
};

const approveRequest = (id: string, body: unknown, cookie?: string) =>
  approvePOST(
    new Request(`http://localhost/api/approvals/${id}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const rejectRequest = (id: string, body: unknown, cookie?: string) =>
  rejectPOST(
    new Request(`http://localhost/api/approvals/${id}/reject`, {
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
    "Admin Persetujuan",
    "approval-admin@example.test",
    "ADMIN",
  );
  managerA = await createActor(
    "Pengelola A Persetujuan",
    "approval-a@example.test",
    "PENGELOLA",
  );
  managerB = await createActor(
    "Pengelola B Persetujuan",
    "approval-b@example.test",
    "PENGELOLA",
  );
  const borrowerRecord = await db.user.create({
    data: {
      name: "Peminjam Persetujuan",
      email: "approval-peminjam@example.test",
      role: "PEMINJAM",
    },
  });
  borrower = borrowerRecord;

  const roomARecord = await db.room.create({
    data: {
      name: "Ruang Persetujuan A",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 180,
    },
  });
  const roomBRecord = await db.room.create({
    data: {
      name: "Ruang Persetujuan B",
      building: "Gedung Uji",
      floor: "2",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 180,
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

describe("AC-AP-02 menyetujui pengajuan", () => {
  it("mengubah status dan mencatat pelaku, waktu, serta alasan", async () => {
    const reservation = await createReservation({});
    const response = await approveRequest(
      reservation.id,
      { reason: "Disetujui untuk uji" },
      managerA.cookie,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reservation.status).toBe("TERKONFIRMASI");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
      orderBy: { createdAt: "asc" },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: "MENUNGGU_PERSETUJUAN",
      newStatus: "TERKONFIRMASI",
      actorId: managerA.id,
      reason: "Disetujui untuk uji",
    });
    expect(history[0].createdAt).toBeInstanceOf(Date);
  });
});

describe("kartu persetujuan ruangan", () => {
  it("membuat berkas JPG saat pengajuan disetujui", async () => {
    const reservation = await createReservation({});

    await approveReservation(
      reservation.id,
      { id: managerA.id, role: "PENGELOLA" },
      null,
      { db },
    );

    const buffer = await fs.readFile(approvalCardPath(reservation.id));

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0xff);
    expect(buffer[1]).toBe(0xd8);
    expect(await getApprovalCardUrl(reservation.id)).toBe(
      approvalCardUrl(reservation.id),
    );

    await fs.unlink(approvalCardPath(reservation.id));
  });

  it("tidak membuat kartu untuk pengajuan yang ditolak", async () => {
    const reservation = await createReservation({});

    await rejectReservation(
      reservation.id,
      { id: managerA.id, role: "PENGELOLA" },
      "Jadwal bentrok",
      { db },
    );

    expect(await getApprovalCardUrl(reservation.id)).toBeNull();
  });

  it("menampilkan kartu pada riwayat persetujuan pengelola", async () => {
    const reservation = await createReservation({});

    await approveReservation(
      reservation.id,
      { id: managerA.id, role: "PENGELOLA" },
      null,
      { db },
    );

    const response = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: managerA.cookie },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.history).toHaveLength(1);
    expect(body.history[0].id).toBe(reservation.id);
    expect(body.history[0].approvalCardUrl).toBe(
      approvalCardUrl(reservation.id),
    );
    expect(body.approvals).toHaveLength(0);

    const otherManager = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: managerB.cookie },
      }),
    );
    const otherBody = await otherManager.json();
    expect(otherBody.history).toHaveLength(0);

    await fs.unlink(approvalCardPath(reservation.id));
  });
});

describe("AC-AP-01 menolak pengajuan", () => {
  it("menolak penolakan tanpa alasan", async () => {
    const reservation = await createReservation({});

    const response = await rejectRequest(
      reservation.id,
      { reason: "   " },
      managerA.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_INPUT",
        fields: [expect.objectContaining({ field: "reason" })],
      },
    });

    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(unchanged.status).toBe("MENUNGGU_PERSETUJUAN");
  });

  it("menolak dengan alasan dan mencatat riwayat", async () => {
    const reservation = await createReservation({});

    const response = await rejectRequest(
      reservation.id,
      { reason: "Jadwal bentrok dengan kegiatan kampus" },
      managerA.cookie,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).reservation.status).toBe("DITOLAK");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: "MENUNGGU_PERSETUJUAN",
      newStatus: "DITOLAK",
      actorId: managerA.id,
      reason: "Jadwal bentrok dengan kegiatan kampus",
    });
  });
});

describe("AC-AP-03 kedaluwarsa", () => {
  it("tidak mengubah pengajuan lewat batas menjadi kedaluwarsa (batas dihilangkan)", async () => {
    const due = await createReservation({
      start: hoursFromNow(2),
      end: hoursFromNow(3),
    });
    const notDue = await createReservation({
      start: hoursFromNow(30),
      end: hoursFromNow(31),
    });

    const expired = await expireOverdueReservations({ db });

    expect(expired).toBe(0);

    const dueAfter = await db.reservation.findUniqueOrThrow({
      where: { id: due.id },
    });
    const notDueAfter = await db.reservation.findUniqueOrThrow({
      where: { id: notDue.id },
    });

    expect(dueAfter.status).toBe("MENUNGGU_PERSETUJUAN");
    expect(notDueAfter.status).toBe("MENUNGGU_PERSETUJUAN");
  });

  it("dapat menyetujui pengajuan mendekati waktu mulai (batas dihilangkan)", async () => {
    const reservation = await createReservation({
      start: hoursFromNow(1),
      end: hoursFromNow(2),
    });

    const approved = await approveReservation(
      reservation.id,
      { id: managerA.id, role: "PENGELOLA" },
      null,
      { db },
    );

    expect(approved.status).toBe("TERKONFIRMASI");
  });
});

describe("transisi status dan otorisasi", () => {
  it("menolak transisi dari status yang tidak diizinkan", async () => {
    const confirmed = await createReservation({
      status: "TERKONFIRMASI",
    });

    await expect(
      approveReservation(
        confirmed.id,
        { id: managerA.id, role: "PENGELOLA" },
        null,
        { db },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });

    const cancelled = await createReservation({
      status: "DIBATALKAN",
    });

    await expect(
      rejectReservation(
        cancelled.id,
        { id: managerA.id, role: "PENGELOLA" },
        "Tidak berlaku",
        { db },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("menolak pengelola ruangan lain, tetapi admin boleh", async () => {
    const reservation = await createReservation({});

    await expect(
      approveReservation(
        reservation.id,
        { id: managerB.id, role: "PENGELOLA" },
        null,
        { db },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const approved = await approveReservation(
      reservation.id,
      { id: admin.id, role: "ADMIN" },
      null,
      { db },
    );

    expect(approved.status).toBe("TERKONFIRMASI");
  });

  it("memeriksa ulang bentrok dengan blokir sebelum menyetujui (AP-04)", async () => {
    const reservation = await createReservation({
      start: hoursFromNow(40),
      end: hoursFromNow(41),
    });

    await db.slotBlock.create({
      data: {
        roomId: roomA.id,
        start: hoursFromNow(40.5),
        end: hoursFromNow(41.5),
        reason: "Blokir sintetis",
        createdById: managerA.id,
      },
    });

    await expect(
      approveReservation(
        reservation.id,
        { id: managerA.id, role: "PENGELOLA" },
        null,
        { db },
      ),
    ).rejects.toMatchObject({
      code: "SLOT_CONFLICT",
    });

    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(unchanged.status).toBe("MENUNGGU_PERSETUJUAN");
  });
});

describe("AP-01 antrean persetujuan", () => {
  it("hanya menampilkan pengajuan ruangan yang dikelola, terurut waktu pakai", async () => {
    const later = await createReservation({
      start: hoursFromNow(32),
      end: hoursFromNow(33),
      activityName: "Kegiatan Lebih Lambat",
    });
    const sooner = await createReservation({
      start: hoursFromNow(30),
      end: hoursFromNow(31),
      activityName: "Kegiatan Lebih Dekat",
    });
    const otherRoom = await createReservation({
      roomId: roomB.id,
      start: hoursFromNow(31),
      end: hoursFromNow(32),
    });

    const response = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: managerA.cookie },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.approvals.map((item: { id: string }) => item.id)).toEqual([
      sooner.id,
      later.id,
    ]);
    expect(body.approvals.every((item: { room: { id: string } }) => item.room.id === roomA.id)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const managerBResponse = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: managerB.cookie },
      }),
    );
    const managerBBody = await managerBResponse.json();
    expect(managerBBody.approvals.map((item: { id: string }) => item.id)).toEqual([
      otherRoom.id,
    ]);

    const adminResponse = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: admin.cookie },
      }),
    );
    const adminBody = await adminResponse.json();
    expect(adminBody.approvals).toHaveLength(3);
  });

  it("menolak peminjam dan pengguna anonim", async () => {
    const borrowerSession = await createSession(borrower.id, { db });

    const borrowerResponse = await approvalsGET(
      new Request("http://localhost/api/approvals", {
        headers: { cookie: `ruangidb_session=${borrowerSession.token}` },
      }),
    );
    expect(borrowerResponse.status).toBe(403);

    const anonymous = await approvalsGET(
      new Request("http://localhost/api/approvals"),
    );
    expect(anonymous.status).toBe(401);
  });
});
