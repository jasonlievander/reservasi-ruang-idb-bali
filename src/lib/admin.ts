import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { prisma as defaultDb } from "@/lib/prisma";

const ROLES: Role[] = ["PEMINJAM", "PENGELOLA", "ADMIN"];

export type AdminErrorCode =
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "USER_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "MANAGER_NOT_FOUND";

export const adminErrorStatus: Record<AdminErrorCode, number> = {
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  USER_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  MANAGER_NOT_FOUND: 404,
};

type FieldIssue = {
  field: string;
  code: string;
  message: string;
};

export class AdminError extends Error {
  readonly code: AdminErrorCode;
  readonly fieldErrors: FieldIssue[];

  constructor(
    code: AdminErrorCode,
    message: string,
    fieldErrors: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "AdminError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type AdminActor = {
  id: string;
  role: "PEMINJAM" | "PENGELOLA" | "ADMIN";
};

export type UpdateUserInput = {
  role?: Role;
  active?: boolean;
};

type AdminOptions = {
  db?: PrismaClient;
};

const assertAdmin = (actor: AdminActor) => {
  if (actor.role !== "ADMIN") {
    throw new AdminError(
      "FORBIDDEN",
      "Hanya admin yang dapat melakukan tindakan ini.",
    );
  }
};

const writeAudit = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  metadata: unknown,
) => {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      metadata: JSON.stringify(metadata),
    },
  });
};

export async function listUsers(
  actor: AdminActor,
  options: AdminOptions = {},
) {
  assertAdmin(actor);
  const db = options.db ?? defaultDb;

  return db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  actor: AdminActor,
  options: AdminOptions = {},
) {
  assertAdmin(actor);

  if (input.role !== undefined && !ROLES.includes(input.role)) {
    throw new AdminError(
      "INVALID_INPUT",
      "Peran tidak valid.",
      [
        {
          field: "role",
          code: "INVALID",
          message: "Peran harus peminjam, pengelola, atau admin.",
        },
      ],
    );
  }

  if (input.active !== undefined && typeof input.active !== "boolean") {
    throw new AdminError(
      "INVALID_INPUT",
      "Status aktif tidak valid.",
      [
        {
          field: "active",
          code: "INVALID",
          message: "Status aktif harus boolean.",
        },
      ],
    );
  }

  if (input.role === undefined && input.active === undefined) {
    throw new AdminError("INVALID_INPUT", "Tidak ada perubahan yang dikirim.");
  }

  const db = options.db ?? defaultDb;

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AdminError("USER_NOT_FOUND", "Pengguna tidak ditemukan.");
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    await writeAudit(tx, actor.id, "USER_UPDATED", "User", user.id, {
      before: { role: user.role, active: user.active },
      after: { role: updated.role, active: updated.active },
    });

    return updated;
  });
}

export async function assignRoomManager(
  roomId: string,
  userId: string,
  actor: AdminActor,
  options: AdminOptions = {},
) {
  assertAdmin(actor);
  const db = options.db ?? defaultDb;

  return db.$transaction(async (tx) => {
    const [room, user, existing] = await Promise.all([
      tx.room.findUnique({ where: { id: roomId }, select: { id: true } }),
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, active: true },
      }),
      tx.roomManager.findUnique({
        where: { roomId_userId: { roomId, userId } },
      }),
    ]);

    if (!room) {
      throw new AdminError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
    }

    if (!user) {
      throw new AdminError("USER_NOT_FOUND", "Pengguna tidak ditemukan.");
    }

    if (user.role !== "PENGELOLA") {
      throw new AdminError(
        "INVALID_INPUT",
        "Pengguna yang ditugaskan harus berperan pengelola.",
      );
    }

    if (!user.active) {
      throw new AdminError(
        "INVALID_INPUT",
        "Pengguna nonaktif tidak dapat ditugaskan sebagai pengelola.",
      );
    }

    if (existing) {
      return existing;
    }

    const assignment = await tx.roomManager.create({
      data: { roomId, userId },
    });

    await writeAudit(tx, actor.id, "ROOM_MANAGER_ASSIGNED", "Room", roomId, {
      userId,
    });

    return assignment;
  });
}

export async function removeRoomManager(
  roomId: string,
  userId: string,
  actor: AdminActor,
  options: AdminOptions = {},
) {
  assertAdmin(actor);
  const db = options.db ?? defaultDb;

  return db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });

    if (!room) {
      throw new AdminError("ROOM_NOT_FOUND", "Ruangan tidak ditemukan.");
    }

    const removed = await tx.roomManager.deleteMany({
      where: { roomId, userId },
    });

    if (removed.count === 0) {
      throw new AdminError(
        "MANAGER_NOT_FOUND",
        "Penugasan pengelola tidak ditemukan.",
      );
    }

    await writeAudit(tx, actor.id, "ROOM_MANAGER_REMOVED", "Room", roomId, {
      userId,
    });

    return { ok: true };
  });
}
