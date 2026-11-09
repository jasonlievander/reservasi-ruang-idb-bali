import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import {
  CalendarError,
  calendarErrorStatus,
  getRoomCalendar,
} from "@/lib/calendar";
import { formatWitaDate, fromWitaDateTime } from "@/lib/wita";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const daysParam = url.searchParams.get("days");

  const date = dateParam ?? formatWitaDate(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Format tanggal harus YYYY-MM-DD.",
    );
  }

  const days = daysParam === null ? 1 : Number(daysParam);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Parameter days harus berupa bilangan bulat 1 sampai 7.",
    );
  }

  const from = fromWitaDateTime(date, "00:00");

  if (!from) {
    return jsonError(400, "INVALID_INPUT", "Tanggal tidak valid.");
  }

  const to = new Date(from.getTime() + days * 86_400_000);

  try {
    const calendar = await getRoomCalendar({ from, to });
    return NextResponse.json(calendar);
  } catch (error) {
    if (error instanceof CalendarError) {
      return jsonError(
        calendarErrorStatus[error.code],
        error.code,
        error.message,
        error.fieldErrors,
      );
    }
    throw error;
  }
}
