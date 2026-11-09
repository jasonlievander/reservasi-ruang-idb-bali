import { ORGANIZATION_CATALOG } from "@/lib/organizations";

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const COMPOUND_KEYS: Record<string, string[]> = {
  userId_idempotencyKey: ["userId", "idempotencyKey"],
  roomId_userId: ["roomId", "userId"],
  userId_organizationId: ["userId", "organizationId"],
  name_building_floor: ["name", "building", "floor"],
};

type Relation = {
  model: string;
  many: boolean;
  foreignKey: string;
};

const RELATIONS: Record<string, Record<string, Relation>> = {
  User: {
    memberships: { model: "OrganizationMember", many: true, foreignKey: "userId" },
    managedRooms: { model: "RoomManager", many: true, foreignKey: "userId" },
    reservations: { model: "Reservation", many: true, foreignKey: "userId" },
    blocksCreated: { model: "SlotBlock", many: true, foreignKey: "createdById" },
    statusChanges: { model: "StatusHistory", many: true, foreignKey: "actorId" },
    notifications: { model: "Notification", many: true, foreignKey: "recipientId" },
    sessions: { model: "Session", many: true, foreignKey: "userId" },
    auditLogs: { model: "AuditLog", many: true, foreignKey: "actorId" },
  },
  Organization: {
    memberships: { model: "OrganizationMember", many: true, foreignKey: "organizationId" },
    reservations: { model: "Reservation", many: true, foreignKey: "organizationId" },
  },
  OrganizationMember: {
    user: { model: "User", many: false, foreignKey: "userId" },
    organization: { model: "Organization", many: false, foreignKey: "organizationId" },
  },
  Room: {
    managers: { model: "RoomManager", many: true, foreignKey: "roomId" },
    reservations: { model: "Reservation", many: true, foreignKey: "roomId" },
    blocks: { model: "SlotBlock", many: true, foreignKey: "roomId" },
  },
  RoomManager: {
    room: { model: "Room", many: false, foreignKey: "roomId" },
    user: { model: "User", many: false, foreignKey: "userId" },
  },
  Reservation: {
    user: { model: "User", many: false, foreignKey: "userId" },
    room: { model: "Room", many: false, foreignKey: "roomId" },
    organization: { model: "Organization", many: false, foreignKey: "organizationId" },
    history: { model: "StatusHistory", many: true, foreignKey: "reservationId" },
    notifications: { model: "Notification", many: true, foreignKey: "reservationId" },
  },
  SlotBlock: {
    room: { model: "Room", many: false, foreignKey: "roomId" },
    createdBy: { model: "User", many: false, foreignKey: "createdById" },
  },
  StatusHistory: {
    reservation: { model: "Reservation", many: false, foreignKey: "reservationId" },
    actor: { model: "User", many: false, foreignKey: "actorId" },
  },
  Notification: {
    recipient: { model: "User", many: false, foreignKey: "recipientId" },
    reservation: { model: "Reservation", many: false, foreignKey: "reservationId" },
  },
  Session: {
    user: { model: "User", many: false, foreignKey: "userId" },
  },
  AuditLog: {
    actor: { model: "User", many: false, foreignKey: "actorId" },
  },
};

const HAS_CREATED_AT = new Set([
  "User",
  "Organization",
  "OrganizationMember",
  "Room",
  "RoomManager",
  "Reservation",
  "SlotBlock",
  "StatusHistory",
  "Notification",
  "Session",
  "AuditLog",
]);

const HAS_UPDATED_AT = new Set(["User", "Room", "Reservation", "SystemConfig"]);

