"use client";

import { buildInitialReservations, type DemoReservation } from "@/lib/demo-seed";
import type {
  Reservation,
  ReservationStatus,
  Room,
  SessionUser,
  StatusHistory,
} from "@/app/app/types";

const STORAGE_KEY = "siru.demo.reservations.v1";
const UPDATE_EVENT = "siru-demo-updated";
const ACTIVE_STATUSES: ReservationStatus[] = [
  "MENUNGGU_PERSETUJUAN",
  "TERKONFIRMASI",
];
const MAX_ACTIVE_RESERVATIONS = 5;

type StatusOverride = {
  status: ReservationStatus;
  history: StatusHistory[];
  updatedAt: string;
};

type StoredState = {
  custom: Reservation[];
  overrides: Record<string, StatusOverride>;
};

const isBrowser = () => typeof window !== "undefined";

const emptyState = (): StoredState => ({ custom: [], overrides: {} });

const readState = (): StoredState => {
  if (!isBrowser()) {
    return emptyState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }

    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      overrides:
        parsed.overrides && typeof parsed.overrides === "object"
          ? parsed.overrides
          : {},
    };
  } catch {
    return emptyState();
  }
};

const writeState = (state: StoredState) => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }

  window.dispatchEvent(new Event(UPDATE_EVENT));
};

const cloneReservation = (reservation: DemoReservation): DemoReservation =>
  JSON.parse(JSON.stringify(reservation)) as DemoReservation;

export function getAllReservations(): DemoReservation[] {
  const { custom, overrides } = readState();
  const initial = buildInitialReservations();
  const initialIds = new Set(initial.map((item) => item.id));
  const merged: DemoReservation[] = [
    ...initial,
    ...(custom as DemoReservation[]).filter((item) => !initialIds.has(item.id)),
  ];

  return merged.map((reservation) => {
    const override = overrides[reservation.id];
    if (!override) {
      return cloneReservation(reservation);
    }

    return cloneReservation({
      ...reservation,
      status: override.status,
      history: override.history,
      updatedAt: override.updatedAt,
    });
  });
}

export function getReservationsForUser(userId: string): DemoReservation[] {
  return getAllReservations().filter(
    (reservation) => reservation.userId === userId,
  );
}

export function getPendingApprovals(): DemoReservation[] {
  return getAllReservations()
    .filter((reservation) => reservation.status === "MENUNGGU_PERSETUJUAN")
    .sort(
      (first, second) =>
        new Date(first.start).getTime() - new Date(second.start).getTime(),
    );
}

export function getApprovalHistory(limit = 12): DemoReservation[] {
  return getAllReservations()
    .filter(
      (reservation) =>
        reservation.status === "TERKONFIRMASI" ||
        reservation.status === "SELESAI",
    )
    .sort(
      (first, second) =>
        new Date(second.start).getTime() - new Date(first.start).getTime(),
    )
    .slice(0, limit);
}

const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date) =>
  startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();

export function findConflict(
  roomId: string,
  start: Date,
  end: Date,
): DemoReservation | null {
  return (
    getAllReservations().find(
      (reservation) =>
        reservation.roomId === roomId &&
        ACTIVE_STATUSES.includes(reservation.status) &&
        overlaps(start, end, new Date(reservation.start), new Date(reservation.end)),
    ) ?? null
  );
}

export function getBusyRoomIds(start: Date, end: Date): Set<string> {
  return new Set(
    getAllReservations()
      .filter(
        (reservation) =>
          ACTIVE_STATUSES.includes(reservation.status) &&
          overlaps(
            start,
            end,
            new Date(reservation.start),
            new Date(reservation.end),
          ),
      )
      .map((reservation) => reservation.roomId),
  );
}

export type CreateDemoReservationInput = {
  user: SessionUser;
  room: Room;
  organization: { id: string; name: string } | null;
  start: Date;
  end: Date;
  type: "ORGANISASI" | "PRIBADI";
  activityName: string;
  participantCount: number;
  attachmentUrl?: string | null;
};

