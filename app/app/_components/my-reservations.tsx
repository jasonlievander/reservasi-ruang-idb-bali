"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Refresh,
  Ticket,
  Users,
  Close,
} from "@/app/_components/icons";
import { useToast } from "./toast";
import { Modal } from "./modal";
import {
  cancelDemoReservation,
  getReservationsForUser,
  subscribeDemo,
} from "@/lib/demo-store";
import {
  DateChip,
  EmptyState,
  ErrorNote,
  StatusBadge,
  formatDateLong,
  formatTimeRange,
  statusLabel,
} from "./ui";
import type { Reservation, SessionUser } from "@/app/app/types";

const activeStatuses = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"];
type Filter = "aktif" | "semua" | "riwayat";

export function MyReservations({ user }: { user: SessionUser }) {
  const { notify } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("aktif");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [reason, setReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setReservations(getReservationsForUser(user.id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat reservasi.",
      );
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void load();
    return subscribeDemo(() => {
      void load();
    });
  }, [load]);

  const now = Date.now();
  const filtered = reservations.filter((reservation) => {
    const isActive =
      activeStatuses.includes(reservation.status) &&
      new Date(reservation.end).getTime() > now;

    if (filter === "aktif") return isActive;
    if (filter === "riwayat") return !isActive;
    return true;
  });

  const sorted = [...filtered].sort(
    (first, second) =>
      new Date(second.start).getTime() - new Date(first.start).getTime(),
  );

  const openCancel = (reservation: Reservation) => {
    setCancelTarget(reservation);
    setReason("");
    setCancelError(null);
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);

    try {
      cancelDemoReservation(
        cancelTarget.id,
        user.id,
        reason.trim() || null,
      );

      notify("Reservasi dibatalkan. Slot kembali tersedia.", "success");
      setCancelTarget(null);
      await load();
    } catch (cause) {
      setCancelError(
        cause instanceof Error ? cause.message : "Pembatalan gagal.",
      );
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Reservasi saya</p>
          <h1>Jejak peminjaman Anda.</h1>
          <p className="page-head__lead">
            Status, riwayat keputusan, dan slot yang masih ditahan terlihat di
            satu tempat.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          <Refresh size={17} /> Muat ulang
        </button>
      </section>

      <div className="segmented" role="tablist" aria-label="Filter reservasi">
        {(
          [
            ["aktif", "Aktif"],
            ["semua", "Semua"],
            ["riwayat", "Riwayat"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`segmented__item${filter === value ? " is-active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {loading ? (
        <div className="reservation-list" aria-busy="true">
          {[0, 1].map((item) => (
            <div className="reservation-card" key={item}>
              <div className="skeleton" aria-hidden="true">
                <span />
                <span style={{ width: "48%" }} />
                <span style={{ width: "72%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="Belum ada reservasi di filter ini">
          Reservasi baru akan muncul setelah pengajuan tercatat. Untuk filter
          aktif, slot yang sudah selesai tidak ditampilkan.
        </EmptyState>
      ) : (
        <div className="reservation-list">
          {sorted.map((reservation) => {
            const isActive =
              activeStatuses.includes(reservation.status) &&
              new Date(reservation.end).getTime() > now;

            return (
              <article className="reservation-card" key={reservation.id}>
                <DateChip iso={reservation.start} />
                <div className="reservation-card__main">
                  <div className="reservation-card__head">
                    <div>
                      <p className="mono-label">
                        {formatDateLong(reservation.start)}
                      </p>
                      <h2>{reservation.activityName}</h2>
                    </div>
                    <StatusBadge status={reservation.status} />
                  </div>

                  <div className="reservation-meta">
                    <span>
                      <Clock size={15} />
                      {formatTimeRange(reservation.start, reservation.end)}
                    </span>
                    <span>
                      <Ticket size={15} />
                      {reservation.room.name}, {reservation.room.building}
                    </span>
                    <span>
                      <Users size={15} />
                      {reservation.participantCount} peserta
                    </span>
                    <span>
                      <Calendar size={15} />
                      ID {reservation.id.slice(-8).toUpperCase()}
                    </span>
                  </div>

                  {reservation.organization ? (
                    <p className="reservation-org">
                      Organisasi: {reservation.organization.name}
                    </p>
                  ) : null}

                  {reservation.status === "TERKONFIRMASI" &&
                  reservation.approvalCardUrl ? (
                    <a
                      className="inline-link"
                      href={reservation.approvalCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      Unduh Kartu Persetujuan Ruangan
                    </a>
                  ) : null}

                  <details className="history">
                    <summary>
                      Riwayat status ({reservation.history.length})
                    </summary>
                    <ol className="history__list">
                      {reservation.history.map((entry) => (
                        <li key={entry.id}>
                          <span className="history__dot" aria-hidden="true" />
                          <div>
                            <strong>
                              {entry.oldStatus
                                ? `${statusLabel(entry.oldStatus)} → ${statusLabel(entry.newStatus)}`
                                : statusLabel(entry.newStatus)}
                            </strong>
                            <span className="mono-label">
                              {new Intl.DateTimeFormat("id-ID", {
                                timeZone: "Asia/Makassar",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(entry.createdAt))}{" "}
                              WITA
                            </span>
                            {entry.reason ? <p>{entry.reason}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>

                <div className="reservation-card__actions">
                  {isActive ? (
                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      onClick={() => openCancel(reservation)}
                    >
                      <Close size={16} /> Batalkan
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Batalkan reservasi?"
        eyebrow={cancelTarget ? cancelTarget.activityName : undefined}
        footer={
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setCancelTarget(null)}
              disabled={cancelBusy}
            >
              Kembali
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void submitCancel()}
              disabled={cancelBusy}
              aria-busy={cancelBusy}
            >
              {cancelBusy ? "Membatalkan..." : "Ya, batalkan"}
            </button>
          </div>
        }
      >
        <p className="modal-lead">
          Slot akan langsung dilepas dan bisa diajukan pihak lain. Tindakan ini
          tercatat atas nama Anda.
        </p>
        {cancelTarget ? (
          <div className="cancel-summary">
            <strong>{cancelTarget.room.name}</strong>
            <span>
              {formatTimeRange(cancelTarget.start, cancelTarget.end)} ·{" "}
              {formatDateLong(cancelTarget.start)}
            </span>
          </div>
        ) : null}
        <label className="field">
          <span>Alasan (opsional)</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: kegiatan dipindahkan"
          />
        </label>
        {cancelError ? <ErrorNote>{cancelError}</ErrorNote> : null}
      </Modal>
    </div>
  );
}
