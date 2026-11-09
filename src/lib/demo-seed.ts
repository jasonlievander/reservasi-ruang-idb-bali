import type {
  Reservation,
  ReservationStatus,
  StatusHistory,
} from "@/app/app/types";

export type DemoReservation = Reservation & {
  user: { id: string; name: string; email: string };
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

const witaIso = (day: Date, hour: number, minute = 0) =>
  new Date(day.getTime() + hour * 3_600_000 + minute * 60_000).toISOString();

const USERS = {
  mahasiswa: { id: "user-mahasiswa", name: "Ayu Mahasiswa", email: "mahasiswa@idbbali.ac.id" },
  mahasiswa2: { id: "user-mahasiswa-2", name: "Made Peminjam", email: "peminjam2@idbbali.ac.id" },
  pengelola: { id: "user-pengelola", name: "Bagus Pengelola", email: "pengelola@idbbali.ac.id" },
  admin: { id: "user-admin", name: "Admin SIRU", email: "admin@idbbali.ac.id" },
};

const ROOMS = {
  studioPola: {
    id: "room-1",
    name: "A.1.1 (Studio Pola)",
    building: "Gedung A",
    floor: "1",
  },
  lect1a: {
    id: "room-2",
    name: "A.1.2 (Lect 1A)",
    building: "Gedung A",
    floor: "1",
  },
  studio3: {
    id: "room-7",
    name: "B.1.3 (Studio 3)",
    building: "Gedung B",
    floor: "1",
  },
  lect1c: {
    id: "room-11",
    name: "C.1.3 (Lect 1)",
    building: "Gedung C",
    floor: "1",
  },
  aula: {
    id: "room-14",
    name: "AULA IDB BALI",
    building: "Gedung A",
    floor: "1",
  },
};

const LONTAR = { id: "org-10", name: "Lontar" };

type SeedInput = {
  id: string;
  user: (typeof USERS)[keyof typeof USERS];
  room: (typeof ROOMS)[keyof typeof ROOMS];
  organization: { id: string; name: string } | null;
  dayOffset: number;
  startHour: number;
  endHour: number;
  status: ReservationStatus;
  activityName: string;
  participantCount: number;
  type: "ORGANISASI" | "PRIBADI";
  history: StatusHistory[];
};

const seed = (input: SeedInput): DemoReservation => {
  const day = witaMidnight(input.dayOffset);
  const now = new Date().toISOString();

  return {
    id: input.id,
    userId: input.user.id,
    roomId: input.room.id,
    organizationId: input.organization?.id ?? null,
    start: witaIso(day, input.startHour),
    end: witaIso(day, input.endHour),
    type: input.type,
    activityName: input.activityName,
    participantCount: input.participantCount,
    status: input.status,
    idempotencyKey: `demo-${input.id}`,
    attachmentUrl: null,
    approvalCardUrl: null,
    createdAt: now,
    updatedAt: now,
    history: input.history,
    room: input.room,
    organization: input.organization,
    user: input.user,
  };
};

const history = (
  reservationId: string,
  entries: Array<{
    oldStatus: ReservationStatus | null;
    newStatus: ReservationStatus;
    actorId: string | null;
    reason?: string | null;
  }>,
): StatusHistory[] => {
  const now = new Date().toISOString();
  return entries.map((entry, index) => ({
    id: `history-${reservationId}-${index + 1}`,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
    actorId: entry.actorId,
    reason: entry.reason ?? null,
    createdAt: now,
  }));
};

export function buildInitialReservations(): DemoReservation[] {
  return [
    seed({
      id: "res-demo-selesai",
      user: USERS.mahasiswa,
      room: ROOMS.studioPola,
      organization: null,
      dayOffset: -2,
      startHour: 9,
      endHour: 11,
      status: "SELESAI",
      activityName: "Kelas pola dasar",
      participantCount: 18,
      type: "PRIBADI",
      history: history("res-demo-selesai", [
        {
          oldStatus: null,
          newStatus: "TERKONFIRMASI",
          actorId: USERS.mahasiswa.id,
        },
        {
          oldStatus: "TERKONFIRMASI",
          newStatus: "SELESAI",
          actorId: null,
          reason: "Selesai otomatis",
        },
      ]),
    }),
    seed({
      id: "res-demo-terkonfirmasi",
      user: USERS.mahasiswa,
      room: ROOMS.studio3,
      organization: LONTAR,
      dayOffset: 1,
      startHour: 10,
      endHour: 12,
      status: "TERKONFIRMASI",
      activityName: "Sesi foto produk Lontar",
      participantCount: 14,
      type: "ORGANISASI",
      history: history("res-demo-terkonfirmasi", [
        {
          oldStatus: null,
          newStatus: "TERKONFIRMASI",
          actorId: USERS.mahasiswa.id,
        },
      ]),
    }),
    seed({
      id: "res-demo-menunggu",
      user: USERS.mahasiswa,
      room: ROOMS.lect1a,
      organization: LONTAR,
      dayOffset: 2,
      startHour: 13,
      endHour: 15,
      status: "MENUNGGU_PERSETUJUAN",
      activityName: "Kuliah umum Creativepreneur",
      participantCount: 32,
      type: "ORGANISASI",
      history: history("res-demo-menunggu", [
        {
          oldStatus: null,
          newStatus: "MENUNGGU_PERSETUJUAN",
          actorId: USERS.mahasiswa.id,
        },
      ]),
    }),
    seed({
      id: "res-demo-menunggu-2",
      user: USERS.mahasiswa2,
      room: ROOMS.lect1c,
      organization: null,
      dayOffset: 3,
      startHour: 9,
      endHour: 11,
      status: "MENUNGGU_PERSETUJUAN",
      activityName: "Sharing karya mahasiswa",
      participantCount: 30,
      type: "PRIBADI",
      history: history("res-demo-menunggu-2", [
        {
          oldStatus: null,
          newStatus: "MENUNGGU_PERSETUJUAN",
          actorId: USERS.mahasiswa2.id,
        },
      ]),
    }),
    seed({
      id: "res-demo-aula",
      user: USERS.pengelola,
      room: ROOMS.aula,
      organization: LONTAR,
      dayOffset: 0,
      startHour: 10,
      endHour: 13,
      status: "TERKONFIRMASI",
      activityName: "Panggung karya Lontar",
      participantCount: 120,
      type: "ORGANISASI",
      history: history("res-demo-aula", [
        {
          oldStatus: null,
          newStatus: "TERKONFIRMASI",
          actorId: USERS.pengelola.id,
        },
      ]),
    }),
    seed({
      id: "res-demo-admin",
      user: USERS.admin,
      room: ROOMS.lect1c,
      organization: null,
      dayOffset: 4,
      startHour: 8,
      endHour: 10,
      status: "TERKONFIRMASI",
      activityName: "Rapat koordinasi kampus",
      participantCount: 20,
      type: "PRIBADI",
      history: history("res-demo-admin", [
        {
          oldStatus: null,
          newStatus: "TERKONFIRMASI",
          actorId: USERS.admin.id,
        },
      ]),
    }),
  ];
}
