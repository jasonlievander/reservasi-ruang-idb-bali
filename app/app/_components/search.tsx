"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building,
  Check,
  Clock,
  MapPin,
  Search,
  Users,
} from "@/app/_components/icons";
import { fromWitaDateTime, formatWitaDate } from "@/lib/wita";
import { useToast } from "./toast";
import { Modal } from "./modal";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/organizations";
import {
  EmptyState,
  ErrorNote,
  Skeleton,
  StatusBadge,
  formatDateLong,
  formatTimeRange,
  roomTypeLabel,
} from "./ui";
import type {
  ApiError,
  OrganizationCatalogItem,
  Reservation,
  Room,
} from "@/app/app/types";

type Props = {
  organizationCatalog: OrganizationCatalogItem[];
  onViewReservations: () => void;
};

const typeOptions = [
  { value: "semua", label: "Semua jenis" },
  { value: "kelas", label: "Kelas" },
  { value: "laboratorium", label: "Laboratorium" },
  { value: "studio", label: "Studio" },
  { value: "rapat", label: "Ruang rapat" },
  { value: "diskusi", label: "Ruang diskusi" },
  { value: "aula", label: "Aula" },
  { value: "serbaguna", label: "Serbaguna" },
  { value: "luar", label: "Area luar" },
];

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatWitaDate(date);
};

