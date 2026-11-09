import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as roomsGET } from "../app/api/rooms/route";
import { GET as availabilityGET } from "../app/api/rooms/availability/route";
import { PATCH as roomPATCH } from "../app/api/rooms/[id]/route";
import { POST as blockPOST } from "../app/api/rooms/[id]/blocks/route";
import { DELETE as blockDELETE } from "../app/api/rooms/[id]/blocks/[blockId]/route";
import { createSession } from "@/lib/auth/session";
import { formatWitaDate, fromWitaDateTime } from "@/lib/wita";

const db = new PrismaClient();
const day = formatWitaDate(new Date(Date.now() + 3 * 86_400_000));

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
let borrower: Actor;
let roomA: { id: string };
let roomB: { id: string };
let roomC: { id: string };
let roomD: { id: string };

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

const patchRequest = (roomId: string, body: unknown, cookie?: string) =>
  roomPATCH(
    new Request(`http://localhost/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: roomId }) },
  );

const blockRequest = (roomId: string, body: unknown, cookie?: string) =>
  blockPOST(
    new Request(`http://localhost/api/rooms/${roomId}/blocks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: roomId }) },
  );

const deleteBlockRequest = (
  roomId: string,
  blockId: string,
  cookie?: string,
) =>
  blockDELETE(
    new Request(`http://localhost/api/rooms/${roomId}/blocks/${blockId}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ id: roomId, blockId }) },
  );

const availabilityRequest = (params: Record<string, string>) =>
  availabilityGET(
    new Request(
      `http://localhost/api/rooms/availability?${new URLSearchParams(params)}`,
    ),
  );

beforeAll(async () => {
  await resetDatabase();

  admin = await createActor("Admin Ruangan", "ruangan-admin@example.test", "ADMIN");
  managerA = await createActor(
    "Pengelola A",
    "ruangan-a@example.test",
    "PENGELOLA",
  );
  managerB = await createActor(
    "Pengelola B",
    "ruangan-b@example.test",
    "PENGELOLA",
  );
  borrower = await createActor(
    "Peminjam Ruangan",
    "ruangan-peminjam@example.test",
    "PEMINJAM",
  );

  const createRoom = async (data: {
    name: string;
    building: string;
    floor: string;
    capacity: number;
    roomType: string;
    openTime: string;
    closeTime: string;
    active?: boolean;
  }) =>
    db.room.create({
      data: {
        ...data,
        requiresApproval: true,
        maxDurationMinutes: 180,
      },
    });

  roomA = await createRoom({
    name: "Ruang Rapat A",
    building: "Gedung Uji",
    floor: "1",
    capacity: 20,
    roomType: "rapat",
    openTime: "08:00",
    closeTime: "17:00",
  });
  roomB = await createRoom({
    name: "Studio B",
    building: "Gedung Uji",
    floor: "2",
    capacity: 40,
    roomType: "studio",
    openTime: "08:00",
    closeTime: "21:00",
  });
  roomC = await createRoom({
    name: "Ruang Kecil C",
    building: "Gedung Uji",
    floor: "3",
    capacity: 5,
    roomType: "diskusi",
    openTime: "08:00",
    closeTime: "16:00",
  });
  roomD = await createRoom({
    name: "Ruang Nonaktif D",
    building: "Gedung Uji",
    floor: "4",
    capacity: 30,
    roomType: "rapat",
    openTime: "08:00",
    closeTime: "17:00",
    active: false,
  });

  await db.roomManager.createMany({
    data: [
      { roomId: roomA.id, userId: managerA.id },
      { roomId: roomC.id, userId: managerA.id },
      { roomId: roomB.id, userId: managerB.id },
      { roomId: roomD.id, userId: managerA.id },
    ],
  });
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("RU-02 daftar dan pencarian ruangan", () => {
  it("hanya mengembalikan ruangan aktif dan memfilter kapasitas serta jenis", async () => {
    const all = await roomsGET(new Request("http://localhost/api/rooms"));
    const allBody = await all.json();

    expect(all.status).toBe(200);
    expect(allBody.rooms.map((room: { name: string }) => room.name)).toEqual([
      "Ruang Kecil C",
      "Ruang Rapat A",
      "Studio B",
    ]);

    const filtered = await roomsGET(
      new Request(
        "http://localhost/api/rooms?capacity=20&type=rapat",
      ),
    );
    const filteredBody = await filtered.json();

    expect(filteredBody.rooms).toHaveLength(1);
    expect(filteredBody.rooms[0].name).toBe("Ruang Rapat A");
  });

  it("hanya mengembalikan ruangan kosong pada rentang waktu", async () => {
    const response = await availabilityRequest({
      start: at("09:00").toISOString(),
      end: at("10:00").toISOString(),
      capacity: "10",
      type: "rapat",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rooms.map((room: { name: string }) => room.name)).toEqual([
      "Ruang Rapat A",
    ]);
  });

  it("mengecualikan ruangan di luar jam operasional", async () => {
    const response = await availabilityRequest({
      start: at("18:00").toISOString(),
      end: at("19:00").toISOString(),
    });
    const body = await response.json();

    expect(body.rooms.map((room: { name: string }) => room.name)).toEqual([
      "Studio B",
    ]);
  });

  it("menolak rentang waktu yang tidak valid", async () => {
    const response = await availabilityRequest({
      start: at("10:00").toISOString(),
      end: at("10:00").toISOString(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
  });
});

describe("RU-04 / AC-RU-01 blokir slot", () => {
  it("menyembunyikan slot yang diblokir dari pencarian", async () => {
    const created = await blockRequest(
      roomA.id,
      {
        start: at("09:00").toISOString(),
        end: at("10:00").toISOString(),
        reason: "Perawatan sintetis",
      },
      managerA.cookie,
    );

    expect(created.status).toBe(201);
    const createdBody = await created.json();

    const search = await availabilityRequest({
      start: at("09:00").toISOString(),
      end: at("10:00").toISOString(),
      capacity: "10",
      type: "rapat",
    });
    const searchBody = await search.json();

    expect(searchBody.rooms).toEqual([]);

    const deleted = await deleteBlockRequest(
      roomA.id,
      createdBody.block.id,
      managerA.cookie,
    );
    expect(deleted.status).toBe(200);

    const restored = await availabilityRequest({
      start: at("09:00").toISOString(),
      end: at("10:00").toISOString(),
      capacity: "10",
      type: "rapat",
    });
    const restoredBody = await restored.json();

    expect(restoredBody.rooms.map((room: { name: string }) => room.name)).toEqual(
      ["Ruang Rapat A"],
    );
  });

  it("menyembunyikan ruangan yang punya reservasi aktif", async () => {
    await db.reservation.create({
      data: {
        userId: borrower.id,
        roomId: roomA.id,
        start: at("13:00"),
        end: at("14:00"),
        type: "PRIBADI",
        activityName: "Kegiatan Ruangan Sintetis",
        participantCount: 5,
        status: "TERKONFIRMASI",
        idempotencyKey: `ruangan-${randomBytes(8).toString("hex")}`,
      },
    });

    const response = await availabilityRequest({
      start: at("13:30").toISOString(),
      end: at("14:30").toISOString(),
      capacity: "10",
      type: "rapat",
    });
    const body = await response.json();

    expect(body.rooms).toEqual([]);
  });

  it("menolak blokir yang beririsan dengan reservasi aktif", async () => {
    const response = await blockRequest(
      roomA.id,
      {
        start: at("13:30").toISOString(),
        end: at("14:30").toISOString(),
        reason: "Bentrok sintetis",
      },
      managerA.cookie,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "SLOT_CONFLICT" },
    });
  });

  it("menolak blokir tanpa alasan dan rentang terbalik", async () => {
    const noReason = await blockRequest(
      roomA.id,
      {
        start: at("15:00").toISOString(),
        end: at("16:00").toISOString(),
        reason: "   ",
      },
      managerA.cookie,
    );

    expect(noReason.status).toBe(400);
    expect(await noReason.json()).toMatchObject({
      error: {
        code: "INVALID_INPUT",
        fields: [expect.objectContaining({ field: "reason" })],
      },
    });

    const reversed = await blockRequest(
      roomA.id,
      {
        start: at("16:00").toISOString(),
        end: at("15:00").toISOString(),
        reason: "Terbalik",
      },
      managerA.cookie,
    );

    expect(reversed.status).toBe(400);
  });
});

describe("otorisasi pengelolaan ruangan", () => {
  it("mengizinkan pengelola mengubah ruangan miliknya dan menolak pengelola lain", async () => {
    const own = await patchRequest(
      roomA.id,
      { capacity: 25, roomType: "RAPAT" },
      managerA.cookie,
    );

    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(ownBody.room.capacity).toBe(25);
    expect(ownBody.room.roomType).toBe("rapat");

    const other = await patchRequest(
      roomA.id,
      { capacity: 30 },
      managerB.cookie,
    );

    expect(other.status).toBe(403);
    expect(await other.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("menolak peminjam dan pengguna anonim mengubah ruangan", async () => {
    const borrowerResponse = await patchRequest(
      roomA.id,
      { capacity: 30 },
      borrower.cookie,
    );
    expect(borrowerResponse.status).toBe(403);

    const anonymous = await patchRequest(roomA.id, { capacity: 30 });
    expect(anonymous.status).toBe(401);
  });

  it("mengizinkan admin mengelola ruangan mana pun", async () => {
    const response = await patchRequest(
      roomB.id,
      { maxDurationMinutes: 240 },
      admin.cookie,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).room.maxDurationMinutes).toBe(240);
  });

  it("menolak peminjam dan pengelola lain membuat blokir", async () => {
    const borrowerResponse = await blockRequest(
      roomA.id,
      {
        start: at("11:00").toISOString(),
        end: at("12:00").toISOString(),
        reason: "Tidak berhak",
      },
      borrower.cookie,
    );
    expect(borrowerResponse.status).toBe(403);

    const otherManager = await blockRequest(
      roomA.id,
      {
        start: at("11:00").toISOString(),
        end: at("12:00").toISOString(),
        reason: "Bukan ruangannya",
      },
      managerB.cookie,
    );
    expect(otherManager.status).toBe(403);
  });

  it("menolak pengelola lain menghapus blokir", async () => {
    const created = await blockRequest(
      roomA.id,
      {
        start: at("15:00").toISOString(),
        end: at("16:00").toISOString(),
        reason: "Blokir kepemilikan",
      },
      managerA.cookie,
    );
    const createdBody = await created.json();

    const response = await deleteBlockRequest(
      roomA.id,
      createdBody.block.id,
      managerB.cookie,
    );

    expect(response.status).toBe(403);

    const cleanup = await deleteBlockRequest(
      roomA.id,
      createdBody.block.id,
      managerA.cookie,
    );
    expect(cleanup.status).toBe(200);
  });

  it("menolak perubahan ruangan yang tidak valid", async () => {
    const response = await patchRequest(
      roomA.id,
      { capacity: 0 },
      managerA.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_INPUT",
        fields: [expect.objectContaining({ field: "capacity" })],
      },
    });
  });
});
