"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock } from "@/app/_components/icons";
import { useToast } from "./toast";
import {
  DateChip,
  EmptyState,
  ErrorNote,
  StatCard,
  StatusBadge,
  formatDateLong,
  formatTimeRange,
  roleLabel,
} from "./ui";
import type {
  Approval,
  ApiError,
  Reservation,
  SessionUser,
} from "@/app/app/types";

type Props = {
  user: SessionUser;
  canApprove: boolean;
  onNavigate: (tab: "cari" | "reservasi" | "persetujuan") => void;
};

const activeStatuses = ["MENUNGGU_PERSETUJUAN", "TERKONFIRMASI"];

export function Overview({ user, canApprove, onNavigate }: Props) {
  const { notify } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const requests: Array<Promise<Response>> = [
          fetch("/api/reservations", { cache: "no-store" }),
        ];
        if (canApprove) {
          requests.push(fetch("/api/approvals", { cache: "no-store" }));
        }

        const responses = await Promise.all(requests);
        if (responses.some((response) => !response.ok)) {
          throw new Error("Gagal memuat ringkasan.");
        }

        const reservationData = await responses[0].json();
        if (cancelled) return;
        setReservations(reservationData.reservations ?? []);

        if (responses[1]) {
          const approvalData = await responses[1].json();
          if (cancelled) return;
          setApprovals(approvalData.approvals ?? []);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Gagal memuat ringkasan.",
          );
          notify("Ringkasan belum dapat dimuat.", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [canApprove, notify]);

  const now = Date.now();
  const active = reservations.filter(
    (reservation) =>
      activeStatuses.includes(reservation.status) &&
      new Date(reservation.end).getTime() > now,
  );
  const upcoming = active
    .filter((reservation) => new Date(reservation.start).getTime() > now)
    .sort(
      (first, second) =>
        new Date(first.start).getTime() - new Date(second.start).getTime(),
    );
  const next = upcoming[0];
  const steps =
    user.role === "PEMINJAM"
      ? [
          {
            title: "Cari slot yang benar-benar kosong",
            text: "Filter tanggal, jam, kapasitas, dan jenis ruangan. Hasil hanya menampilkan yang tersedia.",
          },
          {
            title: "Ajukan dalam satu formulir",
            text: "Slot ditahan saat pengajuan tercatat. Status langsung terlihat di tiket reservasi.",
          },
          {
            title: "Pantau keputusan",
            text: "Pengelola menyetujui atau menolak dengan alasan. Anda bisa membatalkan sebelum batas ruangan.",
          },
        ]
      : [
          {
            title: "Tinjau antrean terdekat",
            text: "Pengajuan diurutkan dari waktu pakai paling dekat agar tidak ada yang terlewat.",
          },
          {
            title: "Periksa detail dan bentrok",
            text: "Sistem memeriksa ulang reservasi aktif dan blokir sebelum persetujuan dikunci.",
          },
          {
            title: "Putuskan dengan alasan",
            text: "Penolakan wajib beralasan. Setiap keputusan tercatat atas nama pengelola.",
          },
        ];

  return (
    <div className="stack-xl">
      <section className="overview-hero">
        <div className="overview-hero__copy">
          <p className="mono-label">
            {roleLabel[user.role]} / {formatDateLong(new Date().toISOString())}
          </p>
          <h1>
            Halo, {user.name.split(" ")[0]}
            <span className="accent-dot">.</span>
          </h1>
          <p className="overview-hero__lead">
            {user.role === "PEMINJAM"
              ? "Ruangan kosong sudah menunggu. Cari slot, ajukan, lalu pantau statusnya dari satu tempat."
              : "Antrean pengajuan dan jadwal ruangan Anda tersusun rapi. Mulai dari yang paling dekat waktu pakainya."}
          </p>
          <div className="hero-actions">
            {user.role === "PEMINJAM" ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate("cari")}
              >
                Cari ruangan <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate("persetujuan")}
              >
                Buka antrean <ArrowRight size={18} />
              </button>
            )}
            {user.role === "PEMINJAM" ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onNavigate("reservasi")}
              >
                Reservasi saya
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="overview-hero__board"
          role="group"
          aria-label="Ringkasan cepat"
        >
          <div className="board-head">
            <span className="mono-label">Papan hari ini</span>
            <span className="board-live">
              <span aria-hidden="true" /> WITA
            </span>
          </div>
          <div className="board-slot">
            <span className="board-slot__time">08.00</span>
            <span className="board-slot__line" />
            <span className="board-slot__label">Ruang siap dipakai</span>
          </div>
          <div className="board-slot board-slot--accent">
            <span className="board-slot__time">12.00</span>
            <span className="board-slot__line" />
            <span className="board-slot__label">
              {active.length} reservasi aktif
            </span>
          </div>
          <div className="board-slot">
            <span className="board-slot__time">17.00</span>
            <span className="board-slot__line" />
            <span className="board-slot__label">Jam operasional berakhir</span>
          </div>
          <p className="board-note">
            Slot ditahan hanya setelah pengajuan tercatat di server.
          </p>
        </div>
      </section>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <section className="stat-grid" aria-label="Statistik">
        <StatCard label="Reservasi aktif" value={active.length} />
        <StatCard
          label="Menunggu persetujuan"
          value={
            reservations.filter(
              (reservation) => reservation.status === "MENUNGGU_PERSETUJUAN",
            ).length
          }
        />
        <StatCard
          label="Selesai"
          value={
            reservations.filter(
              (reservation) => reservation.status === "SELESAI",
            ).length
          }
        />
        {canApprove ? (
          <StatCard label="Antrean pengelola" value={approvals.length} />
        ) : (
          <StatCard label="Total reservasi" value={reservations.length} />
        )}
      </section>

      <div className="overview-columns">
        <section className="panel" aria-labelledby="agenda-title">
          <div className="panel-heading">
            <div>
              <p className="mono-label">Jadwal terdekat</p>
              <h2 id="agenda-title">Agenda Anda</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate("reservasi")}
            >
              Lihat semua <ArrowRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="skeleton-list">
              <div className="skeleton" aria-hidden="true">
                <span />
                <span style={{ width: "62%" }} />
              </div>
              <div className="skeleton" aria-hidden="true">
                <span />
                <span style={{ width: "48%" }} />
              </div>
            </div>
          ) : next ? (
            <article className="agenda-card">
              <DateChip iso={next.start} tone="accent" />
              <div className="agenda-card__body">
                <div className="agenda-card__top">
                  <StatusBadge status={next.status} />
                  <span className="mono-label">
                    {formatTimeRange(next.start, next.end)}
                  </span>
                </div>
                <h3>{next.activityName}</h3>
                <p>
                  {next.room.name} · {next.room.building}, lantai{" "}
                  {next.room.floor}
                </p>
              </div>
            </article>
          ) : (
            <EmptyState
              title="Belum ada agenda"
              action={
                user.role === "PEMINJAM" ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onNavigate("cari")}
                  >
                    Cari ruangan <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onNavigate("persetujuan")}
                  >
                    Buka antrean <ArrowRight size={16} />
                  </button>
                )
              }
            >
              {user.role === "PEMINJAM"
                ? "Reservasi yang Anda ajukan akan muncul di sini."
                : "Antrean pengajuan terdekat muncul di bagian bawah halaman ini."}
            </EmptyState>
          )}
        </section>

        <section className="panel" aria-labelledby="steps-title">
          <div className="panel-heading">
            <div>
              <p className="mono-label">Alur singkat</p>
              <h2 id="steps-title">Tiga langkah, satu ruangan.</h2>
            </div>
          </div>
          <ol className="step-list">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {canApprove && approvals.length > 0 ? (
        <section className="panel panel--flush" aria-labelledby="queue-title">
          <div className="panel-heading panel-heading--row">
            <div>
              <p className="mono-label">Butuh keputusan</p>
              <h2 id="queue-title">{approvals.length} pengajuan menunggu</h2>
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onNavigate("persetujuan")}
            >
              Buka antrean <ArrowRight size={16} />
            </button>
          </div>
          <div className="mini-queue">
            {approvals.slice(0, 3).map((approval) => (
              <div className="mini-queue__item" key={approval.id}>
                <span className="mini-queue__time">
                  <Clock size={15} />
                  {formatTimeRange(approval.start, approval.end)}
                </span>
                <strong>{approval.activityName}</strong>
                <span>
                  {approval.room.name} · {approval.user.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
