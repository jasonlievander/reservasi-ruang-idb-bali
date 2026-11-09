"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Close,
  MapPin,
  Plus,
  Refresh,
  Search,
  Users,
} from "@/app/_components/icons";
import { fromWitaDateTime, formatWitaDate } from "@/lib/wita";
import { useToast } from "./toast";
import { Modal } from "./modal";
import {
  EmptyState,
  ErrorNote,
  Skeleton,
  formatDateLong,
  formatTimeRange,
  roomTypeLabel,
} from "./ui";
import type { Room, SlotBlock } from "@/app/app/types";

type Settings = {
  requiresApproval: boolean;
  maxDurationMinutes: number;
  cancellationDeadlineMinutes: number;
  attachmentRequired: boolean;
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatWitaDate(date);
};

export function RoomManager() {
  const { notify } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [blocks, setBlocks] = useState<SlotBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockDate, setBlockDate] = useState(tomorrow);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotBlock | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [roomQuery, setRoomQuery] = useState("");

  const selectedRoom = rooms.find((room) => room.id === selectedId) ?? null;
  const normalizedQuery = roomQuery.trim().toLowerCase();
  const filteredRooms = normalizedQuery
    ? rooms.filter((room) =>
        [
          room.name,
          room.building,
          `${room.building} lantai ${room.floor}`,
          room.floor,
          roomTypeLabel(room.roomType),
        ].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : rooms;

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/rooms?managed=true", {
        cache: "no-store",
      });
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
      setLoading(false);
    }
  }, []);

  const loadBlocks = useCallback(async (roomId: string) => {
    if (!roomId) {
      setBlocks([]);
      return;
    }

    setBlocksLoading(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/blocks`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat blokir.");
      }
      setBlocks(payload.blocks ?? []);
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Gagal memuat blokir.",
        "error",
      );
    } finally {
      setBlocksLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoom) {
      setSettings(null);
      return;
    }

    setSettings({
      requiresApproval: selectedRoom.requiresApproval,
      maxDurationMinutes: selectedRoom.maxDurationMinutes,
      cancellationDeadlineMinutes: selectedRoom.cancellationDeadlineMinutes,
      attachmentRequired: selectedRoom.attachmentRequired,
    });
    void loadBlocks(selectedRoom.id);
  }, [selectedRoom, loadBlocks]);

  const saveSettings = async () => {
    if (!selectedRoom || !settings) return;
    setSaving(true);

    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal menyimpan aturan.");
      }

      setRooms((current) =>
        current.map((room) =>
          room.id === selectedRoom.id ? { ...room, ...payload.room } : room,
        ),
      );
      notify("Aturan ruangan diperbarui.", "success");
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Gagal menyimpan aturan.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const createBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoom) return;

    const start = fromWitaDateTime(blockDate, blockStart);
    const end = fromWitaDateTime(blockDate, blockEnd);

    if (!start || !end) {
      setBlockError("Tanggal atau jam tidak valid.");
      return;
    }

    setBlockBusy(true);
    setBlockError(null);

    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}/blocks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start: start.toISOString(),
          end: end.toISOString(),
          reason: blockReason,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Blokir gagal dibuat.");
      }

      setBlockReason("");
      notify("Slot diblokir. Ruangan tidak muncul pada rentang itu.", "success");
      await loadBlocks(selectedRoom.id);
    } catch (cause) {
      setBlockError(
        cause instanceof Error ? cause.message : "Blokir gagal dibuat.",
      );
    } finally {
      setBlockBusy(false);
    }
  };

  const removeBlock = async () => {
    if (!selectedRoom || !deleteTarget) return;
    setDeleteBusy(true);

    try {
      const response = await fetch(
        `/api/rooms/${selectedRoom.id}/blocks/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Blokir gagal dihapus.");
      }

      notify("Blokir dihapus. Slot kembali tersedia.", "success");
      setDeleteTarget(null);
      await loadBlocks(selectedRoom.id);
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Blokir gagal dihapus.",
        "error",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Ruangan yang Anda kelola</p>
          <h1>Atur ruang, jaga waktunya.</h1>
          <p className="page-head__lead">
            Ubah aturan dasar dan blokir slot untuk perawatan, kuliah, atau
            kegiatan kampus.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void loadRooms()}
          disabled={loading}
        >
          <Refresh size={17} /> Muat ulang
        </button>
      </section>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {loading ? (
        <div className="panel">
          <Skeleton lines={4} />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState title="Belum ada ruangan yang ditugaskan">
          Hubungi admin untuk menugaskan Anda sebagai pengelola ruangan.
        </EmptyState>
      ) : (
        <div className="manager-grid">
          <aside className="panel room-picker">
            <div className="panel-heading room-picker__heading">
              <p className="mono-label">Pilih ruangan</p>
              <h2>Daftar ruangan</h2>
            </div>
            <label className="search-input room-picker__search">
              <Search size={16} />
              <span className="sr-only">Cari ruangan</span>
              <input
                value={roomQuery}
                onChange={(event) => setRoomQuery(event.target.value)}
                placeholder="Cari nama atau gedung"
              />
            </label>
            <p className="room-picker__count" aria-live="polite">
              {filteredRooms.length} ruangan
            </p>
            <div className="room-picker__list">
              {filteredRooms.length === 0 ? (
                <p className="room-picker__empty">
                  Tidak ada ruangan yang cocok dengan pencarian.
                </p>
              ) : (
                filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className={`room-picker__item${room.id === selectedId ? " is-active" : ""}`}
                    onClick={() => setSelectedId(room.id)}
                  >
                    <span className="room-picker__type">
                      {roomTypeLabel(room.roomType)}
                    </span>
                    <strong>{room.name}</strong>
                    <span>
                      {room.building}, lantai {room.floor}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="stack-l">
            {selectedRoom ? (
              <>
                <section className="panel">
                  <div className="panel-heading panel-heading--row">
                    <div>
                      <p className="mono-label">
                        {roomTypeLabel(selectedRoom.roomType)}
                      </p>
                      <h2>{selectedRoom.name}</h2>
                    </div>
                    <span className="badge badge--outline">
                      {selectedRoom.requiresApproval
                        ? "Butuh persetujuan"
                        : "Langsung terkonfirmasi"}
                    </span>
                  </div>
                  {selectedRoom.photoUrl ? (
                    <div className="room-detail-photo">
                      <Image
                        src={selectedRoom.photoUrl}
                        alt={`Foto ${selectedRoom.name}`}
                        width={800}
                        height={360}
                        className="room-detail-photo__image"
                      />
                    </div>
                  ) : null}
                  <div className="room-detail-meta">
                    <span>
                      <MapPin size={16} />
                      {selectedRoom.building}, lantai {selectedRoom.floor}
                    </span>
                    <span>
                      <Users size={16} />
                      {selectedRoom.capacity} orang
                    </span>
                    <span>
                      <Clock size={16} />
                      {selectedRoom.openTime}–{selectedRoom.closeTime} WITA
                    </span>
                  </div>

                  {settings ? (
                    <div className="settings-grid">
                      <label className="switch-field">
                        <span>
                          <strong>Butuh persetujuan</strong>
                          <small>Pengajuan menunggu keputusan pengelola.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.requiresApproval}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              requiresApproval: event.target.checked,
                            })
                          }
                        />
                      </label>
                      <label className="switch-field">
                        <span>
                          <strong>Wajib lampiran</strong>
                          <small>Surat atau izin harus ditautkan.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.attachmentRequired}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              attachmentRequired: event.target.checked,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Durasi maksimum (menit)</span>
                        <input
                          type="number"
                          min={1}
                          value={settings.maxDurationMinutes}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              maxDurationMinutes: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Batas pembatalan (menit)</span>
                        <input
                          type="number"
                          min={0}
                          value={settings.cancellationDeadlineMinutes}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              cancellationDeadlineMinutes: Number(
                                event.target.value,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void saveSettings()}
                      disabled={saving}
                      aria-busy={saving}
                    >
                      {saving ? "Menyimpan..." : "Simpan aturan"}
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <p className="mono-label">Blokir slot</p>
                    <h2>Waktu yang tidak bisa dipesan.</h2>
                  </div>

                  <form className="block-form" onSubmit={createBlock}>
                    <label className="field">
                      <span>Tanggal</span>
                      <input
                        type="date"
                        value={blockDate}
                        onChange={(event) => setBlockDate(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Mulai</span>
                      <input
                        type="time"
                        value={blockStart}
                        onChange={(event) => setBlockStart(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Selesai</span>
                      <input
                        type="time"
                        value={blockEnd}
                        onChange={(event) => setBlockEnd(event.target.value)}
                      />
                    </label>
                    <label className="field field--wide">
                      <span>Alasan</span>
                      <input
                        value={blockReason}
                        onChange={(event) => setBlockReason(event.target.value)}
                        placeholder="Contoh: perawatan AC"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn--dark"
                      disabled={blockBusy}
                    >
                      <Plus size={17} />
                      {blockBusy ? "Memblokir..." : "Blokir slot"}
                    </button>
                  </form>

                  {blockError ? <ErrorNote>{blockError}</ErrorNote> : null}

                  {blocksLoading ? (
                    <Skeleton lines={2} />
                  ) : blocks.length === 0 ? (
                    <p className="muted">
                      Belum ada blokir untuk ruangan ini.
                    </p>
                  ) : (
                    <ul className="block-list">
                      {blocks.map((block) => (
                        <li key={block.id}>
                          <div>
                            <strong>{formatDateLong(block.start)}</strong>
                            <span className="mono-label">
                              {formatTimeRange(block.start, block.end)}
                            </span>
                            <p>{block.reason}</p>
                          </div>
                          <button
                            type="button"
                            className="icon-button icon-button--danger"
                            onClick={() => setDeleteTarget(block)}
                            aria-label="Hapus blokir"
                          >
                            <Close size={17} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus blokir?"
        eyebrow={deleteTarget?.reason}
        footer={
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void removeBlock()}
              disabled={deleteBusy}
              aria-busy={deleteBusy}
            >
              {deleteBusy ? "Menghapus..." : "Hapus blokir"}
            </button>
          </div>
        }
      >
        <p className="modal-lead">
          Slot akan kembali muncul sebagai tersedia. Reservasi yang sudah ada
          tidak berubah.
        </p>
        {deleteTarget ? (
          <div className="decision-summary">
            <strong>{formatDateLong(deleteTarget.start)}</strong>
            <span>{formatTimeRange(deleteTarget.start, deleteTarget.end)}</span>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
