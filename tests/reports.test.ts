import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as usageGET } from "../app/api/reports/usage/route";
import { createSession } from "@/lib/auth/session";
import type { UsageReport } from "@/lib/reports";
import { buildUsageWorkbook } from "@/lib/report-xlsx";
import { formatWitaDate, fromWitaDateTime } from "@/lib/wita";

const db = new PrismaClient();
const day = formatWitaDate(new Date(Date.now() + 2 * 86_400_000));
const dayBefore = formatWitaDate(new Date(Date.now() + 86_400_000));
const dayAfter = formatWitaDate(new Date(Date.now() + 3 * 86_400_000));

const atOn = (date: string, time: string): Date => {
  const value = fromWitaDateTime(date, time);
  if (!value) {
    throw new Error(`Tanggal uji tidak valid: ${date} ${time}`);
  }
  return value;
};

const at = (time: string): Date => atOn(day, time);

const periodFrom = at("00:00");
const periodTo = new Date(periodFrom.getTime() + 86_400_000);

type Actor = {
  id: string;
  cookie: string;
};

let admin: Actor;
let managerA: Actor;
let managerB: Actor;
let borrower: Actor;
let roomA: { id: string };
let roomB: { id: string };
let roomC: { id: string };

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

const createReservation = async (input: {
  roomId: string;
  start?: string;
  end?: string;
  status:
    | "MENUNGGU_PERSETUJUAN"
    | "TERKONFIRMASI"
    | "DITOLAK"
    | "DIBATALKAN"
    | "SELESAI";
  startDate?: Date;
  endDate?: Date;
  activityName?: string;
}) =>
  db.reservation.create({
    data: {
      userId: borrower.id,
      roomId: input.roomId,
      start: input.startDate ?? at(input.start ?? "00:00"),
      end: input.endDate ?? at(input.end ?? "01:00"),
      type: "PRIBADI",
      activityName: input.activityName ?? "Kegiatan Rekap Sintetis",
      participantCount: 4,
      status: input.status,
      idempotencyKey: `rekap-${randomBytes(8).toString("hex")}`,
    },
  });

const usageRequest = (params: Record<string, string>, cookie?: string) =>
  usageGET(
    new Request(
      `http://localhost/api/reports/usage?${new URLSearchParams(params)}`,
      {
        headers: cookie ? { cookie } : {},
      },
    ),
  );

