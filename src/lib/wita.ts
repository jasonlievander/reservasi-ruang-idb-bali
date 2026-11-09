export const WITA_OFFSET_MINUTES = 8 * 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export type WitaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  weekday: number;
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function getWitaParts(date: Date): WitaParts {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Tanggal tidak valid");
  }

  const shifted = new Date(date.getTime() + WITA_OFFSET_MINUTES * MS_PER_MINUTE);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatWitaDate(date: Date): string {
  const parts = getWitaParts(date);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatWitaTime(date: Date): string {
  const parts = getWitaParts(date);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatWitaDateTime(date: Date): string {
  return `${formatWitaDate(date)} ${formatWitaTime(date)}`;
}

export function witaMillisecondsOfDay(date: Date): number {
  const parts = getWitaParts(date);
  return (
    ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 +
    parts.millisecond
  );
}

export function isSameWitaDay(first: Date, second: Date): boolean {
  return formatWitaDate(first) === formatWitaDate(second);
}

export function parseTimeOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function fromWitaDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const localMs = Date.UTC(year, month - 1, day, hour, minute);

  const check = new Date(localMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(localMs - WITA_OFFSET_MINUTES * MS_PER_MINUTE);
}

export function startOfWitaDay(date: Date): Date {
  const parts = getWitaParts(date);
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) -
      WITA_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}

export function addWitaDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
