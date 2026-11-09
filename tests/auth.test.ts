import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as loginPOST } from "../app/api/auth/login/route";
import { POST as logoutPOST } from "../app/api/auth/logout/route";
import { POST as reservationPOST } from "../app/api/reservations/route";
import { hashPassword } from "@/lib/auth/password";
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

type Fixture = {
  id: string;
  email: string;
  password: string;
};

let borrower: Fixture;
let manager: Fixture;
let admin: Fixture;
let roomId: string;

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

const createFixtureUser = async (
  name: string,
  email: string,
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN",
): Promise<Fixture> => {
  const password = randomBytes(18).toString("base64url");
  const user = await db.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
    },
  });

  return { id: user.id, email, password };
};

const login = (email: string, password: string) =>
  loginPOST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );

const cookieFrom = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  return setCookie?.split(";")[0] ?? "";
};

const tokenFromCookie = (cookie: string): string =>
  cookie.startsWith("ruangidb_session=")
    ? cookie.slice("ruangidb_session=".length)
    : "";

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const reservationBody = (overrides: Record<string, unknown> = {}) => ({
  roomId,
  start: at("09:00").toISOString(),
  end: at("10:00").toISOString(),
  type: "PRIBADI",
  activityName: "Kegiatan Autentikasi Sintetis",
  participantCount: 5,
  idempotencyKey: `auth-${randomBytes(8).toString("hex")}`,
  ...overrides,
});

const postReservation = (body: unknown, cookie?: string) =>
  reservationPOST(
    new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  await resetDatabase();

  borrower = await createFixtureUser(
    "Peminjam Auth Sintetis",
    "auth-peminjam@example.test",
    "PEMINJAM",
  );
  manager = await createFixtureUser(
    "Pengelola Auth Sintetis",
    "auth-pengelola@example.test",
    "PENGELOLA",
  );
  admin = await createFixtureUser(
    "Admin Auth Sintetis",
    "auth-admin@example.test",
    "ADMIN",
  );

  const room = await db.room.create({
    data: {
      name: "Ruang Auth Sintetis",
      building: "Gedung Uji",
      floor: "1",
      capacity: 20,
      openTime: "08:00",
      closeTime: "17:00",
      requiresApproval: false,
      maxDurationMinutes: 180,
    },
  });
  roomId = room.id;
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("AK-01 / AC-AK-01 akses reservasi", () => {
  it("menolak pengguna anonim", async () => {
    const response = await postReservation(reservationBody());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(await db.reservation.count()).toBe(0);
  });

  it("menerima peminjam yang login dan mengabaikan userId dari body", async () => {
    const loginResponse = await login(borrower.email, borrower.password);
    expect(loginResponse.status).toBe(200);

    const loginBody = await loginResponse.json();
    expect(loginBody.user.email).toBe(borrower.email);
    expect(JSON.stringify(loginBody)).not.toContain(borrower.password);
    expect(JSON.stringify(loginBody)).not.toContain("passwordHash");

    const cookie = cookieFrom(loginResponse);
    expect(cookie.startsWith("ruangidb_session=")).toBe(true);

    const token = tokenFromCookie(cookie);
    const session = await db.session.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });

    expect(session.tokenHash).not.toBe(token);
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const response = await postReservation(
      reservationBody({ userId: admin.id }),
      cookie,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.reservation.userId).toBe(borrower.id);
  });

  it("menolak peran pengelola dan admin pada endpoint peminjam", async () => {
    for (const fixture of [manager, admin]) {
      const loginResponse = await login(fixture.email, fixture.password);
      expect(loginResponse.status).toBe(200);

      const response = await postReservation(
        reservationBody(),
        cookieFrom(loginResponse),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
    }
  });
});

describe("AK-04 logout mencabut sesi", () => {
  it("menolak cookie lama setelah logout", async () => {
    const loginResponse = await login(borrower.email, borrower.password);
    const cookie = cookieFrom(loginResponse);
    const token = tokenFromCookie(cookie);

    const logoutResponse = await logoutPOST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie },
      }),
    );

    expect(logoutResponse.status).toBe(200);

    const session = await db.session.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });

    expect(session.tokenHash).not.toBe(token);
    expect(session.revokedAt).not.toBeNull();

    const response = await postReservation(reservationBody(), cookie);
    expect(response.status).toBe(401);
  });
});

describe("AK-03 pembatasan percobaan login", () => {
  it("mengunci setelah lima kegagalan", async () => {
    const fixture = await createFixtureUser(
      "Peminjam Throttle Sintetis",
      "auth-throttle@example.test",
      "PEMINJAM",
    );

    const wrongPassword = randomBytes(18).toString("base64url");

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await login(fixture.email, wrongPassword);
      expect(response.status).toBe(401);
    }

    const fifth = await login(fixture.email, wrongPassword);
    expect(fifth.status).toBe(429);
    expect(Number(fifth.headers.get("retry-after"))).toBeGreaterThan(0);

    const correct = await login(fixture.email, fixture.password);
    expect(correct.status).toBe(429);
  });

  it("tidak membocorkan password pada respons atau log", async () => {
    const fixture = await createFixtureUser(
      "Peminjam Log Sintetis",
      "auth-log@example.test",
      "PEMINJAM",
    );
    const attemptedPassword = `salah-${randomBytes(12).toString("hex")}`;
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
    ];

    try {
      const response = await login(fixture.email, attemptedPassword);
      const text = await response.text();

      expect(response.status).toBe(401);
      expect(text).not.toContain(attemptedPassword);
      expect(text).not.toContain("passwordHash");

      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain(attemptedPassword);
        }
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });
});
