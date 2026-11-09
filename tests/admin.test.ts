import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as usersGET } from "../app/api/admin/users/route";
import { PATCH as userPATCH } from "../app/api/admin/users/[id]/route";
import { POST as managerPOST } from "../app/api/admin/rooms/[id]/managers/route";
import { DELETE as managerDELETE } from "../app/api/admin/rooms/[id]/managers/[userId]/route";
import { GET as reservationsGET } from "../app/api/reservations/route";
import { createSession } from "@/lib/auth/session";

const db = new PrismaClient();

type Actor = {
  id: string;
  cookie: string;
};

let admin: Actor;
let manager: Actor;
let borrower: Actor;
let target: { id: string };
let deactivateTarget: { id: string };
let inactiveManager: { id: string };
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

const patchUser = (id: string, body: unknown, cookie?: string) =>
  userPATCH(
    new Request(`http://localhost/api/admin/users/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const assignManager = (roomId: string, body: unknown, cookie?: string) =>
  managerPOST(
    new Request(`http://localhost/api/admin/rooms/${roomId}/managers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: roomId }) },
  );

const removeManager = (roomId: string, userId: string, cookie?: string) =>
  managerDELETE(
    new Request(
      `http://localhost/api/admin/rooms/${roomId}/managers/${userId}`,
      {
        method: "DELETE",
        headers: cookie ? { cookie } : {},
      },
    ),
    { params: Promise.resolve({ id: roomId, userId }) },
  );

beforeAll(async () => {
  await resetDatabase();

  admin = await createActor("Admin Akun", "admin-akun@example.test", "ADMIN");
  manager = await createActor(
    "Pengelola Akun",
    "pengelola-akun@example.test",
    "PENGELOLA",
  );
  borrower = await createActor(
    "Peminjam Akun",
    "peminjam-akun@example.test",
    "PEMINJAM",
  );

  target = await db.user.create({
    data: {
      name: "Target Peran",
      email: "target-peran@example.test",
      role: "PEMINJAM",
    },
  });

  deactivateTarget = await db.user.create({
    data: {
      name: "Target Nonaktif",
      email: "target-nonaktif@example.test",
      role: "PEMINJAM",
    },
  });

  inactiveManager = await db.user.create({
    data: {
      name: "Pengelola Nonaktif",
      email: "pengelola-nonaktif@example.test",
      role: "PENGELOLA",
      active: false,
    },
  });

  room = await db.room.create({
    data: {
      name: "Ruang Admin",
      building: "Gedung Uji",
      floor: "1",
      capacity: 10,
      openTime: "08:00",
      closeTime: "17:00",
    },
  });
});

beforeEach(async () => {
  await db.auditLog.deleteMany();
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("AD-01 manajemen akun dan peran", () => {
  it("menampilkan pengguna untuk admin tanpa data password", async () => {
    const response = await usersGET(
      new Request("http://localhost/api/admin/users", {
        headers: { cookie: admin.cookie },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("mengubah peran dan mencatat audit log", async () => {
    const response = await patchUser(
      target.id,
      { role: "PENGELOLA" },
      admin.cookie,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).user.role).toBe("PENGELOLA");

    const audit = await db.auditLog.findFirstOrThrow({
      where: {
        action: "USER_UPDATED",
        entity: "User",
        entityId: target.id,
      },
    });

    expect(audit.actorId).toBe(admin.id);
    expect(audit.metadata).toContain('"before"');
    expect(audit.metadata).toContain('"after"');
  });

  it("menolak non-admin, anonim, dan peran tidak valid", async () => {
    const nonAdmin = await patchUser(
      target.id,
      { active: false },
      manager.cookie,
    );
    expect(nonAdmin.status).toBe(403);

    const anonymous = await patchUser(target.id, { active: false });
    expect(anonymous.status).toBe(401);

    const invalid = await patchUser(
      target.id,
      { role: "SUPERUSER" },
      admin.cookie,
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: {
        code: "INVALID_INPUT",
        fields: [expect.objectContaining({ field: "role" })],
      },
    });
  });

  it("menolak mengubah pengguna tanpa perubahan", async () => {
    const response = await patchUser(target.id, {}, admin.cookie);

    expect(response.status).toBe(400);
  });

  it("menonaktifkan akun, mencatat audit log, dan mencabut akses sesi", async () => {
    const session = await createSession(deactivateTarget.id, { db });
    const cookie = `ruangidb_session=${session.token}`;

    const response = await patchUser(
      deactivateTarget.id,
      { active: false },
      admin.cookie,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).user.active).toBe(false);

    const audit = await db.auditLog.findFirstOrThrow({
      where: {
        action: "USER_UPDATED",
        entity: "User",
        entityId: deactivateTarget.id,
      },
    });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.metadata).toContain('"active":true');
    expect(audit.metadata).toContain('"active":false');

    const after = await reservationsGET(
      new Request("http://localhost/api/reservations", {
        headers: { cookie },
      }),
    );
    expect(after.status).toBe(401);
  });
});

describe("AD-01 penugasan pengelola ruangan", () => {
  it("menugaskan dan melepas pengelola dengan audit log", async () => {
    const assigned = await assignManager(
      room.id,
      { userId: manager.id },
      admin.cookie,
    );

    expect(assigned.status).toBe(201);

    const assignmentAudit = await db.auditLog.findFirstOrThrow({
      where: { action: "ROOM_MANAGER_ASSIGNED", entityId: room.id },
    });
    expect(assignmentAudit.actorId).toBe(admin.id);

    const removed = await removeManager(room.id, manager.id, admin.cookie);
    expect(removed.status).toBe(200);

    const removalAudit = await db.auditLog.findFirstOrThrow({
      where: { action: "ROOM_MANAGER_REMOVED", entityId: room.id },
    });
    expect(removalAudit.actorId).toBe(admin.id);

    const remaining = await db.roomManager.count({
      where: { roomId: room.id, userId: manager.id },
    });
    expect(remaining).toBe(0);
  });

  it("menolak menugaskan pengguna yang bukan pengelola", async () => {
    const response = await assignManager(
      room.id,
      { userId: borrower.id },
      admin.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
  });

  it("menolak menugaskan pengelola nonaktif", async () => {
    const response = await assignManager(
      room.id,
      { userId: inactiveManager.id },
      admin.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });

    const assignments = await db.roomManager.count({
      where: { roomId: room.id, userId: inactiveManager.id },
    });
    expect(assignments).toBe(0);
  });

  it("menolak penugasan oleh non-admin", async () => {
    const response = await assignManager(
      room.id,
      { userId: manager.id },
      manager.cookie,
    );

    expect(response.status).toBe(403);
  });
});
