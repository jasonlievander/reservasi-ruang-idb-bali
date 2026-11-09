import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  approveReservation,
  expireOverdueReservations,
  rejectReservation,
} from "@/lib/approvals";
import { cancelReservation } from "@/lib/cancellations";
import type {
  NotificationInput,
  NotificationTransport,
} from "@/lib/notifications";
import { createReservation } from "@/lib/reservations";
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

const approvalNow = new Date(at("09:00").getTime() - 30 * 60 * 60 * 1000);

type RecordingTransport = NotificationTransport & {
  sent: NotificationInput[];
};

const recordingTransport = (): RecordingTransport => {
  const sent: NotificationInput[] = [];
  return {
    sent,
    async send(input) {
      sent.push(input);
    },
  };
};

const failingTransport: NotificationTransport = {
  async send() {
    throw new Error("transport gagal");
  },
};

let borrower: { id: string };
let manager: { id: string };
let room: { id: string };
let roomNoApproval: { id: string };

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

const input = (overrides: Record<string, unknown> = {}) => ({
  userId: borrower.id,
  roomId: room.id,
  start: at("09:00"),
  end: at("10:00"),
  type: "PRIBADI" as const,
  activityName: "Kegiatan Notifikasi Sintetis",
  participantCount: 4,
  idempotencyKey: `notif-${randomBytes(8).toString("hex")}`,
  ...overrides,
});

beforeAll(async () => {
  await resetDatabase();

  const borrowerRecord = await db.user.create({
    data: {
      name: "Peminjam Notifikasi",
      email: "notif-peminjam@example.test",
      role: "PEMINJAM",
    },
  });
  const managerRecord = await db.user.create({
    data: {
      name: "Pengelola Notifikasi",
      email: "notif-pengelola@example.test",
      role: "PENGELOLA",
    },
  });
  const roomRecord = await db.room.create({
    data: {
      name: "Ruang Notifikasi",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 180,
    },
  });

  borrower = borrowerRecord;
  manager = managerRecord;
  room = roomRecord;

  const roomNoApprovalRecord = await db.room.create({
    data: {
      name: "Ruang Notifikasi Langsung",
      building: "Gedung Uji",
      floor: "2",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: false,
      maxDurationMinutes: 180,
    },
  });
  roomNoApproval = roomNoApprovalRecord;

  await db.roomManager.create({
    data: { roomId: room.id, userId: manager.id },
  });
  await db.roomManager.create({
    data: { roomId: roomNoApproval.id, userId: manager.id },
  });
  await db.systemConfig.create({
    data: {
      id: "default",
      maxActiveReservations: 10,
      maxAdvanceDays: 30,
    },
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

describe("NT-01 notifikasi perubahan status", () => {
  it("memberi notifikasi penerimaan ke peminjam dan pengajuan baru ke pengelola", async () => {
    const transport = recordingTransport();
    const reservation = await createReservation(input(), {
      db,
      now: approvalNow,
      notificationTransport: transport,
    });

    expect(transport.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: borrower.id,
          reservationId: reservation.id,
          type: "PENGAJUAN_DITERIMA",
        }),
        expect.objectContaining({
          recipientId: manager.id,
          reservationId: reservation.id,
          type: "PENGAJUAN_BARU",
        }),
      ]),
    );

    const records = await db.notification.findMany({
      where: { reservationId: reservation.id },
    });
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.deliveryStatus === "TERKIRIM")).toBe(
      true,
    );
  });

  it("memberi notifikasi disetujui tanpa antrean pada ruangan tanpa persetujuan", async () => {
    const transport = recordingTransport();
    const reservation = await createReservation(
      input({ roomId: roomNoApproval.id }),
      {
        db,
        now: approvalNow,
        notificationTransport: transport,
      },
    );

    expect(reservation.status).toBe("TERKONFIRMASI");
    expect(transport.sent).toEqual([
      {
        recipientId: borrower.id,
        reservationId: reservation.id,
        type: "DISETUJUI",
      },
    ]);

    const records = await db.notification.findMany({
      where: { reservationId: reservation.id },
    });
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("DISETUJUI");
    expect(records[0].deliveryStatus).toBe("TERKIRIM");
  });

  it("memberi notifikasi saat disetujui dan ditolak", async () => {
    const approvedTransport = recordingTransport();
    const approved = await createReservation(input(), {
      db,
      now: approvalNow,
      notificationTransport: approvedTransport,
    });
    await approveReservation(
      approved.id,
      { id: manager.id, role: "PENGELOLA" },
      null,
      { db, now: approvalNow, notificationTransport: approvedTransport },
    );

    expect(approvedTransport.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: borrower.id,
          reservationId: approved.id,
          type: "DISETUJUI",
        }),
      ]),
    );

    const rejectedTransport = recordingTransport();
    const rejected = await createReservation(
      input({ start: at("11:00"), end: at("12:00") }),
      {
        db,
        now: approvalNow,
        notificationTransport: rejectedTransport,
      },
    );
    await rejectReservation(
      rejected.id,
      { id: manager.id, role: "PENGELOLA" },
      "Alasan penolakan uji",
      { db, now: approvalNow, notificationTransport: rejectedTransport },
    );

    expect(rejectedTransport.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: borrower.id,
          reservationId: rejected.id,
          type: "DITOLAK",
        }),
      ]),
    );

    const cancelledTransport = recordingTransport();
    const cancelled = await createReservation(
      input({ start: at("13:00"), end: at("14:00") }),
      {
        db,
        now: approvalNow,
        notificationTransport: cancelledTransport,
      },
    );
    await cancelReservation(
      cancelled.id,
      { id: manager.id, role: "PENGELOLA" },
      { reason: "Dibatalkan pengelola untuk uji" },
      { db, now: approvalNow, notificationTransport: cancelledTransport },
    );

    expect(cancelledTransport.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: borrower.id,
          reservationId: cancelled.id,
          type: "DIBATALKAN_PENGELOLA",
        }),
      ]),
    );
  });

  it("tidak mengedaluwarsakan pengajuan selama AP-03 dimatikan", async () => {
    const transport = recordingTransport();
    const reservation = await db.reservation.create({
      data: {
        userId: borrower.id,
        roomId: room.id,
        start: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000),
        type: "PRIBADI",
        activityName: "Kegiatan Kedaluwarsa Notifikasi",
        participantCount: 4,
        status: "MENUNGGU_PERSETUJUAN",
        idempotencyKey: "notif-expire",
      },
    });

    const expired = await expireOverdueReservations({
      db,
      notificationTransport: transport,
    });

    expect(expired).toBe(0);
    expect(transport.sent).toEqual([]);

    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(unchanged.status).toBe("MENUNGGU_PERSETUJUAN");
  });
});

