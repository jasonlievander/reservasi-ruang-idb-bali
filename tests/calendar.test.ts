import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as calendarGET } from "../app/api/calendar/route";
import { getRoomCalendar } from "@/lib/calendar";
import { formatWitaDate, fromWitaDateTime } from "@/lib/wita";

const db = new PrismaClient();
const today = formatWitaDate(new Date());
const from = fromWitaDateTime(today, "00:00");
const to = from ? new Date(from.getTime() + 86_400_000) : new Date();

let borrower: { id: string; name: string; email: string };
let room: { id: string };
let otherRoom: { id: string };

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

beforeAll(async () => {
  await resetDatabase();

  const borrowerRecord = await db.user.create({
    data: {
      name: "Pemilik Ruangan",
      email: "kalender-pemilik@example.test",
      role: "PEMINJAM",
    },
  });
  const roomRecord = await db.room.create({
    data: {
      name: "Ruang Kalender A",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
    },
  });
  const otherRoomRecord = await db.room.create({
    data: {
      name: "Ruang Kalender B",
      building: "Gedung Uji",
      floor: "2",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
    },
  });

  borrower = borrowerRecord;
  room = roomRecord;
  otherRoom = otherRoomRecord;
});

beforeEach(async () => {
  await db.reservation.deleteMany();
  await db.slotBlock.deleteMany();
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

const at = (hour: number, minute = 0) => {
  const base = from ?? new Date();
  return new Date(base.getTime() + hour * 3_600_000 + minute * 60_000);
};

describe("RU-03 kalender pemakaian ruangan", () => {
  it("menampilkan slot terpakai, diblokir, dan ruangan kosong", async () => {
    await db.reservation.create({
      data: {
        userId: borrower.id,
        roomId: room.id,
        start: at(9),
        end: at(11),
        type: "PRIBADI",
        activityName: "Kegiatan Terpakai",
        participantCount: 5,
        status: "TERKONFIRMASI",
        idempotencyKey: "kalender-1",
      },
    });

    await db.slotBlock.create({
      data: {
        roomId: room.id,
        start: at(13),
        end: at(15),
        reason: "Perawatan",
        createdById: borrower.id,
      },
    });

    const calendar = await getRoomCalendar({ from: from!, to: to! });
    const booked = calendar.rooms.find((item) => item.id === room.id);
    const free = calendar.rooms.find((item) => item.id === otherRoom.id);

    expect(booked?.slots).toHaveLength(2);
    expect(booked?.slots[0]).toMatchObject({
      kind: "RESERVASI",
      status: "TERKONFIRMASI",
    });
    expect(booked?.slots[1]).toMatchObject({
      kind: "BLOKIR",
      status: null,
    });
    expect(free?.slots).toEqual([]);
  });

  it("tidak menampilkan data pribadi peminjam lain", async () => {
    await db.reservation.create({
      data: {
        userId: borrower.id,
        roomId: room.id,
        start: at(9),
        end: at(10),
        type: "PRIBADI",
        activityName: "Rahasia",
        participantCount: 5,
        status: "TERKONFIRMASI",
        idempotencyKey: "kalender-2",
      },
    });

    const calendar = await getRoomCalendar({ from: from!, to: to! });
    const payload = JSON.stringify(calendar);

    expect(payload).not.toContain("Pemilik Ruangan");
    expect(payload).not.toContain("kalender-pemilik@example.test");
    expect(payload).not.toContain("Rahasia");
  });

  it("mengabaikan status yang tidak aktif", async () => {
    await db.reservation.create({
      data: {
        userId: borrower.id,
        roomId: room.id,
        start: at(9),
        end: at(10),
        type: "PRIBADI",
        activityName: "Dibatalkan",
        participantCount: 5,
        status: "DIBATALKAN",
        idempotencyKey: "kalender-3",
      },
    });

    const calendar = await getRoomCalendar({ from: from!, to: to! });
    const booked = calendar.rooms.find((item) => item.id === room.id);

    expect(booked?.slots).toEqual([]);
  });

  it("validasi parameter tanggal dan rentang", async () => {
    const invalid = await calendarGET(
      new Request("http://localhost/api/calendar?date=bukan-tanggal"),
    );
    expect(invalid.status).toBe(400);

    const invalidDays = await calendarGET(
      new Request("http://localhost/api/calendar?days=30"),
    );
    expect(invalidDays.status).toBe(400);

    const ok = await calendarGET(
      new Request(`http://localhost/api/calendar?date=${today}`),
    );
    expect(ok.status).toBe(200);
  });
});
