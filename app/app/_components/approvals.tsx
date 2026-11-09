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
  approvalCardFileName,
  downloadDataUrl,
  generateApprovalCardDataUrl,
} from "@/lib/approval-card-client";
import {
  approveDemoReservation,
  getApprovalHistory,
  getPendingApprovals,
  rejectDemoReservation,
  subscribeDemo,
} from "@/lib/demo-store";
import {
  DateChip,
  EmptyState,
  ErrorNote,
  formatDateLong,
  formatTimeRange,
} from "./ui";
import type { Approval, SessionUser } from "@/app/app/types";

type Action = "approve" | "reject";

export function ApprovalQueue({ user }: { user: SessionUser }) {
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
  const [cardBusyId, setCardBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setApprovals(getPendingApprovals() as Approval[]);
      setHistory(getApprovalHistory() as Approval[]);
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
    return subscribeDemo(() => {
      void load();
    });
  }, [load]);

  const openAction = (approval: Approval, nextAction: Action) => {
    setTarget(approval);
    setAction(nextAction);
    setNote("");
    setActionError(null);
  };

  const downloadCard = async (item: Approval) => {
    setCardBusyId(item.id);
    try {
      const history = (
        item as unknown as {
          history?: Array<{ newStatus: string; actorId: string | null }>;
        }
      ).history;
      const approvedEntry = [...(history ?? [])]
        .reverse()
        .find((entry) => entry.newStatus === "TERKONFIRMASI");

      const dataUrl = await generateApprovalCardDataUrl({
        reservationId: item.id,
        roomName: item.room.name,
        building: item.room.building,
        floor: item.room.floor,
        start: new Date(item.start),
        end: new Date(item.end),
        activityName: item.activityName,
        participantCount: item.participantCount,
        borrowerName: item.user.name,
        approverName:
          approvedEntry?.actorId === user.id ? user.name : null,
      });

      downloadDataUrl(dataUrl, approvalCardFileName(item.id));
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Kartu gagal dibuat.",
        "error",
      );
    } finally {
      setCardBusyId(null);
    }
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
      if (action === "approve") {
        approveDemoReservation(target.id, user.id, note.trim() || null);
      } else {
        rejectDemoReservation(target.id, user.id, note.trim());
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
                  <button
                    type="button"
                    className="btn btn--dark"
                    onClick={() => void downloadCard(item)}
                    disabled={cardBusyId === item.id}
                    aria-busy={cardBusyId === item.id}
                  >
                    <Download size={17} />
                    {cardBusyId === item.id ? "Menyiapkan..." : "Kartu"}
                  </button>
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
