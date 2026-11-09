import { describe, expect, it } from "vitest";
import { fromWitaDateTime } from "@/lib/wita";
import {
  validateParticipantCount,
  validateReservation,
  validateTimeRange,
  type RoomRules,
} from "@/lib/validation";

const at = (date: string, time: string): Date => {
  const value = fromWitaDateTime(date, time);
  if (!value) {
    throw new Error(`Tanggal uji tidak valid: ${date} ${time}`);
  }
  return value;
};

const now = at("2026-10-21", "07:00");

const room = (overrides: Partial<RoomRules> = {}): RoomRules => ({
  capacity: 20,
  openTime: "08:00",
  closeTime: "17:00",
  maxDurationMinutes: 180,
  ...overrides,
});

describe("BR-01 validasi waktu", () => {
  it("menerima rentang yang valid di dalam jam operasional", () => {
    const result = validateReservation(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "09:00"),
        participantCount: 10,
      },
      room(),
      now,
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("menolak mulai sama dengan selesai", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "08:00"),
      },
      room(),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "end",
        code: "START_NOT_BEFORE_END",
      }),
    );
  });

  it("menolak selesai sebelum mulai", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "09:00"),
        end: at("2026-10-21", "08:00"),
      },
      room(),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "end",
        code: "START_NOT_BEFORE_END",
      }),
    );
  });

  it("menerima tepat di jam buka dan tepat di jam tutup", () => {
    const result = validateReservation(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "17:00"),
        participantCount: 1,
      },
      room({ maxDurationMinutes: 600 }),
      now,
    );

    expect(result.valid).toBe(true);
  });

  it("menolak mulai sebelum jam buka", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "07:59"),
        end: at("2026-10-21", "09:00"),
      },
      room(),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "start",
        code: "OUTSIDE_OPERATING_HOURS",
      }),
    );
  });

  it("menolak selesai setelah jam tutup", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "16:00"),
        end: at("2026-10-21", "17:01"),
      },
      room(),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "end",
        code: "OUTSIDE_OPERATING_HOURS",
      }),
    );
  });

  it("menolak waktu mulai di masa lalu", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "09:00"),
      },
      room(),
      at("2026-10-21", "08:30"),
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "start",
        code: "START_IN_PAST",
      }),
    );
  });

  it("menolak durasi melebihi batas ruangan", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "10:01"),
      },
      room({ maxDurationMinutes: 120 }),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "end",
        code: "EXCEEDS_MAX_DURATION",
      }),
    );
  });

  it("menerima durasi tepat sama dengan batas", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "10:00"),
      },
      room({ maxDurationMinutes: 120 }),
      now,
    );

    expect(errors).toEqual([]);
  });

  it("menolak tanggal tidak valid", () => {
    const errors = validateTimeRange(
      {
        start: new Date("bukan tanggal"),
        end: at("2026-10-21", "09:00"),
      },
      room(),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "start",
        code: "INVALID_DATE",
      }),
    );
  });

  it("menolak konfigurasi jam ruangan yang tidak valid", () => {
    const errors = validateTimeRange(
      {
        start: at("2026-10-21", "08:00"),
        end: at("2026-10-21", "09:00"),
      },
      room({ openTime: "17:00", closeTime: "08:00" }),
      now,
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: "INVALID_ROOM_SCHEDULE",
      }),
    );
  });
});

describe("BR-05 validasi kapasitas", () => {
  it("menerima jumlah peserta sama dengan kapasitas", () => {
    expect(validateParticipantCount(20, 20)).toEqual([]);
  });

  it("menolak jumlah peserta melebihi kapasitas", () => {
    expect(validateParticipantCount(21, 20)).toContainEqual(
      expect.objectContaining({
        field: "participantCount",
        code: "EXCEEDS_CAPACITY",
      }),
    );
  });

  it("menolak jumlah peserta nol atau negatif", () => {
    for (const count of [0, -1]) {
      expect(validateParticipantCount(count, 20)).toContainEqual(
        expect.objectContaining({
          code: "PARTICIPANTS_OUT_OF_RANGE",
        }),
      );
    }
  });

  it("menolak jumlah peserta bukan bilangan bulat", () => {
    expect(validateParticipantCount(1.5, 20)).toContainEqual(
      expect.objectContaining({
        code: "PARTICIPANTS_OUT_OF_RANGE",
      }),
    );
  });
});
