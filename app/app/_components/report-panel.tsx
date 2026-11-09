"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Refresh } from "@/app/_components/icons";
import { fromWitaDateTime, formatWitaDate } from "@/lib/wita";
import {
  EmptyState,
  ErrorNote,
  Skeleton,
  StatCard,
  formatDateShort,
  statusLabel,
} from "./ui";
import type { ReservationStatus, Room, UsageReport } from "@/app/app/types";

const statusOrder: ReservationStatus[] = [
  "MENUNGGU_PERSETUJUAN",
  "TERKONFIRMASI",
  "DITOLAK",
  "DIBATALKAN",
  "KEDALUWARSA",
  "SELESAI",
  "GAGAL",
];

const today = formatWitaDate(new Date());
const firstOfMonth = `${today.slice(0, 8)}01`;

export function ReportPanel({ role }: { role: "PEMINJAM" | "PENGELOLA" | "ADMIN" }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const endpoint =
        role === "ADMIN" ? "/api/rooms" : "/api/rooms?managed=true";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat ruangan.");
      }
      const nextRooms: Room[] = payload.rooms ?? [];
      setRooms(nextRooms);
      setSelectedId((current) =>
        nextRooms.some((room) => room.id === current)
          ? current
          : nextRooms[0]?.id ?? "",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat ruangan.",
      );
    } finally {
      setRoomsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const fetchReport = useCallback(async () => {
    if (!selectedId) return;

    const start = fromWitaDateTime(from, "00:00");
    const endStart = fromWitaDateTime(to, "00:00");
    if (!start || !endStart) {
      setError("Tanggal tidak valid.");
      return;
    }
    const end = new Date(endStart.getTime() + 86_400_000);

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        roomId: selectedId,
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const response = await fetch(`/api/reports/usage?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat rekap.");
      }
      setReport(payload.report as UsageReport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat rekap.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedId, from, to]);

  useEffect(() => {
    if (selectedId) {
      void fetchReport();
    }
  }, [selectedId, fetchReport]);

  const xlsxHref = (() => {
    if (!selectedId) return "#";
    const start = fromWitaDateTime(from, "00:00");
    const endStart = fromWitaDateTime(to, "00:00");
    if (!start || !endStart) return "#";
    const end = new Date(endStart.getTime() + 86_400_000);
    const params = new URLSearchParams({
      roomId: selectedId,
      from: start.toISOString(),
      to: end.toISOString(),
      format: "xlsx",
    });
    return `/api/reports/usage?${params}`;
  })();

  const maxStatus = report
    ? Math.max(1, ...statusOrder.map((status) => report.byStatus[status] ?? 0))
    : 1;

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Rekap penggunaan</p>
          <h1>Angka yang bisa dibaca cepat.</h1>
          <p className="page-head__lead">
            Jumlah reservasi, jam terpakai, dan pembatalan per ruangan dalam
            periode yang Anda pilih.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void fetchReport()}
          disabled={loading || !selectedId}
        >
          <Refresh size={17} /> Muat ulang
        </button>
      </section>

      {roomsLoading ? (
        <div className="panel">
          <Skeleton lines={3} />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState title="Belum ada ruangan untuk direkap">
          Admin perlu menugaskan Anda ke ruangan terlebih dahulu.
        </EmptyState>
      ) : (
        <>
          <section className="panel report-controls" aria-label="Filter rekap">
            <label className="field">
              <span>Ruangan</span>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Dari</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Sampai</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void fetchReport()}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Menghitung..." : "Tampilkan"}
            </button>
              <a className="btn btn--dark" href={xlsxHref} download>
                <Download size={17} /> Excel
              </a>
          </section>

          {error ? <ErrorNote>{error}</ErrorNote> : null}

          {loading ? (
            <div className="stat-grid">
              {[0, 1, 2].map((item) => (
                <div className="stat-card" key={item}>
                  <Skeleton lines={2} />
                </div>
              ))}
            </div>
          ) : report ? (
            <>
              <div className="report-head">
                <div>
                  <p className="mono-label">Ruang</p>
                  <h2>{report.room.name}</h2>
                  <p className="muted">
                    {report.room.building}, lantai {report.room.floor}
                  </p>
                </div>
                <p className="mono-label">
                  {formatDateShort(
                    fromWitaDateTime(from, "00:00")?.toISOString() ??
                      report.from,
                  )}{" "}
                  –{" "}
                  {formatDateShort(
                    fromWitaDateTime(to, "00:00")?.toISOString() ?? report.to,
                  )}
                </p>
              </div>

              <div className="stat-grid">
                <StatCard
                  label="Jumlah reservasi"
                  value={report.totalReservations}
                />
                <StatCard
                  label="Jam terpakai"
                  value={report.usedHours.toFixed(1)}
                  suffix=" jam"
                />
                <StatCard label="Pembatalan" value={report.cancellations} />
              </div>

              <section className="panel" aria-labelledby="breakdown-title">
                <div className="panel-heading">
                  <p className="mono-label">Komposisi status</p>
                  <h2 id="breakdown-title">Dari pengajuan ke keputusan.</h2>
                </div>
                <div className="status-bars">
                  {statusOrder.map((status) => {
                    const value = report.byStatus[status] ?? 0;
                    return (
                      <div className="status-bar" key={status}>
                        <span className="status-bar__label">
                          {statusLabel(status)}
                        </span>
                        <span className="status-bar__track">
                          <span
                            className={`status-bar__fill status-bar__fill--${status.toLowerCase()}`}
                            style={{
                              width: `${(value / maxStatus) * 100}%`,
                            }}
                          />
                        </span>
                        <strong>{value}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel" aria-labelledby="detail-title">
                <div className="panel-heading panel-heading--row">
                  <div>
                    <p className="mono-label">Rincian per reservasi</p>
                    <h2 id="detail-title">
                      {report.details.length} catatan peminjaman
                    </h2>
                  </div>
                  <span className="muted">
                    Dihitung dari waktu mulai dalam periode
                  </span>
                </div>

                {report.details.length === 0 ? (
                  <p className="muted">
                    Tidak ada reservasi yang dimulai pada periode ini.
                  </p>
                ) : (
                  <div className="detail-table" role="table" aria-label="Rincian reservasi">
                    <div className="detail-table__head" role="row">
                      <span role="columnheader">Waktu</span>
                      <span role="columnheader">Kegiatan</span>
                      <span role="columnheader">Status</span>
                      <span role="columnheader">Durasi</span>
                      <span role="columnheader">Kartu</span>
                    </div>
                    {report.details.map((detail) => (
                      <div className="detail-table__row" role="row" key={detail.id}>
                        <span className="detail-table__time" role="cell">
                          <strong>
                            {detail.start}–{detail.end}
                          </strong>
                          <small>{detail.date}</small>
                        </span>
                        <span className="detail-table__main" role="cell">
                          <strong>{detail.activityName}</strong>
                          <small>
                            {detail.organizationName ?? "Pribadi"} ·{" "}
                            {detail.borrowerName} · {detail.participantCount}{" "}
                            peserta
                          </small>
                        </span>
                        <span role="cell">
                          <span className="status-badge status-badge--neutral">
                            {detail.statusLabel}
                          </span>
                        </span>
                        <span className="detail-table__duration" role="cell">
                          {detail.durationHours.toFixed(1)} jam
                        </span>
                        <span className="detail-table__card" role="cell">
                          {detail.approvalCardUrl ? (
                            <a
                              className="inline-link"
                              href={detail.approvalCardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              Kartu
                            </a>
                          ) : (
                            <span className="muted" aria-label="Belum ada kartu">
                              —
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