const newId = () => {
  if (isBrowser() && window.crypto?.randomUUID) {
    return `res-${window.crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  }
  return `res-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const newHistoryEntry = (
  oldStatus: ReservationStatus | null,
  newStatus: ReservationStatus,
  actorId: string | null,
  reason: string | null,
): StatusHistory => ({
  id: `history-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
  oldStatus,
  newStatus,
  actorId,
  reason,
  createdAt: new Date().toISOString(),
});

const persistStatus = (
  reservation: DemoReservation,
  status: ReservationStatus,
  actorId: string | null,
  reason: string | null,
  oldStatusOverride?: ReservationStatus | null,
) => {
  const state = readState();
  const oldStatus =
    oldStatusOverride === undefined ? reservation.status : oldStatusOverride;
  const history = [
    ...reservation.history,
    newHistoryEntry(oldStatus, status, actorId, reason),
  ];
  const updatedAt = new Date().toISOString();

  state.overrides[reservation.id] = { status, history, updatedAt };
  writeState(state);

  return { ...reservation, status, history, updatedAt };
};

export function createDemoReservation(
  input: CreateDemoReservationInput,
): DemoReservation {
  const now = new Date();

  if (!input.activityName.trim()) {
    throw new Error("Nama kegiatan wajib diisi.");
  }

  if (input.start.getTime() >= input.end.getTime()) {
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  }

  if (input.start.getTime() < now.getTime()) {
    throw new Error("Waktu mulai tidak boleh di masa lalu.");
  }

  if (input.room.attachmentRequired && !input.attachmentUrl?.trim()) {
    throw new Error("Ruangan ini mewajibkan lampiran surat atau izin.");
  }

  const maxEnd = new Date(
    input.start.getTime() + input.room.maxDurationMinutes * 60_000,
  );
  if (input.end.getTime() > maxEnd.getTime()) {
    throw new Error(
      `Durasi maksimum ruangan ini ${input.room.maxDurationMinutes} menit.`,
    );
  }

  const open = input.room.openTime.split(":").map(Number);
  const close = input.room.closeTime.split(":").map(Number);
  const witaStart = new Date(input.start.getTime() + 8 * 3_600_000);
  const witaEnd = new Date(input.end.getTime() + 8 * 3_600_000);
  const startMinutes = witaStart.getUTCHours() * 60 + witaStart.getUTCMinutes();
  const endMinutes = witaEnd.getUTCHours() * 60 + witaEnd.getUTCMinutes();
  const openMinutes = (open[0] ?? 0) * 60 + (open[1] ?? 0);
  const closeMinutes = (close[0] ?? 24) * 60 + (close[1] ?? 0);

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new Error(
      `Ruangan hanya dapat dipakai ${input.room.openTime}–${input.room.closeTime} WITA.`,
    );
  }

  if (
    !Number.isInteger(input.participantCount) ||
    input.participantCount < 1 ||
    input.participantCount > input.room.capacity
  ) {
    throw new Error(
      `Jumlah peserta harus antara 1 dan ${input.room.capacity}.`,
    );
  }

  const conflict = findConflict(input.room.id, input.start, input.end);
  if (conflict) {
    throw new Error("Slot sudah dipakai pengajuan lain. Pilih waktu lain.");
  }

  const activeCount = getAllReservations().filter(
    (reservation) =>
      reservation.userId === input.user.id &&
      ACTIVE_STATUSES.includes(reservation.status) &&
      new Date(reservation.end).getTime() > now.getTime(),
  ).length;

  if (activeCount >= MAX_ACTIVE_RESERVATIONS) {
    throw new Error(
      `Batas ${MAX_ACTIVE_RESERVATIONS} reservasi aktif telah tercapai.`,
    );
  }

  const status: ReservationStatus = input.room.requiresApproval
    ? "MENUNGGU_PERSETUJUAN"
    : "TERKONFIRMASI";
  const nowIso = new Date().toISOString();

  const reservation: DemoReservation = {
    id: newId(),
    userId: input.user.id,
    roomId: input.room.id,
    organizationId: input.organization?.id ?? null,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    type: input.type,
    activityName: input.activityName.trim(),
    participantCount: input.participantCount,
    status,
    idempotencyKey:
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}`,
    attachmentUrl: input.attachmentUrl?.trim() || null,
    approvalCardUrl: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    history: [
      newHistoryEntry(null, status, input.user.id, null),
    ],
    room: {
      id: input.room.id,
      name: input.room.name,
      building: input.room.building,
      floor: input.room.floor,
    },
    organization: input.organization,
    user: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },
  };

  const state = readState();
  state.custom.push(reservation);
  writeState(state);

  return reservation;
}

export function cancelDemoReservation(
  reservationId: string,
  actorId: string,
  reason?: string | null,
): DemoReservation {
  const reservation = getAllReservations().find(
    (item) => item.id === reservationId,
  );

  if (!reservation) {
    throw new Error("Reservasi tidak ditemukan.");
  }

  if (
    reservation.status !== "MENUNGGU_PERSETUJUAN" &&
    reservation.status !== "TERKONFIRMASI"
  ) {
    throw new Error("Reservasi dengan status ini tidak dapat dibatalkan.");
  }

  return persistStatus(
    reservation,
    "DIBATALKAN",
    actorId,
    reason?.trim() || "Dibatalkan peminjam",
  );
}

export function approveDemoReservation(
  reservationId: string,
  actorId: string,
  reason?: string | null,
): DemoReservation {
  const reservation = getAllReservations().find(
    (item) => item.id === reservationId,
  );

  if (!reservation) {
    throw new Error("Reservasi tidak ditemukan.");
  }

  if (reservation.status !== "MENUNGGU_PERSETUJUAN") {
    throw new Error("Hanya pengajuan yang menunggu yang dapat disetujui.");
  }

  return persistStatus(
    reservation,
    "TERKONFIRMASI",
    actorId,
    reason?.trim() || "Disetujui pengelola",
    "MENUNGGU_PERSETUJUAN",
  );
}

export function rejectDemoReservation(
  reservationId: string,
  actorId: string,
  reason: string,
): DemoReservation {
  if (!reason.trim()) {
    throw new Error("Alasan penolakan wajib diisi.");
  }

  const reservation = getAllReservations().find(
    (item) => item.id === reservationId,
  );

  if (!reservation) {
    throw new Error("Reservasi tidak ditemukan.");
  }

  if (reservation.status !== "MENUNGGU_PERSETUJUAN") {
    throw new Error("Hanya pengajuan yang menunggu yang dapat ditolak.");
  }

  return persistStatus(
    reservation,
    "DITOLAK",
    actorId,
    reason.trim(),
    "MENUNGGU_PERSETUJUAN",
  );
}

export function resetDemoData(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }

  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function subscribeDemo(listener: () => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(UPDATE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(UPDATE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