export function SearchExperience({
  organizationCatalog,
  onViewReservations,
}: Props) {
  const { notify } = useToast();
  const [date, setDate] = useState(tomorrow);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [capacity, setCapacity] = useState("1");
  const [roomType, setRoomType] = useState("semua");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activityName, setActivityName] = useState("");
  const [reservationType, setReservationType] = useState<
    "PRIBADI" | "ORGANISASI"
  >("PRIBADI");
  const [organizationId, setOrganizationId] = useState(
    organizationCatalog[0]?.id ?? "",
  );
  const [participants, setParticipants] = useState("1");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ticket, setTicket] = useState<Reservation | null>(null);
  const selectedStart = fromWitaDateTime(date, startTime);
  const approvalTooLate = false;

  const searchRooms = async () => {
    const start = fromWitaDateTime(date, startTime);
    const end = fromWitaDateTime(date, endTime);

    if (!start || !end) {
      setSearchError("Tanggal atau jam tidak valid.");
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        capacity,
      });
      if (roomType !== "semua") {
        params.set("type", roomType);
      }

      const response = await fetch(`/api/rooms/availability?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Pencarian tidak dapat diselesaikan.",
        );
      }

      setRooms(payload.rooms ?? []);
    } catch (cause) {
      setSearchError(
        cause instanceof Error ? cause.message : "Pencarian gagal.",
      );
      setRooms([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    void searchRooms();
  }, []);

  const openReservation = (room: Room) => {
    setSelectedRoom(room);
    setActivityName("");
    setReservationType("PRIBADI");
    setOrganizationId(organizationCatalog[0]?.id ?? "");
    setParticipants(String(Math.min(room.capacity, 10)));
    setAttachmentUrl("");
    setIdempotencyKey(crypto.randomUUID());
    setFormError(null);
    setFieldErrors({});
    setTicket(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setSelectedRoom(null);
    setTicket(null);
    setFormError(null);
    setFieldErrors({});
  };

  const submitReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoom) return;

    const start = fromWitaDateTime(date, startTime);
    const end = fromWitaDateTime(date, endTime);

    if (!start || !end) {
      setFormError("Tanggal atau jam tidak valid.");
      return;
    }

    if (reservationType === "ORGANISASI" && !organizationId) {
      setFormError("Pilih organisasi untuk keperluan organisasi.");
      return;
    }

    if (approvalTooLate) {
      setFormError(
        "Ruangan ini butuh persetujuan.",
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          start: start.toISOString(),
          end: end.toISOString(),
          type: reservationType,
          organizationId:
            reservationType === "ORGANISASI" ? organizationId : null,
          activityName,
          participantCount: Number(participants),
          attachmentUrl: attachmentUrl.trim() || null,
          idempotencyKey,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const apiError = payload as ApiError;
        const fields = apiError.error?.fields ?? [];
        setFieldErrors(
          Object.fromEntries(fields.map((field) => [field.field, field.message])),
        );
        throw new Error(apiError.error?.message ?? "Pengajuan gagal.");
      }

      setTicket(payload.reservation as Reservation);
      notify(
        payload.reservation.status === "TERKONFIRMASI"
          ? "Reservasi langsung terkonfirmasi."
          : "Pengajuan terkirim dan slot ditahan.",
        "success",
      );
      void searchRooms();
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Pengajuan gagal.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stack-xl">
      <section className="page-head">
        <div>
          <p className="mono-label">Cari & ajukan</p>
          <h1>Ruangan yang kosong, tanpa tebak-tebakan.</h1>
          <p className="page-head__lead">
            Tentukan waktu dan kebutuhan Anda. Hasil hanya menampilkan ruangan
            yang benar-benar tersedia pada rentang itu.
          </p>
        </div>
      </section>

      <section className="search-panel" aria-label="Filter pencarian">
        <div className="search-panel__grid">
          <label className="field">
            <span>Tanggal</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Mulai</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Selesai</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Kapasitas minimum</span>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Jenis ruangan</span>
            <select
              value={roomType}
              onChange={(event) => setRoomType(event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--primary search-panel__button"
            onClick={() => void searchRooms()}
            disabled={searching}
          >
            <Search size={18} />
            {searching ? "Mencari..." : "Cari ruangan"}
          </button>
        </div>
        <p className="search-panel__hint">
          <Clock size={15} />
          Semua waktu dalam WITA. Slot yang tampil sudah bebas dari reservasi
          aktif dan blokir.
        </p>
      </section>

      {searchError ? <ErrorNote>{searchError}</ErrorNote> : null}

      <section aria-labelledby="results-title">
        <div className="results-head">
          <div>
            <p className="mono-label">Hasil pencarian</p>
            <h2 id="results-title">
              {rooms === null
                ? "Mencari ruangan..."
                : `${rooms.length} ruangan tersedia`}
            </h2>
          </div>
          <span className="mono-label">
            {formatDateLong(fromWitaDateTime(date, "00:00")?.toISOString() ?? new Date().toISOString())}
          </span>
        </div>

        {searching ? (
          <div className="room-grid" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div className="room-card" key={item}>
                <Skeleton lines={5} />
              </div>
            ))}
          </div>
        ) : rooms && rooms.length > 0 ? (
          <div className="room-grid">
            {rooms.map((room, index) => (
              <article
                className="room-card"
                key={room.id}
                style={{ "--i": index } as React.CSSProperties}
              >
                {room.photoUrl ? (
                  <div className="room-card__media">
                    <Image
                      src={room.photoUrl}
                      alt={`Foto ${room.name}`}
                      width={640}
                      height={320}
                      className="room-card__image"
                    />
                  </div>
                ) : null}
                <div className="room-card__top">
                  <span className="room-type">
                    {roomTypeLabel(room.roomType)}
                  </span>
                  <span
                    className={`badge ${
                      room.requiresApproval
                        ? "badge--outline"
                        : "badge--ok"
                    }`}
                  >
                    {room.requiresApproval
                      ? "Butuh persetujuan"
                      : "Langsung terkonfirmasi"}
                  </span>
                </div>
                <h3>{room.name}</h3>
                <p className="room-location">
                  <MapPin size={15} />
                  {room.building}, lantai {room.floor}
                </p>
                <div className="room-facts">
                  <span>
                    <Users size={15} />
                    {room.capacity} orang
                  </span>
                  <span>
                    <Clock size={15} />
                    {room.openTime}–{room.closeTime} WITA
                  </span>
                  <span>
                    <Building size={15} />
                    maks. {room.maxDurationMinutes} menit
                  </span>
                </div>
                <div
                  className="facility-list"
                  role="list"
                  aria-label="Fasilitas"
                >
                  {room.facilities.slice(0, 4).map((facility) => (
                    <span key={facility} role="listitem">
                      {facility}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn--dark btn--wide"
                  onClick={() => openReservation(room)}
                >
                  Pilih slot <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : rooms ? (
          <EmptyState
            title="Belum ada ruangan yang cocok"
            action={
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setCapacity("1");
                  setRoomType("semua");
                }}
              >
                Longgarkan filter
              </button>
            }
          >
            Coba ubah jam, kapasitas, atau jenis ruangan. Slot yang sudah
            terpakai dan diblokir tidak ditampilkan.
          </EmptyState>
        ) : null}
      </section>

      <Modal
        open={Boolean(selectedRoom)}
        onClose={closeModal}
        title={ticket ? "Reservasi tercatat" : "Ajukan reservasi"}
        eyebrow={ticket ? "Tiket reservasi" : "Formulir pengajuan"}
        size="wide"
        footer={
          ticket ? (
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeModal}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  closeModal();
                  onViewReservations();
                }}
              >
                Lihat reservasi saya <ArrowRight size={17} />
              </button>
            </div>
          ) : null
        }
      >
        {ticket ? (
          <div className="ticket">
            <div className="ticket__head">
              <div>
                <p className="mono-label">SIRU / Tiket</p>
                <h3>{ticket.room?.name ?? selectedRoom?.name}</h3>
                <p className="ticket__id">#{ticket.id.slice(-8).toUpperCase()}</p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="ticket__perforation" aria-hidden="true" />
            <dl className="ticket__facts">
              <div>
                <dt>Kegiatan</dt>
                <dd>{ticket.activityName}</dd>
              </div>
              <div>
                <dt>Tanggal</dt>
                <dd>{formatDateLong(ticket.start)}</dd>
              </div>
              <div>
                <dt>Waktu</dt>
                <dd>{formatTimeRange(ticket.start, ticket.end)}</dd>
              </div>
              <div>
                <dt>Peserta</dt>
                <dd>{ticket.participantCount} orang</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {ticket.status === "TERKONFIRMASI"
                    ? "Slot sudah dialokasikan."
                    : "Slot ditahan sampai pengelola memutuskan."}
                </dd>
              </div>
            </dl>
            <div className="ticket__note">
              <Check size={18} />
              Simpan ID reservasi ini untuk penelusuran.
            </div>
          </div>
        ) : selectedRoom ? (
          <form className="reservation-form" onSubmit={submitReservation}>
            <div className="room-summary">
              <div>
                <p className="mono-label">{roomTypeLabel(selectedRoom.roomType)}</p>
                <h3>{selectedRoom.name}</h3>
                <p>
                  {selectedRoom.building}, lantai {selectedRoom.floor} ·{" "}
                  {formatDateLong(
                    fromWitaDateTime(date, "00:00")?.toISOString() ??
                      new Date().toISOString(),
                  )}
                </p>
                <p>
                  {formatTimeRange(
                    fromWitaDateTime(date, startTime)?.toISOString() ??
                      new Date().toISOString(),
                    fromWitaDateTime(date, endTime)?.toISOString() ??
                      new Date().toISOString(),
                  )}
                </p>
              </div>
              <span className="badge badge--outline">
                {selectedRoom.requiresApproval
                  ? "Butuh persetujuan"
                  : "Terkonfirmasi otomatis"}
              </span>
            </div>

            <label className="field">
              <span>Nama kegiatan</span>
              <input
                value={activityName}
                onChange={(event) => setActivityName(event.target.value)}
                placeholder="Contoh: Rapat koordinasi UKM"
                required
              />
              {fieldErrors.activityName ? (
                <small className="field-error">{fieldErrors.activityName}</small>
              ) : null}
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Jenis keperluan</span>
                <select
                  value={reservationType}
                  onChange={(event) =>
                    setReservationType(
                      event.target.value as "PRIBADI" | "ORGANISASI",
                    )
                  }
                >
                  <option value="PRIBADI">Pribadi</option>
                  <option value="ORGANISASI">Organisasi</option>
                </select>
              </label>

              {reservationType === "ORGANISASI" ? (
                <label className="field">
                  <span>Organisasi</span>
                  <select
                    value={organizationId}
                    onChange={(event) => setOrganizationId(event.target.value)}
                  >
                    {CATEGORY_ORDER.map((category) => {
                      const items = organizationCatalog.filter(
                        (item) => item.category === category,
                      );

                      if (items.length === 0) {
                        return null;
                      }

                      return (
                        <optgroup key={category} label={CATEGORY_LABELS[category]}>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <small className="field-hint">
                    Pilih salah satu organisasi yang akan melakukan kegiatan.
                    Nama organisasi ikut tercatat pada detail reservasi.
                  </small>
                </label>
              ) : null}

              <label className="field">
                <span>Jumlah peserta</span>
                <input
                  type="number"
                  min={1}
                  max={selectedRoom.capacity}
                  value={participants}
                  onChange={(event) => setParticipants(event.target.value)}
                />
                {fieldErrors.participantCount ? (
                  <small className="field-error">
                    {fieldErrors.participantCount}
                  </small>
                ) : null}
              </label>

              {selectedRoom.attachmentRequired ? (
                <label className="field field--wide">
                  <span>Tautan lampiran</span>
                  <input
                    type="url"
                    value={attachmentUrl}
                    onChange={(event) => setAttachmentUrl(event.target.value)}
                    placeholder="https://..."
                  />
                  {fieldErrors.attachmentUrl ? (
                    <small className="field-error">
                      {fieldErrors.attachmentUrl}
                    </small>
                  ) : null}
                </label>
              ) : null}
            </div>

            {approvalTooLate ? (
              <p className="form-warning">
                Ruangan ini membutuhkan persetujuan.
              </p>
            ) : null}

            {formError ? <ErrorNote>{formError}</ErrorNote> : null}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeModal}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || approvalTooLate}
                aria-busy={submitting}
              >
                {submitting ? "Mengirim..." : "Kirim pengajuan"}
                {submitting ? null : <ArrowRight size={17} />}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
