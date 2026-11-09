"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Close,
  Clock,
  Download,
  Refresh,
  Ticket,
  Users,
} from "@/app/_components/icons";
import { useToast } from "./toast";
import { Modal } from "./modal";
import {
  DateChip,
  EmptyState,
  ErrorNote,
  formatDateLong,
  formatTimeRange,
} from "./ui";
import type { Approval } from "@/app/app/types";

type Action = "approve" | "reject";

export function ApprovalQueue() {
  const { notify } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [history, setHistory] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Approval | null>(null);
  const [action, setAction] = useState<Action>("approve");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/approvals", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat antrean.");
      }
      setApprovals(payload.approvals ?? []);
      setHistory(payload.history ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat antrean.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAction = (approval: Approval, nextAction: Action) => {
    setTarget(approval);
    setAction(nextAction);
    setNote("");
    setActionError(null);
  };

  const submit = async () => {
    if (!target) return;

    if (action === "reject" && !note.trim()) {
      setActionError("Alasan penolakan wajib diisi.");
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/approvals/${target.id}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: note.trim() || null }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Keputusan gagal disimpan.");
      }

      notify(
        action === "approve"
          ? "Pengajuan disetujui. Slot terkonfirmasi."
          : "Pengajuan ditolak. Slot dilepas.",
        "success",
      );
      setTarget(null);
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Keputusan gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Antrean persetujuan</p>
          <h1>Keputusan yang tidak menunggu.</h1>
          <p className="page-head__lead">
            Diurutkan dari waktu pakai terdekat. Periksa detail, lalu setujui
            atau tolak dengan alasan yang jelas.
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

      <div className="queue-summary">
        <span className="mono-label">Menunggu keputusan</span>
        <strong>{approvals.length}</strong>
        <span>pengajuan</span>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {loading ? (
        <div className="approval-list" aria-busy="true">
          {[0, 1].map((item) => (
            <div className="approval-card" key={item}>
              <div className="skeleton" aria-hidden="true">
                <span />
                <span style={{ width: "55%" }} />
                <span style={{ width: "78%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState title="Antrean bersih">
          Tidak ada pengajuan yang menunggu. Pengajuan baru akan muncul di sini
          sesuai ruangan yang Anda kelola.
        </EmptyState>
      ) : (
        <div className="approval-list">
          {approvals.map((approval) => {
            const pastDeadline = false;

            return (
            <article className="approval-card" key={approval.id}>
              <DateChip iso={approval.start} tone="accent" />
              <div className="approval-card__body">
                <div className="approval-card__top">
                  <div>
                    <p className="mono-label">
                      {formatDateLong(approval.start)}
                    </p>
                    <h2>{approval.activityName}</h2>
                  </div>
                  <span className="approval-card__time">
                    <span className="mono-label">
                      {formatTimeRange(approval.start, approval.end)}
                    </span>
                  </span>
                </div>

                <div className="approval-meta">
                  <span>
                    <Ticket size={15} />
                    {approval.room.name} · {approval.room.building}, lantai{" "}
                    {approval.room.floor}
                  </span>
                  <span>
                    <Users size={15} />
                    {approval.participantCount} peserta ·{" "}
                    {approval.type === "ORGANISASI"
                      ? approval.organization?.name ?? "Organisasi"
                      : "Pribadi"}
                  </span>
                  <span>
                    <Clock size={15} />
                    Diajukan{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      timeZone: "Asia/Makassar",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(approval.createdAt))}{" "}
                    WITA
                  </span>
                </div>

                <p className="requester">
                  <span className="avatar avatar--sm" aria-hidden="true">
                    {approval.user.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span>
                    <strong>{approval.user.name}</strong>
                    <small>{approval.user.email}</small>
                  </span>
                </p>

                {approval.attachmentUrl ? (
                  <a
                    className="inline-link"
                    href={approval.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka lampiran
                  </a>
                ) : null}

                {pastDeadline ? (
                  <p className="inline-note">
                    Batas keputusan sudah lewat.
                  </p>
                ) : null}
              </div>

              <div className="approval-card__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openAction(approval, "approve")}
                  disabled={pastDeadline}
                >
                  <Check size={17} /> Setujui
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => openAction(approval, "reject")}
                  disabled={pastDeadline}
                >
                  <Close size={17} /> Tolak
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <section className="panel" aria-labelledby="approval-history-title">
        <div className="panel-heading panel-heading--row">
          <div>
            <p className="mono-label">Riwayat persetujuan</p>
            <h2 id="approval-history-title">Kartu yang sudah terbit</h2>
          </div>
          <span className="muted">
            {loading ? "Memuat..." : `${history.length} kartu`}
          </span>
        </div>

        {!loading && history.length === 0 ? (
          <p className="muted">
            Belum ada pengajuan yang disetujui untuk ruangan Anda.
          </p>
        ) : !loading ? (
          <div className="approval-list">
            {history.map((item) => (
              <article className="approval-card" key={item.id}>
                <DateChip iso={item.start} tone="accent" />
                <div className="approval-card__body">
                  <div className="approval-card__top">
                    <div>
                      <p className="mono-label">
                        {formatDateLong(item.start)}
                      </p>
                      <h2>{item.activityName}</h2>
                    </div>
                    <span className="approval-card__time">
                      <span className="mono-label">
                        {formatTimeRange(item.start, item.end)}
                      </span>
                    </span>
                  </div>

                  <div className="approval-meta">
                    <span>
                      <Ticket size={15} />
                      {item.room.name} · {item.room.building}, lantai{" "}
                      {item.room.floor}
                    </span>
                    <span>
                      <Users size={15} />
                      {item.participantCount} peserta · {item.user.name}
                    </span>
                  </div>
                </div>

                <div className="approval-card__actions">
                  {item.approvalCardUrl ? (
                    <a
                      className="btn btn--dark"
                      href={item.approvalCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download size={17} /> Kartu
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={action === "approve" ? "Setujui pengajuan?" : "Tolak pengajuan?"}
        eyebrow={target ? target.activityName : undefined}
        footer={
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTarget(null)}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className={action === "approve" ? "btn btn--primary" : "btn btn--danger"}
              onClick={() => void submit()}
              disabled={busy}
              aria-busy={busy}
            >
              {busy
                ? "Menyimpan..."
                : action === "approve"
                  ? "Setujui"
                  : "Tolak pengajuan"}
            </button>
          </div>
        }
      >
        {target ? (
          <div className="decision-summary">
            <strong>{target.room.name}</strong>
            <span>
              {formatTimeRange(target.start, target.end)} ·{" "}
              {formatDateLong(target.start)}
            </span>
            <span>
              {target.user.name} · {target.participantCount} peserta
            </span>
          </div>
        ) : null}
        <p className="modal-lead">
          {action === "approve"
            ? "Sistem akan memeriksa ulang bentrok dengan blokir dan reservasi aktif sebelum menyetujui."
            : "Alasan penolakan akan ditampilkan kepada peminjam."}
        </p>
        <label className="field">
          <span>
            {action === "approve" ? "Catatan (opsional)" : "Alasan penolakan"}
          </span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              action === "approve"
                ? "Contoh: disetujui untuk kegiatan organisasi"
                : "Contoh: jadwal bentrok dengan kegiatan kampus"
            }
          />
        </label>
        {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}
      </Modal>
    </div>
  );
}
