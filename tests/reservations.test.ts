import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as reservationsGET } from "../app/api/reservations/route";
import { createSession } from "@/lib/auth/session";
import {
  createReservation,
  ReservationError,
  type CreateReservationInput,
} from "@/lib/reservations";
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

const futureDay = (days: number) =>
  formatWitaDate(new Date(Date.now() + days * 86_400_000));

const atFuture = (days: number, time: string): Date => {
  const date = futureDay(days);
  const value = fromWitaDateTime(date, time);
  if (!value) {
    throw new Error(`Tanggal uji tidak valid: ${date} ${time}`);
  }
  return value;
};

let borrowerA: { id: string };
let borrowerB: { id: string };
let manager: { id: string };
let outsider: { id: string };
let organization: { id: string };
let instantRoom: { id: string };
let approvalRoom: { id: string };

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

const input = (
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput => ({
  userId: borrowerA.id,
  roomId: instantRoom.id,
  start: at("09:00"),
  end: at("10:00"),
  type: "PRIBADI",
  activityName: "Kegiatan Sintetis",
  participantCount: 5,
  idempotencyKey: `kunci-${Math.random().toString(36).slice(2)}`,
  ...overrides,
});

beforeAll(async () => {
  await resetDatabase();

  const borrowerARecord = await db.user.create({
    data: {
      name: "Peminjam A Sintetis",
      email: "reservasi-a@example.test",
      role: "PEMINJAM",
    },
  });
  const borrowerBRecord = await db.user.create({
    data: {
      name: "Peminjam B Sintetis",
      email: "reservasi-b@example.test",
      role: "PEMINJAM",
    },
  });
  const managerRecord = await db.user.create({
    data: {
      name: "Pengelola Reservasi Sintetis",
      email: "reservasi-pengelola@example.test",
      role: "PENGELOLA",
    },
  });
  const outsiderRecord = await db.user.create({
    data: {
      name: "Non-Anggota Sintetis",
      email: "reservasi-luar@example.test",
      role: "PEMINJAM",
    },
  });
  const organizationRecord = await db.organization.create({
    data: { name: "Organisasi Reservasi Sintetis" },
  });

  await db.organizationMember.createMany({
    data: [
      {
        userId: borrowerARecord.id,
        organizationId: organizationRecord.id,
        role: "PENGURUS",
      },
      {
        userId: borrowerBRecord.id,
        organizationId: organizationRecord.id,
        role: "ANGGOTA",
      },
    ],
  });

  await db.systemConfig.create({
    data: {
      id: "default",
      maxActiveReservations: 10,
      maxAdvanceDays: 30,
    },
  });
  const instantRoomRecord = await db.room.create({
    data: {
      name: "Ruang Langsung Sintetis",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: false,
      maxDurationMinutes: 180,
    },
  });
  const approvalRoomRecord = await db.room.create({
    data: {
      name: "Ruang Persetujuan Sintetis",
      building: "Gedung Uji",
      floor: "2",
      capacity: 12,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: true,
      maxDurationMinutes: 120,
    },
  });

  borrowerA = borrowerARecord;
  borrowerB = borrowerBRecord;
  manager = managerRecord;
  outsider = outsiderRecord;
  organization = organizationRecord;
  instantRoom = instantRoomRecord;
  approvalRoom = approvalRoomRecord;
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("FR-02 / RS-02 pengajuan reservasi slot tersedia", () => {
  it("membuat reservasi sukses pada ruangan tanpa persetujuan", async () => {
    const reservation = await createReservation(
      input({ idempotencyKey: "sukses-langsung" }),
      { db, now: at("08:00") },
    );

    expect(reservation.status).toBe("TERKONFIRMASI");
    expect(reservation.roomId).toBe(instantRoom.id);
    expect(reservation.organizationId).toBeNull();
    expect(reservation.activityName).toBe("Kegiatan Sintetis");

    const history = await db.statusHistory.findMany({
      where: { reservationId: reservation.id },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: null,
      newStatus: "TERKONFIRMASI",
      actorId: borrowerA.id,
    });
  });

  it("membuat reservasi sukses pada ruangan yang butuh persetujuan", async () => {
    const reservation = await createReservation(
      input({
        roomId: approvalRoom.id,
        type: "ORGANISASI",
        organizationId: organization.id,
        start: at("11:00"),
        end: at("12:00"),
        idempotencyKey: "sukses-persetujuan",
      }),
      { db, now: at("08:00") },
    );

    expect(reservation.status).toBe("MENUNGGU_PERSETUJUAN");
    expect(reservation.organizationId).toBe(organization.id);
  });

  it("menahan slot saat reservasi masih menunggu persetujuan", async () => {
    await expect(
      createReservation(
        input({
          userId: borrowerB.id,
          roomId: approvalRoom.id,
          start: at("11:30"),
          end: at("12:30"),
          idempotencyKey: "menunggu-menahan-slot",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "SLOT_CONFLICT",
    });
  });

  it("menolak reservasi yang beririsan dengan reservasi aktif", async () => {
    await createReservation(
      input({
        start: at("13:00"),
        end: at("14:00"),
        idempotencyKey: "konflik-dasar",
      }),
      { db, now: at("08:00") },
    );

    await expect(
      createReservation(
        input({
          userId: borrowerB.id,
          start: at("13:30"),
          end: at("14:30"),
          idempotencyKey: "konflik-beririsan",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "SLOT_CONFLICT",
    });
  });

  it("mengizinkan slot bersebelahan karena interval setengah terbuka", async () => {
    const reservation = await createReservation(
      input({
        userId: borrowerB.id,
        start: at("14:00"),
        end: at("15:00"),
        idempotencyKey: "slot-bersebelahan",
      }),
      { db, now: at("08:00") },
    );

    expect(reservation.status).toBe("TERKONFIRMASI");
  });

  it("menolak reservasi yang beririsan dengan blokir", async () => {
    await db.slotBlock.create({
      data: {
        roomId: instantRoom.id,
        start: at("16:00"),
        end: at("17:00"),
        reason: "Perawatan sintetis",
        createdById: manager.id,
      },
    });

    await expect(
      createReservation(
        input({
          start: at("16:30"),
          end: at("17:00"),
          idempotencyKey: "konflik-blokir",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "SLOT_CONFLICT",
    });
  });

  it("menolak input waktu yang tidak valid (BR-01)", async () => {
    await expect(
      createReservation(
        input({
          start: at("09:00"),
          end: at("09:00"),
          idempotencyKey: "waktu-sama",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: [
        expect.objectContaining({
          field: "end",
          code: "START_NOT_BEFORE_END",
        }),
      ],
    });
  });

  it("menolak input di luar jam operasional (BR-01)", async () => {
    await expect(
      createReservation(
        input({
          start: at("07:00"),
          end: at("08:30"),
          idempotencyKey: "luar-jam",
        }),
        { db, now: at("06:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: [
        expect.objectContaining({
          field: "start",
          code: "OUTSIDE_OPERATING_HOURS",
        }),
      ],
    });
  });

  it("menolak input yang melebihi kapasitas (BR-05)", async () => {
    await expect(
      createReservation(
        input({
          participantCount: 21,
          idempotencyKey: "kapasitas-lebih",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: [
        expect.objectContaining({
          field: "participantCount",
          code: "EXCEEDS_CAPACITY",
        }),
      ],
    });
  });

  it("menolak input tanpa nama kegiatan", async () => {
    await expect(
      createReservation(
        input({
          activityName: "   ",
          idempotencyKey: "tanpa-kegiatan",
        }),
        { db, now: at("08:00") },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: [
        expect.objectContaining({
          field: "activityName",
          code: "REQUIRED",
        }),
      ],
    });
  });

  it("mengembalikan reservasi yang sama untuk request berulang", async () => {
    const payload = input({
      start: at("08:00"),
      end: at("09:00"),
      idempotencyKey: "request-berulang",
    });

    const first = await createReservation(payload, { db, now: at("07:00") });
    const second = await createReservation(payload, { db, now: at("07:00") });

    expect(second.id).toBe(first.id);

    const count = await db.reservation.count({
      where: {
        userId: borrowerA.id,
        idempotencyKey: "request-berulang",
      },
    });

    expect(count).toBe(1);
  });

  it("menolak request berulang dengan payload berbeda", async () => {
    const first = input({
      start: at("15:00"),
      end: at("16:00"),
      idempotencyKey: "request-berbeda",
    });

    await createReservation(first, { db, now: at("07:00") });

    await expect(
      createReservation(
        { ...first, activityName: "Kegiatan Berbeda" },
        { db, now: at("07:00") },
      ),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
    });
  });
});

describe("BR-06 keanggotaan organisasi", () => {
  it("menerima reservasi organisasi oleh pengguna yang bukan anggota", async () => {
    const reservation = await createReservation(
      input({
        userId: outsider.id,
        roomId: approvalRoom.id,
        type: "ORGANISASI",
        organizationId: organization.id,
        start: at("15:00"),
        end: at("16:00"),
        idempotencyKey: "organisasi-non-anggota",
      }),
      { db, now: at("08:00") },
    );

    expect(reservation.status).toBe("MENUNGGU_PERSETUJUAN");
    expect(reservation.organizationId).toBe(organization.id);
  });

  it("menerima reservasi organisasi oleh anggota", async () => {
    const reservation = await createReservation(
      input({
        roomId: approvalRoom.id,
        type: "ORGANISASI",
        organizationId: organization.id,
        start: at("16:00"),
        end: at("17:00"),
        idempotencyKey: "organisasi-anggota",
      }),
      { db, now: at("08:00") },
    );

    expect(reservation.status).toBe("MENUNGGU_PERSETUJUAN");
    expect(reservation.organizationId).toBe(organization.id);
  });
});

describe("BR-07 batas reservasi", () => {
  it("menolak saat batas reservasi aktif tercapai", async () => {
    const limitUser = await db.user.create({
      data: {
        name: "Peminjam Batas Sintetis",
        email: "reservasi-batas@example.test",
        role: "PEMINJAM",
      },
    });
    const limitRoom = await db.room.create({
      data: {
        name: "Ruang Batas Sintetis",
        building: "Gedung Uji",
        floor: "5",
        capacity: 10,
        openTime: "08:00",
        closeTime: "17:00",
        requiresApproval: false,
        maxDurationMinutes: 180,
      },
    });

    await db.systemConfig.update({
      where: { id: "default" },
      data: { maxActiveReservations: 3 },
    });

    try {
      for (const [index, time] of ["08:00", "09:00", "10:00"].entries()) {
        const end = ["09:00", "10:00", "11:00"][index];
        await createReservation(
          {
            userId: limitUser.id,
            roomId: limitRoom.id,
            start: at(time),
            end: at(end),
            type: "PRIBADI",
            activityName: "Kegiatan Batas",
            participantCount: 2,
            idempotencyKey: `batas-${index}`,
          },
          { db, now: at("07:00") },
        );
      }

      await expect(
        createReservation(
          {
            userId: limitUser.id,
            roomId: limitRoom.id,
            start: at("11:00"),
            end: at("12:00"),
            type: "PRIBADI",
            activityName: "Kegiatan Batas Keempat",
            participantCount: 2,
            idempotencyKey: "batas-3",
          },
          { db, now: at("07:00") },
        ),
      ).rejects.toMatchObject({
        code: "LIMIT_EXCEEDED",
      });
    } finally {
      await db.systemConfig.update({
        where: { id: "default" },
        data: { maxActiveReservations: 10 },
      });
    }
  });

  it("menolak pemesanan melewati jarak maksimum ke depan", async () => {
    const advanceUser = await db.user.create({
      data: {
        name: "Peminjam Jauh Sintetis",
        email: "reservasi-jauh@example.test",
        role: "PEMINJAM",
      },
    });

    await expect(
      createReservation(
        {
          userId: advanceUser.id,
          roomId: instantRoom.id,
          start: atFuture(31, "09:00"),
          end: atFuture(31, "10:00"),
          type: "PRIBADI",
          activityName: "Kegiatan Jauh",
          participantCount: 2,
          idempotencyKey: "jarak-jauh",
        },
        { db, now: new Date() },
      ),
    ).rejects.toMatchObject({
      code: "ADVANCE_WINDOW_EXCEEDED",
    });
  });
});

describe("RS-07 daftar reservasi sendiri", () => {
  it("hanya mengembalikan reservasi milik pengguna beserta riwayat", async () => {
    const session = await createSession(borrowerA.id, { db });
    const response = await reservationsGET(
      new Request("http://localhost/api/reservations", {
        headers: { cookie: `ruangidb_session=${session.token}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.reservations.length).toBeGreaterThan(0);
    expect(
      body.reservations.every(
        (reservation: { userId: string }) =>
          reservation.userId === borrowerA.id,
      ),
    ).toBe(true);
    expect(
      body.reservations.some(
        (reservation: { history: unknown[] }) =>
          reservation.history.length > 0,
      ),
    ).toBe(true);
  });

  it("menolak pengguna anonim", async () => {
    const response = await reservationsGET(
      new Request("http://localhost/api/reservations"),
    );

    expect(response.status).toBe(401);
  });
});

describe("FR-02 / BR-02 dua request bersamaan", () => {
  it("tepat satu request berhasil pada slot yang sama", async () => {
    const raceRoom = await db.room.create({
      data: {
        name: "Ruang Balapan Sintetis",
        building: "Gedung Uji",
        floor: "3",
        capacity: 20,
        openTime: "08:00",
        closeTime: "17:00",
        requiresApproval: false,
        maxDurationMinutes: 120,
      },
    });

    const results = await Promise.allSettled([
      createReservation(
        input({
          roomId: raceRoom.id,
          start: at("10:00"),
          end: at("11:00"),
          idempotencyKey: "balapan-a",
        }),
        { db, now: at("08:00") },
      ),
      createReservation(
        input({
          userId: borrowerB.id,
          roomId: raceRoom.id,
          start: at("10:00"),
          end: at("11:00"),
          idempotencyKey: "balapan-b",
        }),
        { db, now: at("08:00") },
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ReservationError);
    expect(reason.code).toBe("SLOT_CONFLICT");

    const activeCount = await db.reservation.count({
      where: {
        roomId: raceRoom.id,
        status: { in: ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"] },
      },
    });

    expect(activeCount).toBe(1);
  });
});