describe("AC-NT-01 kegagalan notifikasi tidak mengubah status", () => {
  it("tetap membuat reservasi dan menandai notifikasi gagal", async () => {
    const reservation = await createReservation(input(), {
      db,
      now: approvalNow,
      notificationTransport: failingTransport,
    });

    expect(reservation.status).toBe("MENUNGGU_PERSETUJUAN");

    const records = await db.notification.findMany({
      where: { reservationId: reservation.id },
    });
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.deliveryStatus === "GAGAL")).toBe(
      true,
    );
  });

  it("tetap menyetujui reservasi meski notifikasi gagal", async () => {
    const reservation = await createReservation(input(), {
      db,
      now: approvalNow,
      notificationTransport: recordingTransport(),
    });

    const approved = await approveReservation(
      reservation.id,
      { id: manager.id, role: "PENGELOLA" },
      null,
      { db, now: approvalNow, notificationTransport: failingTransport },
    );

    expect(approved.status).toBe("TERKONFIRMASI");

    const notification = await db.notification.findFirstOrThrow({
      where: { reservationId: reservation.id, type: "DISETUJUI" },
    });
    expect(notification.deliveryStatus).toBe("GAGAL");
  });

  it("tetap menolak reservasi meski notifikasi gagal", async () => {
    const reservation = await createReservation(
      input({ start: at("11:00"), end: at("12:00") }),
      {
        db,
        now: approvalNow,
        notificationTransport: recordingTransport(),
      },
    );

    const rejected = await rejectReservation(
      reservation.id,
      { id: manager.id, role: "PENGELOLA" },
      "Alasan penolakan uji gagal",
      { db, now: approvalNow, notificationTransport: failingTransport },
    );

    expect(rejected.status).toBe("DITOLAK");

    const notification = await db.notification.findFirstOrThrow({
      where: { reservationId: reservation.id, type: "DITOLAK" },
    });
    expect(notification.deliveryStatus).toBe("GAGAL");
  });

  it("tetap membatalkan oleh pengelola meski notifikasi gagal", async () => {
    const reservation = await createReservation(
      input({ start: at("13:00"), end: at("14:00") }),
      {
        db,
        now: approvalNow,
        notificationTransport: recordingTransport(),
      },
    );

    const cancelled = await cancelReservation(
      reservation.id,
      { id: manager.id, role: "PENGELOLA" },
      { reason: "Pembatalan uji gagal notifikasi" },
      { db, now: approvalNow, notificationTransport: failingTransport },
    );

    expect(cancelled.status).toBe("DIBATALKAN");

    const notification = await db.notification.findFirstOrThrow({
      where: {
        reservationId: reservation.id,
        type: "DIBATALKAN_PENGELOLA",
      },
    });
    expect(notification.deliveryStatus).toBe("GAGAL");
  });
});
