import {
  parseTimeOfDay,
  witaMillisecondsOfDay,
} from "@/lib/wita";

const MS_PER_MINUTE = 60_000;

export type RoomRules = {
  capacity: number;
  openTime: string;
  closeTime: string;
  maxDurationMinutes: number;
};

export type ReservationValidationInput = {
  start: Date;
  end: Date;
  participantCount: number;
};

export type ValidationField = "start" | "end" | "participantCount";

export type ValidationCode =
  | "INVALID_DATE"
  | "START_NOT_BEFORE_END"
  | "START_IN_PAST"
  | "INVALID_ROOM_SCHEDULE"
  | "OUTSIDE_OPERATING_HOURS"
  | "EXCEEDS_MAX_DURATION"
  | "PARTICIPANTS_OUT_OF_RANGE"
  | "EXCEEDS_CAPACITY";

export type ValidationError = {
  field: ValidationField;
  code: ValidationCode;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

const result = (errors: ValidationError[]): ValidationResult => ({
  valid: errors.length === 0,
  errors,
});

const isValidDate = (value: Date) =>
  value instanceof Date && !Number.isNaN(value.getTime());

export function validateParticipantCount(
  participantCount: number,
  capacity: number,
): ValidationError[] {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    return [
      {
        field: "participantCount",
        code: "PARTICIPANTS_OUT_OF_RANGE",
        message: "Jumlah peserta harus bilangan bulat minimal 1.",
      },
    ];
  }

  if (participantCount > capacity) {
    return [
      {
        field: "participantCount",
        code: "EXCEEDS_CAPACITY",
        message: `Jumlah peserta melebihi kapasitas ruangan (${capacity}).`,
      },
    ];
  }

  return [];
}

export function validateTimeRange(
  input: Pick<ReservationValidationInput, "start" | "end">,
  room: Pick<RoomRules, "openTime" | "closeTime" | "maxDurationMinutes">,
  now: Date = new Date(),
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isValidDate(input.start)) {
    errors.push({
      field: "start",
      code: "INVALID_DATE",
      message: "Waktu mulai tidak valid.",
    });
  }

  if (!isValidDate(input.end)) {
    errors.push({
      field: "end",
      code: "INVALID_DATE",
      message: "Waktu selesai tidak valid.",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  if (input.start.getTime() >= input.end.getTime()) {
    errors.push({
      field: "end",
      code: "START_NOT_BEFORE_END",
      message: "Waktu selesai harus setelah waktu mulai.",
    });
    return errors;
  }

  if (input.start.getTime() < now.getTime()) {
    errors.push({
      field: "start",
      code: "START_IN_PAST",
      message: "Waktu mulai tidak boleh di masa lalu.",
    });
  }

  const openMinutes = parseTimeOfDay(room.openTime);
  const closeMinutes = parseTimeOfDay(room.closeTime);

  if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
    errors.push({
      field: "start",
      code: "INVALID_ROOM_SCHEDULE",
      message: "Jadwal operasional ruangan tidak valid.",
    });
    return errors;
  }

  const startOfDay = witaMillisecondsOfDay(input.start);
  const endOfDay = witaMillisecondsOfDay(input.end);
  const openMs = openMinutes * MS_PER_MINUTE;
  const closeMs = closeMinutes * MS_PER_MINUTE;

  if (startOfDay < openMs) {
    errors.push({
      field: "start",
      code: "OUTSIDE_OPERATING_HOURS",
      message: `Waktu mulai harus di dalam jam operasional ${room.openTime}-${room.closeTime} WITA.`,
    });
  }

  if (endOfDay > closeMs) {
    errors.push({
      field: "end",
      code: "OUTSIDE_OPERATING_HOURS",
      message: `Waktu selesai harus di dalam jam operasional ${room.openTime}-${room.closeTime} WITA.`,
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  const durationMinutes =
    (input.end.getTime() - input.start.getTime()) / MS_PER_MINUTE;

  if (durationMinutes > room.maxDurationMinutes) {
    errors.push({
      field: "end",
      code: "EXCEEDS_MAX_DURATION",
      message: `Durasi reservasi melebihi batas ${room.maxDurationMinutes} menit.`,
    });
  }

  return errors;
}

export function validateReservation(
  input: ReservationValidationInput,
  room: RoomRules,
  now: Date = new Date(),
): ValidationResult {
  const timeErrors = validateTimeRange(input, room, now);

  if (
    timeErrors.some(
      (error) =>
        error.code === "INVALID_DATE" ||
        error.code === "START_NOT_BEFORE_END" ||
        error.code === "INVALID_ROOM_SCHEDULE",
    )
  ) {
    return result(timeErrors);
  }

  const participantErrors = validateParticipantCount(
    input.participantCount,
    room.capacity,
  );

  return result([...timeErrors, ...participantErrors]);
}
