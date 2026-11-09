import { describe, expect, it } from "vitest";
import {
  addWitaDays,
  formatWitaDate,
  formatWitaDateTime,
  formatWitaTime,
  fromWitaDateTime,
  getWitaParts,
  isSameWitaDay,
  parseTimeOfDay,
  startOfWitaDay,
  witaMillisecondsOfDay,
} from "@/lib/wita";

describe("BR-08 konversi WITA", () => {
  it("menggeser UTC 16:30 ke hari berikutnya pukul 00:30 WITA", () => {
    const date = new Date("2026-01-01T16:30:00.000Z");

    expect(formatWitaDate(date)).toBe("2026-01-02");
    expect(formatWitaTime(date)).toBe("00:30");
    expect(formatWitaDateTime(date)).toBe("2026-01-02 00:30");
    expect(getWitaParts(date)).toMatchObject({
      year: 2026,
      month: 1,
      day: 2,
      hour: 0,
      minute: 30,
    });
  });

  it("tetap di hari yang sama pada UTC 15:59", () => {
    const date = new Date("2026-01-01T15:59:00.000Z");

    expect(formatWitaDate(date)).toBe("2026-01-01");
    expect(formatWitaTime(date)).toBe("23:59");
  });

  it("memetakan pergantian tahun WITA dengan benar", () => {
    const date = new Date("2025-12-31T16:00:00.000Z");

    expect(formatWitaDateTime(date)).toBe("2026-01-01 00:00");
  });

  it("mengubah tanggal dan jam WITA menjadi UTC", () => {
    const date = fromWitaDateTime("2026-01-02", "00:30");

    expect(date?.toISOString()).toBe("2026-01-01T16:30:00.000Z");
  });

  it("menolak tanggal kalender yang tidak ada", () => {
    expect(fromWitaDateTime("2026-02-30", "08:00")).toBeNull();
    expect(fromWitaDateTime("2026-13-01", "08:00")).toBeNull();
    expect(fromWitaDateTime("2026-01-01", "24:00")).toBeNull();
  });

  it("membandingkan hari berdasarkan WITA, bukan UTC", () => {
    const first = new Date("2026-01-01T16:30:00.000Z");
    const second = new Date("2026-01-01T23:00:00.000Z");

    expect(isSameWitaDay(first, second)).toBe(true);
  });

  it("menghitung awal hari WITA", () => {
    const date = new Date("2026-01-01T16:30:00.000Z");

    expect(startOfWitaDay(date).toISOString()).toBe(
      "2026-01-01T16:00:00.000Z",
    );
  });

  it("menambah hari tanpa terpengaruh zona waktu lokal server", () => {
    const date = fromWitaDateTime("2026-01-01", "08:00");
    const next = addWitaDays(date as Date, 1);

    expect(formatWitaDateTime(next)).toBe("2026-01-02 08:00");
  });

  it("menghitung milidetik sejak tengah malam WITA", () => {
    const date = fromWitaDateTime("2026-01-01", "08:15");

    expect(witaMillisecondsOfDay(date as Date)).toBe(8 * 60 * 60_000 + 15 * 60_000);
  });

  it("mem-parse jam operasional", () => {
    expect(parseTimeOfDay("08:00")).toBe(480);
    expect(parseTimeOfDay("23:59")).toBe(1439);
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("8:00")).toBeNull();
  });
});
