"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Refresh,
  Search,
} from "@/app/_components/icons";
import {
  formatWitaDate,
  fromWitaDateTime,
  parseTimeOfDay,
  witaMillisecondsOfDay,
} from "@/lib/wita";
import { EmptyState, ErrorNote, Skeleton } from "./ui";
import { roomTypeLabel } from "./ui";
import { getAllReservations, subscribeDemo } from "@/lib/demo-store";
import type { CalendarRoom, CalendarSlot } from "@/lib/calendar";

const WINDOW_START_HOUR = 6;
const WINDOW_END_HOUR = 22;
const WINDOW_START_MS = WINDOW_START_HOUR * 3_600_000;
const WINDOW_MS = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 3_600_000;
const DAY_MS = 86_400_000;

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type CalendarResponse = {
  from: string;
  to: string;
  rooms: CalendarRoom[];
};

const shiftDate = (date: string, days: number) => {
  const base = fromWitaDateTime(date, "00:00");
  if (!base) {
    return date;
  }
  return formatWitaDate(new Date(base.getTime() + days * DAY_MS));
};

const weekdayIndex = (date: string) => {
  const base = fromWitaDateTime(date, "00:00");
  if (!base) {
    return 0;
  }
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    weekday: "short",
  })
    .format(base)
    .toLowerCase();

  const order = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const index = order.indexOf(label);
  return (index + 6) % 7;
};

const slotTone = (slot: CalendarSlot) => {
  if (slot.kind === "BLOKIR") {
    return "block";
  }
  return slot.status === "MENUNGGU_PERSETUJUAN" ? "pending" : "confirmed";
};

const slotLabel = (slot: CalendarSlot) => {
  const start = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(slot.start));
  const end = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(slot.end));

  const status =
    slot.kind === "BLOKIR"
      ? "Diblokir"
      : slot.status === "MENUNGGU_PERSETUJUAN"
        ? "Menunggu persetujuan"
        : "Terkonfirmasi";

  return `${start}–${end} · ${status}`;
};

const percent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