const DEFAULT_VALUES: Record<string, Row> = {
  User: { passwordHash: null, role: "PEMINJAM", active: true },
  Organization: { category: "UKM", advisor: null },
  OrganizationMember: { role: "ANGGOTA" },
  Room: {
    facilities: "[]",
    roomType: "serbaguna",
    photoUrl: null,
    requiresApproval: true,
    maxDurationMinutes: 120,
    cancellationDeadlineMinutes: 0,
    attachmentRequired: false,
    active: true,
  },
  Reservation: {
    organizationId: null,
    status: "MENUNGGU_PERSETUJUAN",
    attachmentUrl: null,
  },
  SlotBlock: {},
  StatusHistory: { oldStatus: null, actorId: null, reason: null },
  Notification: { reservationId: null, deliveryStatus: "PENDING" },
  SystemConfig: { maxActiveReservations: 3, maxAdvanceDays: 30 },
  Session: { revokedAt: null },
  LoginThrottle: { failedCount: 0, lockedUntil: null },
  AuditLog: { metadata: null },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const sameValue = (left: unknown, right: unknown): boolean => {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  return left === right;
};

const compareValues = (left: unknown, right: unknown): number => {
  const a = left instanceof Date ? left.getTime() : left;
  const b = right instanceof Date ? right.getTime() : right;
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
};

const matchField = (value: unknown, condition: unknown): boolean => {
  if (condition instanceof Date) {
    return value instanceof Date && value.getTime() === condition.getTime();
  }

  if (Array.isArray(condition)) {
    return condition.some((item) => sameValue(value, item));
  }

  if (!isPlainObject(condition)) {
    return sameValue(value, condition);
  }

  for (const [operator, expected] of Object.entries(condition)) {
    switch (operator) {
      case "equals":
        if (!sameValue(value, expected)) return false;
        break;
      case "not":
        if (isPlainObject(expected)) {
          if (matchField(value, expected)) return false;
        } else if (sameValue(value, expected)) {
          return false;
        }
        break;
      case "in":
        if (!Array.isArray(expected) || !expected.some((item) => sameValue(value, item))) {
          return false;
        }
        break;
      case "notIn":
        if (Array.isArray(expected) && expected.some((item) => sameValue(value, item))) {
          return false;
        }
        break;
      case "lt":
        if (!(compareValues(value, expected) < 0)) return false;
        break;
      case "lte":
        if (!(compareValues(value, expected) <= 0)) return false;
        break;
      case "gt":
        if (!(compareValues(value, expected) > 0)) return false;
        break;
      case "gte":
        if (!(compareValues(value, expected) >= 0)) return false;
        break;
      case "startsWith":
        if (typeof value !== "string" || !value.startsWith(String(expected))) {
          return false;
        }
        break;
      case "endsWith":
        if (typeof value !== "string" || !value.endsWith(String(expected))) {
          return false;
        }
        break;
      case "contains":
        if (typeof value !== "string" || !value.includes(String(expected))) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  return true;
};

const resolveRelation = (
  model: string,
  record: Row,
  relationName: string,
  store: Store,
): Row | Row[] | null => {
  const relation = RELATIONS[model]?.[relationName];
  if (!relation) {
    return null;
  }

  const foreignValue = record[relation.foreignKey];
  const targetRows = store[relation.model] ?? [];

  if (relation.many) {
    return targetRows.filter((row) => sameValue(row[relation.foreignKey], foreignValue));
  }

  if (foreignValue === null || foreignValue === undefined) {
    return null;
  }

  return targetRows.find((row) => sameValue(row.id, foreignValue)) ?? null;
};

const matchesWhere = (
  model: string,
  record: Row,
  where: Record<string, unknown> | undefined,
  store: Store,
): boolean => {
  if (!where) {
    return true;
  }

  for (const [rawKey, condition] of Object.entries(where)) {
    if (condition === undefined) {
      continue;
    }

    const compound = COMPOUND_KEYS[rawKey];
    if (compound && isPlainObject(condition)) {
      if (!matchesWhere(model, record, condition, store)) {
        return false;
      }
      continue;
    }

    if (RELATIONS[model]?.[rawKey] && isPlainObject(condition)) {
      const related = resolveRelation(model, record, rawKey, store);
      const relation = RELATIONS[model][rawKey];

      if ("some" in condition) {
        const some = condition.some as Record<string, unknown>;
        if (!Array.isArray(related)) {
          return false;
        }
        if (!related.some((row) => matchesWhere(relation.model, row, some, store))) {
          return false;
        }
        continue;
      }

      if ("every" in condition && Array.isArray(related)) {
        const every = condition.every as Record<string, unknown>;
        if (!related.every((row) => matchesWhere(relation.model, row, every, store))) {
          return false;
        }
        continue;
      }

      if (related === null) {
        return false;
      }
      if (Array.isArray(related)) {
        if (!related.some((row) => matchesWhere(relation.model, row, condition, store))) {
          return false;
        }
      } else if (!matchesWhere(relation.model, related, condition, store)) {
        return false;
      }
      continue;
    }

    if (!matchField(record[rawKey], condition)) {
      return false;
    }
  }

  return true;
};

const sortRows = (rows: Row[], orderBy: unknown): Row[] => {
  const entries: Array<[string, "asc" | "desc"]> = [];

  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (isPlainObject(value)) {
      for (const [field, direction] of Object.entries(value)) {
        entries.push([field, direction === "desc" ? "desc" : "asc"]);
      }
    }
  };

  collect(orderBy);

  if (entries.length === 0) {
    return rows;
  }

  return [...rows].sort((a, b) => {
    for (const [field, direction] of entries) {
      const result = compareValues(a[field], b[field]);
      if (result !== 0) {
        return direction === "desc" ? -result : result;
      }
    }
    return 0;
  });
};

const projectRow = (
  model: string,
  record: Row,
  args: Record<string, unknown> | true | undefined,
  store: Store,
): Row => {
  if (!args || args === true) {
    return { ...record };
  }

  const select = args.select as Record<string, unknown> | undefined;

  if (select) {
    const output: Row = {};
    for (const [key, value] of Object.entries(select)) {
      if (value === true || value === undefined) {
        output[key] = record[key];
        continue;
      }

      const relation = RELATIONS[model]?.[key];
      if (!relation) {
        output[key] = record[key];
        continue;
      }

      const related = resolveRelation(model, record, key, store);
      if (related === null) {
        output[key] = null;
      } else if (Array.isArray(related)) {
        output[key] = related.map((row) =>
          projectRow(relation.model, row, value as Record<string, unknown>, store),
        );
      } else {
        output[key] = projectRow(
          relation.model,
          related,
          value as Record<string, unknown>,
          store,
        );
      }
    }
    return output;
  }

  const output: Row = { ...record };
  const include = args.include as Record<string, unknown> | undefined;

  if (include) {
    for (const [key, value] of Object.entries(include)) {
      const relation = RELATIONS[model]?.[key];
      if (!relation) {
        continue;
      }

      const related = resolveRelation(model, record, key, store);
      const options = isPlainObject(value) ? value : undefined;

      if (related === null) {
        output[key] = null;
        continue;
      }

      if (Array.isArray(related)) {
        let items = related;
        if (options?.where && isPlainObject(options.where)) {
          items = items.filter((row) =>
            matchesWhere(relation.model, row, options.where as Record<string, unknown>, store),
          );
        }
        if (options?.orderBy) {
          items = sortRows(items, options.orderBy);
        }
        if (typeof options?.take === "number") {
          items = items.slice(0, options.take);
        }
        output[key] = items.map((row) => projectRow(relation.model, row, options, store));
      } else {
        output[key] = projectRow(relation.model, related, options, store);
      }
    }
  }

  return output;
};

const whereToScalars = (where: Record<string, unknown>): Row => {
  const data: Row = {};
  for (const [key, value] of Object.entries(where)) {
    const compound = COMPOUND_KEYS[key];
    if (compound && isPlainObject(value)) {
      Object.assign(data, value);
      continue;
    }
    if (isPlainObject(value)) {
      continue;
    }
    data[key] = value;
  }
  return data;
};

const generateId = () =>
  `c${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

const applyDefaults = (model: string, data: Row): Row => {
  const now = new Date();
  const record: Row = { ...data };

  if (!record.id) {
    record.id = generateId();
  }

  for (const [key, value] of Object.entries(DEFAULT_VALUES[model] ?? {})) {
    if (record[key] === undefined) {
      record[key] = value;
    }
  }

  if (HAS_CREATED_AT.has(model) && record.createdAt === undefined) {
    record.createdAt = now;
  }

  if (HAS_UPDATED_AT.has(model)) {
    record.updatedAt = now;
  }

  return record;
};

export const createDb = () => {
  const store = buildStore();

  const ensure = (model: string) => {
    if (!store[model]) {
      store[model] = [];
    }
    return store[model];
  };

  const findIndex = (model: string, where: Record<string, unknown>): number =>
    ensure(model).findIndex((row) => matchesWhere(model, row, where, store));

  const modelApi = (model: string) => ({
    async findMany(args: Record<string, unknown> = {}) {
      let rows = ensure(model).filter((row) =>
        matchesWhere(model, row, args.where as Record<string, unknown> | undefined, store),
      );
      if (args.orderBy) {
        rows = sortRows(rows, args.orderBy);
      }
      if (typeof args.skip === "number") {
        rows = rows.slice(args.skip);
      }
      if (typeof args.take === "number") {
        rows = rows.slice(0, args.take);
      }
      return rows.map((row) => projectRow(model, row, args, store));
    },
    async findFirst(args: Record<string, unknown> = {}) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
    async findUnique(args: Record<string, unknown> = {}) {
      const index = findIndex(model, (args.where ?? {}) as Record<string, unknown>);
      if (index < 0) {
        return null;
      }
      return projectRow(model, ensure(model)[index], args, store);
    },
    async findUniqueOrThrow(args: Record<string, unknown> = {}) {
      const result = await this.findUnique(args);
      if (!result) {
        throw prismaError("P2025", "Data tidak ditemukan.");
      }
      return result;
    },
    async create(args: Record<string, unknown> = {}) {
      const record = applyDefaults(model, { ...((args.data ?? {}) as Row) });
      ensure(model).push(record);
      return projectRow(model, record, args, store);
    },
    async update(args: Record<string, unknown> = {}) {
      const index = findIndex(model, (args.where ?? {}) as Record<string, unknown>);
      if (index < 0) {
        throw prismaError("P2025", "Data tidak ditemukan.");
      }
      const record = ensure(model)[index];
      Object.assign(record, (args.data ?? {}) as Row);
      if (HAS_UPDATED_AT.has(model)) {
        record.updatedAt = new Date();
      }
      return projectRow(model, record, args, store);
    },
    async updateMany(args: Record<string, unknown> = {}) {
      const rows = ensure(model).filter((row) =>
        matchesWhere(model, row, args.where as Record<string, unknown> | undefined, store),
      );
      for (const record of rows) {
        Object.assign(record, (args.data ?? {}) as Row);
        if (HAS_UPDATED_AT.has(model)) {
          record.updatedAt = new Date();
        }
      }
      return { count: rows.length };
    },
    async upsert(args: Record<string, unknown> = {}) {
      const where = (args.where ?? {}) as Record<string, unknown>;
      const index = findIndex(model, where);
      if (index >= 0) {
        const record = ensure(model)[index];
        Object.assign(record, whereToScalars(where), (args.update ?? {}) as Row);
        if (HAS_UPDATED_AT.has(model)) {
          record.updatedAt = new Date();
        }
        return projectRow(model, record, args, store);
      }
      const record = applyDefaults(model, {
        ...whereToScalars(where),
        ...((args.create ?? {}) as Row),
      });
      ensure(model).push(record);
      return projectRow(model, record, args, store);
    },
    async delete(args: Record<string, unknown> = {}) {
      const index = findIndex(model, (args.where ?? {}) as Record<string, unknown>);
      if (index < 0) {
        throw prismaError("P2025", "Data tidak ditemukan.");
      }
      const [record] = ensure(model).splice(index, 1);
      return projectRow(model, record, args, store);
    },
    async deleteMany(args: Record<string, unknown> = {}) {
      const rows = ensure(model);
      const remaining: Row[] = [];
      let count = 0;
      for (const row of rows) {
        if (
          matchesWhere(model, row, args.where as Record<string, unknown> | undefined, store)
        ) {
          count += 1;
        } else {
          remaining.push(row);
        }
      }
      store[model] = remaining;
      return { count };
    },
    async count(args: Record<string, unknown> = {}) {
      return ensure(model).filter((row) =>
        matchesWhere(model, row, args.where as Record<string, unknown> | undefined, store),
      ).length;
    },
  });

  const db: Record<string, unknown> = {
    user: modelApi("User"),
    organization: modelApi("Organization"),
    organizationMember: modelApi("OrganizationMember"),
    room: modelApi("Room"),
    roomManager: modelApi("RoomManager"),
    reservation: modelApi("Reservation"),
    slotBlock: modelApi("SlotBlock"),
    statusHistory: modelApi("StatusHistory"),
    notification: modelApi("Notification"),
    systemConfig: modelApi("SystemConfig"),
    session: modelApi("Session"),
    loginThrottle: modelApi("LoginThrottle"),
    auditLog: modelApi("AuditLog"),
    $disconnect: async () => undefined,
    $transaction: async (operation: unknown) => {
      if (typeof operation === "function") {
        const snapshot = structuredClone(store);
        try {
          return await (operation as (client: unknown) => Promise<unknown>)(db);
        } catch (error) {
          for (const key of Object.keys(store)) {
            delete store[key];
          }
          Object.assign(store, snapshot);
          throw error;
        }
      }
      return Promise.all(operation as Promise<unknown>[]);
    },
  };

  return db;
};

const prismaError = (code: string, message: string) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

const witaMidnight = (offsetDays: number) => {
  const shifted = new Date(Date.now() + 8 * 3_600_000);
  const day = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + offsetDays,
    ),
  );
  return new Date(day.getTime() - 8 * 3_600_000);
};

const witaTime = (day: Date, hour: number, minute = 0) =>
  new Date(day.getTime() + hour * 3_600_000 + minute * 60_000);

const PASSWORD_HASHES = {
  admin:
    "scrypt$16384$8$1$ac18906e1e4595d5b726f3a00217b6d2$51e0e877eacdbcd090f09d3ef815280b134a57880ba566ef56cbe0240a72425ef4c0d35abba3df96f25a2ee861a2d10d178bc7b7bc6c6518465980ff7d6e32a1",
  mahasiswa:
    "scrypt$16384$8$1$2665b89dd598de980a3de34541fb4842$b4a42f976d6f0d1f01b53bbd35cd043c0aad9729da80944a0edc6898c8822348dbcf02d9fd399933073d4b18b9b89f499ba94f194e8c909a28d2173450a24d7e",
  pengelola:
    "scrypt$16384$8$1$3e60eb1ea505bb9081d8844d7ac0e00a$141b29e0021fb2ce8011fed3947c84a295b2ba5c01067e554c610739746cc146f488d3eb40418d4278c0d3b656fc97742ea369fc43a17f250daa0c8b59c9add6",
  peminjam2:
    "scrypt$16384$8$1$2665b89dd598de980a3de34541fb4842$b4a42f976d6f0d1f01b53bbd35cd043c0aad9729da80944a0edc6898c8822348dbcf02d9fd399933073d4b18b9b89f499ba94f194e8c909a28d2173450a24d7e",
};

type RoomSeed = {
  name: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  roomType: string;
  photoUrl: string;
  openTime?: string;
  closeTime?: string;
  requiresApproval?: boolean;
  maxDurationMinutes?: number;
  cancellationDeadlineMinutes?: number;
  attachmentRequired?: boolean;
};

const ROOM_SEEDS: RoomSeed[] = [
  {
    name: "A.1.1 (Studio Pola)",
    building: "Gedung A",
    floor: "1",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/lab-fashion.jpg",
    facilities: ["meja potong", "mesin jahit", "AC", "papan pola"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
  {
    name: "A.1.2 (Lect 1A)",
    building: "Gedung A",
    floor: "1",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  },
  {
    name: "A.1.3 (Lab 1C)",
    building: "Gedung A",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-komputer.jpg",
    facilities: ["komputer", "AC", "proyektor"],
  },
  {
    name: "A.2.1 (Lab 2B)",
    building: "Gedung A",
    floor: "2",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-imac.jpg",
    facilities: ["iMac", "AC", "proyektor"],
  },
  {
    name: "A.2.3 (Lect 2D)",
    building: "Gedung A",
    floor: "2",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  },
  {
    name: "B.2.1 (International)",
    building: "Gedung B",
    floor: "2",
    capacity: 36,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-meeting.jpg",
    facilities: ["TV", "AC", "whiteboard", "meja rapat"],
    maxDurationMinutes: 180,
  },
  {
    name: "B.1.3 (Studio 3)",
    building: "Gedung B",
    floor: "1",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-gambar.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
  {
    name: "B.1.4 (Lab Fashion)",
    building: "Gedung B",
    floor: "1",
    capacity: 24,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-fashion.jpg",
    facilities: ["mesin jahit", "meja potong", "AC", "papan pola"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
  {
    name: "C.1.1 (Lab 1A)",
    building: "Gedung C",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-imac.jpg",
    facilities: ["iMac", "AC", "proyektor"],
  },
  {
    name: "C.1.2 (Lab STI)",
    building: "Gedung C",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-komputer.jpg",
    facilities: ["komputer", "AC", "proyektor"],
  },
  {
    name: "C.1.3 (Lect 1)",
    building: "Gedung C",
    floor: "1",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  },
  {
    name: "C.2.3 (Studio 2C)",
    building: "Gedung C",
    floor: "2",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-maket.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
  {
    name: "C.3.1 (Studio 3A)",
    building: "Gedung C",
    floor: "3",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-gambar.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
  {
    name: "AULA IDB BALI",
    building: "Gedung A",
    floor: "1",
    capacity: 200,
    roomType: "aula",
    photoUrl: "/rooms/aula.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  },
  {
    name: "STUDIO FOTO IDB BALI",
    building: "Gedung B",
    floor: "1",
    capacity: 20,
    roomType: "studio",
    photoUrl: "/rooms/studio-produksi.jpg",
    facilities: ["lampu studio", "backdrop", "AC", "kamera"],
    closeTime: "21:00",
    maxDurationMinutes: 180,
  },
  {
    name: "ROOFTOP IDB BALI",
    building: "Gedung B",
    floor: "Atap",
    capacity: 80,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "pemandangan kampus"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  },
  {
    name: "INBIS IDB BALI",
    building: "Gedung B",
    floor: "2",
    capacity: 40,
    roomType: "rapat",
    photoUrl: "/rooms/ruang-meeting.jpg",
    facilities: ["TV", "AC", "whiteboard", "meja rapat"],
    maxDurationMinutes: 180,
  },
  {
    name: "HALAMAN IDB BALI GEDUNG A",
    building: "Gedung A",
    floor: "Halaman",
    capacity: 100,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "parkir"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  },
  {
    name: "GEDUNG SERBA GUNA IDB BALI - Lt.1",
    building: "Gedung Serba Guna",
    floor: "1",
    capacity: 150,
    roomType: "serbaguna",
    photoUrl: "/rooms/serbaguna.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  },
  {
    name: "GEDUNG B (Gear inc)",
    building: "Gedung B",
    floor: "1",
    capacity: 40,
    roomType: "studio",
    photoUrl: "/rooms/creative-gallery.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "peralatan kreatif"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  },
];

const buildStore = (): Store => {
  const now = new Date();
  const users: Row[] = [
    {
      id: "user-admin",
      name: "Admin SIRU",
      email: "admin@idbbali.ac.id",
      passwordHash: PASSWORD_HASHES.admin,
      role: "ADMIN",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-mahasiswa",
      name: "Ayu Mahasiswa",
      email: "mahasiswa@idbbali.ac.id",
      passwordHash: PASSWORD_HASHES.mahasiswa,
      role: "PEMINJAM",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-pengelola",
      name: "Bagus Pengelola",
      email: "pengelola@idbbali.ac.id",
      passwordHash: PASSWORD_HASHES.pengelola,
      role: "PENGELOLA",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-mahasiswa-2",
      name: "Made Peminjam",
      email: "peminjam2@idbbali.ac.id",
      passwordHash: PASSWORD_HASHES.peminjam2,
      role: "PEMINJAM",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const organizationNames = [
    ...ORGANIZATION_CATALOG.map((entry) => entry),
    { name: "Lontar", category: "UKM" as const },
  ];

  const organizations: Row[] = [];
  const seenOrganizations = new Set<string>();
  for (const entry of organizationNames) {
    if (seenOrganizations.has(entry.name)) {
      continue;
    }
    seenOrganizations.add(entry.name);
    organizations.push({
      id: `org-${organizations.length + 1}`,
      name: entry.name,
      category: entry.category,
      advisor: null,
      createdAt: now,
    });
  }

  const lontar =
    organizations.find((organization) => organization.name === "Lontar") ??
    organizations[0];

  const organizationMembers: Row[] = [
    {
      id: "member-1",
      userId: "user-mahasiswa",
      organizationId: lontar.id,
      role: "PENGURUS",
      createdAt: now,
    },
    {
      id: "member-2",
      userId: "user-mahasiswa-2",
      organizationId: lontar.id,
      role: "ANGGOTA",
      createdAt: now,
    },
    {
      id: "member-3",
      userId: "user-mahasiswa-2",
      organizationId: organizations[1]?.id ?? lontar.id,
      role: "ANGGOTA",
      createdAt: now,
    },
  ];

  const rooms: Row[] = ROOM_SEEDS.map((room, index) => ({
    id: `room-${index + 1}`,
    name: room.name,
    building: room.building,
    floor: room.floor,
    capacity: room.capacity,
    facilities: JSON.stringify(room.facilities),
    roomType: room.roomType,
    photoUrl: room.photoUrl,
    openTime: room.openTime ?? "08:00",
    closeTime: room.closeTime ?? "17:00",
    requiresApproval: room.requiresApproval ?? true,
    maxDurationMinutes: room.maxDurationMinutes ?? 120,
    cancellationDeadlineMinutes: room.cancellationDeadlineMinutes ?? 60,
    attachmentRequired: room.attachmentRequired ?? false,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));

  const roomByName = (name: string) => rooms.find((room) => room.name === name);

  const roomManagers: Row[] = rooms.map((room, index) => ({
    id: `manager-${index + 1}`,
    roomId: room.id,
    userId: "user-pengelola",
    createdAt: now,
  }));

  const demoReservation = (
    id: string,
    userId: string,
    roomName: string,
    dayOffset: number,
    startHour: number,
    endHour: number,
    status: string,
    activityName: string,
    participantCount: number,
    type: "ORGANISASI" | "PRIBADI",
    organizationId: string | null,
  ): Row => {
    const day = witaMidnight(dayOffset);
    return {
      id,
      userId,
      roomId: roomByName(roomName)?.id ?? rooms[0].id,
      organizationId,
      start: witaTime(day, startHour),
      end: witaTime(day, endHour),
      type,
      activityName,
      participantCount,
      status,
      idempotencyKey: `demo-${id}`,
      attachmentUrl: null,
      createdAt: now,
      updatedAt: now,
    };
  };

  const reservations: Row[] = [
    demoReservation(
      "res-demo-selesai",
      "user-mahasiswa",
      "A.1.1 (Studio Pola)",
      -2,
      9,
      11,
      "SELESAI",
      "Kelas pola dasar",
      18,
      "PRIBADI",
      null,
    ),
    demoReservation(
      "res-demo-terkonfirmasi",
      "user-mahasiswa",
      "B.1.3 (Studio 3)",
      1,
      10,
      12,
      "TERKONFIRMASI",
      "Sesi foto produk Lontar",
      14,
      "ORGANISASI",
      String(lontar.id),
    ),
    demoReservation(
      "res-demo-menunggu",
      "user-mahasiswa",
      "A.1.2 (Lect 1A)",
      2,
      13,
      15,
      "MENUNGGU_PERSETUJUAN",
      "Kuliah umum Creativepreneur",
      32,
      "ORGANISASI",
      String(lontar.id),
    ),
    demoReservation(
      "res-demo-menunggu-2",
      "user-mahasiswa-2",
      "C.1.3 (Lect 1)",
      3,
      9,
      11,
      "MENUNGGU_PERSETUJUAN",
      "Sharing karya mahasiswa",
      30,
      "PRIBADI",
      null,
    ),
    demoReservation(
      "res-demo-aula",
      "user-pengelola",
      "AULA IDB BALI",
      0,
      10,
      13,
      "TERKONFIRMASI",
      "Panggung karya Lontar",
      120,
      "ORGANISASI",
      String(lontar.id),
    ),
    demoReservation(
      "res-demo-admin",
      "user-admin",
      "C.1.3 (Lect 1)",
      4,
      8,
      10,
      "TERKONFIRMASI",
      "Rapat koordinasi kampus",
      20,
      "PRIBADI",
      null,
    ),
  ];

  const statusHistory: Row[] = [];
  reservations.forEach((reservation, index) => {
    const status = reservation.status as string;
    if (status === "SELESAI") {
      statusHistory.push(
        {
          id: `history-${index}-1`,
          reservationId: reservation.id,
          oldStatus: null,
          newStatus: "TERKONFIRMASI",
          actorId: reservation.userId,
          reason: null,
          createdAt: now,
        },
        {
          id: `history-${index}-2`,
          reservationId: reservation.id,
          oldStatus: "TERKONFIRMASI",
          newStatus: "SELESAI",
          actorId: null,
          reason: "Selesai otomatis",
          createdAt: now,
        },
      );
      return;
    }

    statusHistory.push({
      id: `history-${index}-1`,
      reservationId: reservation.id,
      oldStatus: null,
      newStatus: status,
      actorId: reservation.userId,
      reason: null,
      createdAt: now,
    });
  });

  const slotBlocks: Row[] = [
    {
      id: "block-demo-1",
      roomId: roomByName("GEDUNG SERBA GUNA IDB BALI - Lt.1")?.id ?? rooms[0].id,
      start: witaTime(witaMidnight(0), 9),
      end: witaTime(witaMidnight(0), 17),
      reason: "Demo: acara kampus",
      createdById: "user-pengelola",
      createdAt: now,
    },
    {
      id: "block-demo-2",
      roomId: roomByName("ROOFTOP IDB BALI")?.id ?? rooms[0].id,
      start: witaTime(witaMidnight(1), 17),
      end: witaTime(witaMidnight(1), 21),
      reason: "Demo: pentas Alongside",
      createdById: "user-pengelola",
      createdAt: now,
    },
  ];

  return {
    User: users,
    Organization: organizations,
    OrganizationMember: organizationMembers,
    Room: rooms,
    RoomManager: roomManagers,
    Reservation: reservations,
    SlotBlock: slotBlocks,
    StatusHistory: statusHistory,
    Notification: [],
    SystemConfig: [
      {
        id: "default",
        maxActiveReservations: 5,
        maxAdvanceDays: 60,
        updatedAt: now,
      },
    ],
    Session: [],
    LoginThrottle: [],
    AuditLog: [],
  };
};
