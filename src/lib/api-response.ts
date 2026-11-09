import { NextResponse } from "next/server";

type ErrorField = {
  field: string;
  code: string;
  message: string;
};

export async function parseJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  fields?: ErrorField[],
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fields && fields.length > 0 ? { fields } : {}),
      },
    },
    { status },
  );
}