beforeAll(async () => {
  await resetDatabase();

  admin = await createActor("Admin Rekap", "rekap-admin@example.test", "ADMIN");
  managerA = await createActor(
    "Pengelola A Rekap",
    "rekap-a@example.test",
    "PENGELOLA",
  );
  managerB = await createActor(
    "Pengelola B Rekap",
    "rekap-b@example.test",
    "PENGELOLA",
  );
  borrower = await createActor(
    "Peminjam Rekap",
    "rekap-peminjam@example.test",
    "PEMINJAM",
  );

  const roomARecord = await db.room.create({
    data: {
      name: "Ruang Rekap A",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "00:00",
      closeTime: "23:59",
    },
  });
  const roomBRecord = await db.room.create({
    data: {
      name: "Ruang Rekap B",
      building: "Gedung Uji",
      floor: "2",
      capacity: 20,
      openTime: "00:00",
      closeTime: "23:59",
    },
  });
  const roomCRecord = await db.room.create({
    data: {
      name: "Ruang Rekap C",
      building: "Gedung Uji",
      floor: "3",
      capacity: 20,
      openTime: "00:00",
      closeTime: "23:59",
    },
  });

  roomA = roomARecord;
  roomB = roomBRecord;
  roomC = roomCRecord;

  await db.roomManager.createMany({
    data: [
      { roomId: roomA.id, userId: managerA.id },
      { roomId: roomC.id, userId: managerA.id },
      { roomId: roomB.id, userId: managerB.id },
    ],
  });

  await createReservation({
    roomId: roomA.id,
    start: "09:00",
    end: "10:00",
    status: "TERKONFIRMASI",
  });
  await createReservation({
    roomId: roomA.id,
    start: "13:00",
    end: "14:30",
    status: "SELESAI",
  });
  await createReservation({
    roomId: roomA.id,
    start: "15:00",
    end: "16:00",
    status: "DIBATALKAN",
  });
  await createReservation({
    roomId: roomA.id,
    start: "16:00",
    end: "17:00",
    status: "MENUNGGU_PERSETUJUAN",
  });
  await createReservation({
    roomId: roomA.id,
    start: "11:00",
    end: "12:00",
    status: "DITOLAK",
  });
  await createReservation({
    roomId: roomB.id,
    start: "10:00",
    end: "11:00",
    status: "TERKONFIRMASI",
  });

  await createReservation({
    roomId: roomC.id,
    status: "TERKONFIRMASI",
    startDate: atOn(dayBefore, "23:00"),
    endDate: atOn(day, "01:00"),
    activityName: "Mulai sebelum periode",
  });
  await createReservation({
    roomId: roomC.id,
    status: "TERKONFIRMASI",
    startDate: atOn(day, "08:00"),
    endDate: atOn(day, "10:00"),
    activityName: "Mulai di dalam periode",
  });
  await createReservation({
    roomId: roomC.id,
    status: "TERKONFIRMASI",
    startDate: atOn(day, "23:00"),
    endDate: atOn(dayAfter, "01:00"),
    activityName: "Melewati batas periode",
  });
  await createReservation({
    roomId: roomC.id,
    status: "MENUNGGU_PERSETUJUAN",
    startDate: atOn(day, "11:00"),
    endDate: atOn(day, "14:00"),
    activityName: "Menunggu persetujuan",
  });
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("AD-02 rekap penggunaan", () => {
  it("menghitung jumlah reservasi, jam terpakai, dan pembatalan", async () => {
    const response = await usageRequest(
      {
        roomId: roomA.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      managerA.cookie,
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.report.room.name).toBe("Ruang Rekap A");
    expect(body.report.totalReservations).toBe(5);
    expect(body.report.usedHours).toBe(2.5);
    expect(body.report.cancellations).toBe(1);
    expect(body.report.byStatus).toMatchObject({
      MENUNGGU_PERSETUJUAN: 1,
      TERKONFIRMASI: 1,
      DITOLAK: 1,
      DIBATALKAN: 1,
      SELESAI: 1,
    });
  });

  it("menghitung reservasi berdasarkan waktu mulai dalam periode", async () => {
    const response = await usageRequest(
      {
        roomId: roomC.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      managerA.cookie,
    );
    const body = await response.json();

    expect(body.report.totalReservations).toBe(3);
    expect(body.report.details.map((item: { activityName: string }) => item.activityName))
      .toEqual([
        "Mulai di dalam periode",
        "Menunggu persetujuan",
        "Melewati batas periode",
      ]);
  });

  it("menghitung jam terpakai hanya dari status Terkonfirmasi dan Selesai", async () => {
    const response = await usageRequest(
      {
        roomId: roomC.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      managerA.cookie,
    );
    const body = await response.json();

    expect(body.report.byStatus.MENUNGGU_PERSETUJUAN).toBe(1);
    expect(body.report.byStatus.TERKONFIRMASI).toBe(2);
    expect(body.report.usedHours).toBe(4);
  });

  it("mengizinkan admin dan menolak pengelola ruangan lain", async () => {
    const adminResponse = await usageRequest(
      {
        roomId: roomA.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      admin.cookie,
    );
    expect(adminResponse.status).toBe(200);

    const otherManager = await usageRequest(
      {
        roomId: roomA.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      managerB.cookie,
    );
    expect(otherManager.status).toBe(403);

    const borrowerResponse = await usageRequest(
      {
        roomId: roomA.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      borrower.cookie,
    );
    expect(borrowerResponse.status).toBe(403);
  });

  it("mengekspor XLSX dengan sheet ringkasan dan rincian", async () => {
    const response = await usageRequest(
      {
        roomId: roomA.id,
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
        format: "xlsx",
      },
      managerA.cookie,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("content-disposition")).toContain(
      "rekap-ruang-rekap-a-",
    );
    expect(response.headers.get("content-disposition")).toContain(".xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Ringkasan",
      "Rincian",
    ]);

    const summary = workbook.getWorksheet("Ringkasan");
    expect(summary).toBeDefined();
    expect(summary!.getCell("A1").value).toBe("LAPORAN PENGGUNAAN RUANGAN");
    expect(summary!.getCell("B3").value).toBe("Ruang Rekap A");
    expect(summary!.getCell("B4").value).toBe("Gedung Uji, lantai 1");
    expect(String(summary!.getCell("B5").value)).toContain("WITA");
    expect(String(summary!.getCell("B5").value)).toContain("23:59");

    expect(summary!.getCell("A9").value).toBe(5);
    expect(summary!.getCell("B9").value).toBe(2.5);
    expect(summary!.getCell("C9").value).toBe(1);

    expect(summary!.getCell("A14").value).toBe("Terkonfirmasi");
    expect(summary!.getCell("B14").value).toBe(1);
    expect(summary!.getCell("A18").value).toBe("Selesai");
    expect(summary!.getCell("B18").value).toBe(1);

    const detail = workbook.getWorksheet("Rincian");
    expect(detail).toBeDefined();
    expect(detail!.getCell("A1").value).toBe("Status");
    expect(detail!.getCell("L1").value).toBe("ID");
    expect(detail!.getCell("A1").font?.bold).toBe(true);
    expect(detail!.rowCount).toBe(6);
    expect(detail!.getCell("A2").value).toBe("Terkonfirmasi");
    expect(detail!.getCell("B2").value).toBeInstanceOf(Date);
    expect(detail!.getCell("B2").numFmt).toBe("dd mmm yyyy");
    expect(detail!.getCell("E2").value).toBe(1);
    expect(detail!.getCell("F2").value).toBe("Ruang Rekap A");
    expect(detail!.getCell("H2").value).toBe("Kegiatan Rekap Sintetis");
    expect(detail!.getCell("I2").value).toBe(4);
    expect(detail!.getCell("L2").value).toBeTruthy();
    expect(detail!.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(detail!.autoFilter).toBeTruthy();
    expect(detail!.getColumn(8).width).toBeGreaterThanOrEqual(20);
  });

  it("menulis keterangan saat tidak ada reservasi", async () => {
    const report: UsageReport = {
      room: {
        id: "ruang-kosong",
        name: "Ruang Kosong",
        building: "Gedung Uji",
        floor: "1",
      },
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-02T00:00:00.000Z",
      totalReservations: 0,
      usedHours: 0,
      cancellations: 0,
      byStatus: {
        MENUNGGU_PERSETUJUAN: 0,
        TERKONFIRMASI: 0,
        DITOLAK: 0,
        DIBATALKAN: 0,
        KEDALUWARSA: 0,
        SELESAI: 0,
        GAGAL: 0,
      },
      details: [],
    };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildUsageWorkbook(report));

    const detail = workbook.getWorksheet("Rincian");
    expect(detail!.getCell("A2").value).toBe(
      "Tidak ada reservasi pada periode ini.",
    );
    expect(detail!.rowCount).toBe(2);
  });

  it("menolak parameter dan rentang yang tidak valid", async () => {
    const missing = await usageRequest({}, managerA.cookie);
    expect(missing.status).toBe(400);

    const reversed = await usageRequest(
      {
        roomId: roomA.id,
        from: periodTo.toISOString(),
        to: periodFrom.toISOString(),
      },
      managerA.cookie,
    );
    expect(reversed.status).toBe(400);
  });
});
