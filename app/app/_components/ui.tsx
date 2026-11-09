import { AlertCircle, Calendar, Ticket } from "@/app/_components/icons";
import type {
  ReservationStatus,
  Role,
} from "@/app/app/types";

const statusMap: Record<
  ReservationStatus,
  { label: string; tone: string }
> = {
  MENUNGGU_PERSETUJUAN: {
    label: "Menunggu persetujuan",
    tone: "pending",
  },
  TERKONFIRMASI: { label: "Terkonfirmasi", tone: "ok" },
  DITOLAK: { label: "Ditolak", tone: "danger" },
  DIBATALKAN: { label: "Dibatalkan", tone: "neutral" },
  KEDALUWARSA: { label: "Kedaluwarsa", tone: "warn" },
  SELESAI: { label: "Selesai", tone: "brand" },
  GAGAL: { label: "Gagal", tone: "danger" },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const item = statusMap[status];

  return (
    <span className={`status-badge status-badge--${item.tone}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {item.label}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">
        <Ticket size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="form-error" role="alert">
      <AlertCircle size={18} />
      {children}
    </p>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="stat-card">
      <span className="mono-label">{label}</span>
      <strong>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
    </div>
  );
}

export function DateChip({
  iso,
  tone = "default",
}: {
  iso: string;
  tone?: "default" | "accent";
}) {
  const date = new Date(iso);

  return (
    <span className={`date-chip date-chip--${tone}`}>
      <span className="date-chip__day">
        {new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Makassar",
          day: "2-digit",
        }).format(date)}
      </span>
      <span className="date-chip__month">
        {new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Makassar",
          month: "short",
        }).format(date)}
      </span>
    </span>
  );
}

export const formatDateLong = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

export const formatDateShort = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export const formatTimeRange = (start: string, end: string) =>
  `${formatTime(start)}–${formatTime(end)} WITA`;

const roomTypeLabels: Record<string, string> = {
  rapat: "Ruang rapat",
  studio: "Studio",
  diskusi: "Ruang diskusi",
  kelas: "Kelas",
  laboratorium: "Laboratorium",
  aula: "Aula",
  serbaguna: "Serbaguna",
  luar: "Area luar",
};

export const roomTypeLabel = (value: string) =>
  roomTypeLabels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);

export const roleLabel: Record<Role, string> = {
  PEMINJAM: "Peminjam",
  PENGELOLA: "Pengelola ruangan",
  ADMIN: "Admin sistem",
};

export const statusLabel = (status: ReservationStatus) =>
  statusMap[status].label;

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function CalendarMark({ iso }: { iso: string }) {
  return (
    <span className="calendar-mark">
      <Calendar size={16} />
      {formatDateShort(iso)}
    </span>
  );
}
