export type Role = "PEMINJAM" | "PENGELOLA" | "ADMIN";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  role: "ANGGOTA" | "PENGURUS";
};

export type OrganizationCatalogItem = {
  id: string;
  name: string;
  category: "UKM" | "HMJ";
};

export type Room = {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  roomType: string;
  photoUrl: string | null;
  openTime: string;
  closeTime: string;
  requiresApproval: boolean;
  maxDurationMinutes: number;
  cancellationDeadlineMinutes: number;
  attachmentRequired: boolean;
  active: boolean;
};

export type ReservationStatus =
  | "MENUNGGU_PERSETUJUAN"
  | "TERKONFIRMASI"
  | "DITOLAK"
  | "DIBATALKAN"
  | "KEDALUWARSA"
  | "SELESAI"
  | "GAGAL";

export type StatusHistory = {
  id: string;
  oldStatus: ReservationStatus | null;
  newStatus: ReservationStatus;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
};

export type Reservation = {
  id: string;
  userId: string;
  roomId: string;
  organizationId: string | null;
  start: string;
  end: string;
  type: "ORGANISASI" | "PRIBADI";
  activityName: string;
  participantCount: number;
  status: ReservationStatus;
  idempotencyKey: string;
  attachmentUrl: string | null;
  approvalCardUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  history: StatusHistory[];
  room: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
};

export type Approval = {
  id: string;
  start: string;
  end: string;
  type: "ORGANISASI" | "PRIBADI";
  activityName: string;
  participantCount: number;
  status: ReservationStatus;
  attachmentUrl: string | null;
  approvalCardUrl?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  room: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
};

export type SlotBlock = {
  id: string;
  roomId: string;
  start: string;
  end: string;
  reason: string;
  createdById: string;
  createdAt: string;
};

export type UsageDetail = {
  id: string;
  status: ReservationStatus;
  statusLabel: string;
  date: string;
  start: string;
  end: string;
  durationHours: number;
  activityName: string;
  participantCount: number;
  type: "ORGANISASI" | "PRIBADI";
  organizationName: string | null;
  borrowerName: string;
  approvalCardUrl?: string | null;
};

export type UsageReport = {
  room: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  from: string;
  to: string;
  totalReservations: number;
  usedHours: number;
  cancellations: number;
  byStatus: Record<ReservationStatus, number>;
  details: UsageDetail[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type ApiError = {
  error?: {
    code?: string;
    message?: string;
    fields?: Array<{ field: string; message: string }>;
  };
};