export function CalendarView() {
  const today = formatWitaDate(new Date());
  const [date, setDate] = useState(today);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("semua");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);

  useEffect(() => {
    return subscribeDemo(() => {
      setDemoRevision((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/calendar?date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Kalender gagal dimuat.");
        }

        if (!cancelled) {
          const fromMs = new Date(payload.from as string).getTime();
          const toMs = new Date(payload.to as string).getTime();
          const local = getAllReservations();

          const rooms = (payload.rooms as CalendarRoom[]).map((room) => {
            const blocks = room.slots.filter(
              (slot) => slot.kind === "BLOKIR",
            );
            const reservationSlots: CalendarSlot[] = local
              .filter(
                (reservation) =>
                  reservation.roomId === room.id &&
                  (reservation.status === "MENUNGGU_PERSETUJUAN" ||
                    reservation.status === "TERKONFIRMASI") &&
                  new Date(reservation.start).getTime() < toMs &&
                  new Date(reservation.end).getTime() > fromMs,
              )
              .map((reservation) => ({
                id: reservation.id,
                kind: "RESERVASI" as const,
                start: reservation.start,
                end: reservation.end,
                status: reservation.status,
              }));

            return {
              ...room,
              slots: [...blocks, ...reservationSlots],
            };
          });

          setData({ ...payload, rooms });
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Kalender gagal dimuat.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [date, demoRevision]);

  const week = useMemo(() => {
    const monday = shiftDate(date, -weekdayIndex(date));

    return WEEKDAYS.map((label, index) => {
      const value = shiftDate(monday, index);
      return {
        label,
        date: value,
        day: Number(value.slice(8, 10)),
        month: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Makassar",
          month: "short",
        }).format(fromWitaDateTime(value, "12:00") ?? new Date()),
        isToday: value === today,
      };
    });
  }, [date, today]);

  const roomTypes = useMemo(() => {
    const types = new Set(
      (data?.rooms ?? []).map((room) => room.roomType),
    );
    return [...types].sort();
  }, [data]);

  const visibleRooms = useMemo(() => {
    const rooms = data?.rooms ?? [];
    const search = query.trim().toLowerCase();

    return rooms.filter((room) => {
      if (typeFilter !== "semua" && room.roomType !== typeFilter) {
        return false;
      }

      if (search) {
        const haystack = `${room.name} ${room.building} ${room.floor}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (onlyAvailable) {
        const open = parseTimeOfDay(room.openTime);
        const close = parseTimeOfDay(room.closeTime);
        const isOpen =
          open !== null &&
          close !== null &&
          open * 60_000 < WINDOW_MS &&
          close * 60_000 > 0;
        if (room.slots.length > 0 || !isOpen) {
          return false;
        }
      }

      return true;
    });
  }, [data, query, typeFilter, onlyAvailable]);

  const stats = useMemo(() => {
    const rooms = data?.rooms ?? [];
    const total = rooms.length;

    let terpakai = 0;
    let diblokir = 0;
    let tersedia = 0;

    for (const room of rooms) {
      const hasReservation = room.slots.some(
        (slot) => slot.kind === "RESERVASI",
      );
      const hasBlock = room.slots.some((slot) => slot.kind === "BLOKIR");

      if (hasReservation) terpakai += 1;
      if (hasBlock) diblokir += 1;
      if (!hasReservation && !hasBlock) tersedia += 1;
    }

    return { total, terpakai, diblokir, tersedia };
  }, [data]);

  const axisTicks = [6, 9, 12, 15, 18, 22];

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Kalender ruangan</p>
          <h1>Yang sedang terpakai, sekilas terlihat.</h1>
          <p className="page-head__lead">
            Jadwal pemakaian dan slot yang diblokir untuk semua ruangan aktif.
            Detail peminjam tidak ditampilkan.
          </p>
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            className="icon-button"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Hari sebelumnya"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setDate(today)}
          >
            <CalendarIcon size={17} /> Hari ini
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Hari berikutnya"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="week-strip" aria-label="Pilih hari">
        {week.map((day) => (
          <button
            key={day.date}
            type="button"
            className={`week-strip__day${day.date === date ? " is-active" : ""}`}
            onClick={() => setDate(day.date)}
            aria-current={day.date === date ? "date" : undefined}
          >
            <span className="week-strip__label">{day.label}</span>
            <strong>{day.day}</strong>
            <small>{day.month}</small>
            {day.isToday ? <i aria-hidden="true" /> : null}
          </button>
        ))}
      </section>

      <section className="calendar-panel" aria-label="Jadwal pemakaian ruangan">
        <div className="calendar-panel__head">
          <div
            className="calendar-legend"
            role="group"
            aria-label="Keterangan warna"
          >
            <span className="legend legend--confirmed">Terkonfirmasi</span>
            <span className="legend legend--pending">Menunggu persetujuan</span>
            <span className="legend legend--block">Diblokir</span>
            <span className="legend legend--closed">Di luar jam operasional</span>
          </div>

          <div className="calendar-filters">
            <label className="search-input">
              <Search size={17} />
              <span className="sr-only">Cari ruangan</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari ruangan"
              />
            </label>
            <label className="field field--inline">
              <span className="sr-only">Jenis ruangan</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="semua">Semua jenis</option>
                {roomTypes.map((type) => (
                  <option key={type} value={type}>
                    {roomTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="switch-field switch-field--inline">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
              />
              <span>Hanya yang tersedia</span>
            </label>
          </div>
        </div>

        <div className="calendar-summary">
          <div>
            <span className="mono-label">Ringkasan hari ini</span>
            <p>
              <strong>{stats.terpakai}</strong> terpakai ·{" "}
              <strong>{stats.diblokir}</strong> diblokir ·{" "}
              <strong>{stats.tersedia}</strong> tersedia dari {stats.total}{" "}
              ruangan
            </p>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setDate(date)}
            disabled={loading}
          >
            <Refresh size={16} /> Muat ulang
          </button>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {loading ? (
          <div className="calendar-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="calendar-row" key={index}>
                <div className="calendar-row__room">
                  <Skeleton lines={2} />
                </div>
                <div className="calendar-row__track">
                  <Skeleton lines={1} />
                </div>
              </div>
            ))}
          </div>
        ) : visibleRooms.length === 0 ? (
          <EmptyState title="Tidak ada ruangan yang cocok">
            Ubah kata kunci atau filter jenis ruangan untuk melihat jadwal lain.
          </EmptyState>
        ) : (
          <div className="calendar-grid">
            <div className="calendar-axis" aria-hidden="true">
              <span className="calendar-row__room" />
              <span className="calendar-axis__ticks">
                {axisTicks.map((hour) => (
                  <i
                    key={hour}
                    style={{
                      left: percent(
                        ((hour * 3_600_000 - WINDOW_START_MS) / WINDOW_MS) * 100,
                      ),
                    }}
                  >
                    {String(hour).padStart(2, "0")}.00
                  </i>
                ))}
              </span>
            </div>

            {visibleRooms.map((room) => {
              const open = parseTimeOfDay(room.openTime);
              const close = parseTimeOfDay(room.closeTime);
              const openMs = open === null ? 0 : open * 60_000;
              const closeMs = close === null ? WINDOW_MS : close * 60_000;

              return (
                <div className="calendar-row" key={room.id}>
                  <div className="calendar-row__room">
                    <strong>{room.name}</strong>
                    <span>
                      {room.building} · {roomTypeLabel(room.roomType)}
                    </span>
                  </div>

                  <div className="calendar-row__track">
                    {openMs > WINDOW_START_MS ? (
                      <span
                        className="calendar-closed"
                        style={{
                          left: "0%",
                          width: percent(
                            ((openMs - WINDOW_START_MS) / WINDOW_MS) * 100,
                          ),
                        }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {closeMs < WINDOW_MS ? (
                      <span
                        className="calendar-closed"
                        style={{
                          left: percent(
                            ((closeMs - WINDOW_START_MS) / WINDOW_MS) * 100,
                          ),
                          width: percent(
                            ((WINDOW_MS - closeMs) / WINDOW_MS) * 100,
                          ),
                        }}
                        aria-hidden="true"
                      />
                    ) : null}

                    {room.slots.map((slot) => {
                      const startMs = witaMillisecondsOfDay(new Date(slot.start));
                      const endMs = witaMillisecondsOfDay(new Date(slot.end));
                      const left =
                        ((startMs - WINDOW_START_MS) / WINDOW_MS) * 100;
                      const width = ((endMs - startMs) / WINDOW_MS) * 100;

                      return (
                        <span
                          key={slot.id}
                          className={`calendar-slot calendar-slot--${slotTone(slot)}`}
                          style={{
                            left: percent(left),
                            width: percent(width),
                          }}
                          title={`${room.name} · ${slotLabel(slot)}`}
                          aria-label={`${room.name}, ${slotLabel(slot)}`}
                        />
                      );
                    })}
                  </div>

                  <div className="calendar-row__slots">
                    {room.slots.length === 0 ? (
                      <span className="calendar-free">Tersedia</span>
                    ) : (
                      room.slots.map((slot) => (
                        <span
                          key={slot.id}
                          className={`calendar-chip calendar-chip--${slotTone(slot)}`}
                        >
                          {slotLabel(slot)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
