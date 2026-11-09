import fs from "node:fs/promises";
import path from "node:path";
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type SKRSContext2D,
} from "@napi-rs/canvas";

const TEAL = "#007a90";
const ORANGE = "#f68c1e";
const BADGE = "#404041";
const WHITE = "#ffffff";
const INK = "#141414";
const RULE = "#c9c9c9";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const FONT = "Arial";

const LOGO_ICON_SIZE = 230;
const LOGO_ICON_TOP = 45;
const LOGO_TEXT_WIDTH = 640;
const LOGO_TEXT_TOP = 300;
const RULE_Y = 495;

// area ikon puzzle dan area teks pada public/brand/idb-logo.png (813x532)
const LOGO_ICON_SRC = { x: 522, y: 0, size: 288 };
const LOGO_TEXT_SRC = { x: 0, y: 338, width: 813, height: 194 };

const BANNER_X = 110;
const BANNER_Y = 560;
const BANNER_WIDTH = CARD_WIDTH - 220;
const BANNER_HEIGHT = 110;
const BANNER_RADIUS = BANNER_HEIGHT / 2;

const ROW_START = 775;
const ROW_STEP = 63;
const ICON_CX = 152;
const ICON_RADIUS = 30;
const TEXT_X = 208;
const TEXT_MAX_WIDTH = CARD_WIDTH - TEXT_X - 56;

const ORANGE_BAR_Y = 1266;
const ORANGE_BAR_HEIGHT = 44;

const PUBLIC_DIR = path.join(process.cwd(), "public");
const LOGO_PATH = path.join(PUBLIC_DIR, "brand", "idb-logo.png");
// Saat test berjalan, berkas diarahkan ke folder cache agar tidak menumpuk
// di public/ yang dipakai aplikasi berjalan.
const OUT_DIR = process.env.APPROVAL_CARD_DIR
  ? path.resolve(process.env.APPROVAL_CARD_DIR)
  : path.join(PUBLIC_DIR, "approval-cards");

export type ApprovalCardInput = {
  reservationId: string;
  roomName: string;
  building: string;
  floor: string;
  start: Date;
  end: Date;
  activityName: string;
  participantCount: number;
  borrowerName: string;
  approverName: string | null;
};

type IconName =
  | "door"
  | "pin"
  | "calendar"
  | "book"
  | "clock"
  | "people"
  | "user"
  | "check";

type IconDrawer = (
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  size: number,
) => void;

const icons: Record<IconName, IconDrawer> = {
  door(ctx, cx, cy, size) {
    const width = size * 0.5;
    const height = size * 0.72;

    ctx.lineWidth = size * 0.11;
    ctx.strokeStyle = WHITE;
    ctx.strokeRect(cx - width / 2, cy - height / 2, width, height);

    ctx.beginPath();
    ctx.arc(cx + width * 0.24, cy, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = WHITE;
    ctx.fill();
  },

  pin(ctx, cx, cy, size) {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.1, size * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.18, cy + size * 0.06);
    ctx.lineTo(cx, cy + size * 0.42);
    ctx.lineTo(cx + size * 0.18, cy + size * 0.06);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.1, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = BADGE;
    ctx.fill();
  },

  calendar(ctx, cx, cy, size) {
    const width = size * 0.7;
    const height = size * 0.58;
    const top = cy - height / 2 + size * 0.06;

    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = WHITE;
    ctx.beginPath();
    ctx.rect(cx - width / 2, top, width, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - width / 2, top + size * 0.18);
    ctx.lineTo(cx + width / 2, top + size * 0.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - width * 0.24, top - size * 0.1);
    ctx.lineTo(cx - width * 0.24, top + size * 0.06);
    ctx.moveTo(cx + width * 0.24, top - size * 0.1);
    ctx.lineTo(cx + width * 0.24, top + size * 0.06);
    ctx.stroke();
  },

  book(ctx, cx, cy, size) {
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = WHITE;
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(cx - size * 0.36, cy - size * 0.26);
    ctx.lineTo(cx - size * 0.04, cy - size * 0.16);
    ctx.lineTo(cx - size * 0.04, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.36, cy + size * 0.2);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + size * 0.36, cy - size * 0.26);
    ctx.lineTo(cx + size * 0.04, cy - size * 0.16);
    ctx.lineTo(cx + size * 0.04, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.36, cy + size * 0.2);
    ctx.closePath();
    ctx.stroke();
  },

  clock(ctx, cx, cy, size) {
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = WHITE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.18);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + size * 0.15, cy + size * 0.08);
    ctx.stroke();
  },

  people(ctx, cx, cy, size) {
    ctx.fillStyle = WHITE;

    ctx.beginPath();
    ctx.arc(cx - size * 0.24, cy - size * 0.06, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + size * 0.24, cy - size * 0.06, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.14, size * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = WHITE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.36, size * 0.24, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
      cx - size * 0.24,
      cy + size * 0.4,
      size * 0.17,
      Math.PI * 1.1,
      Math.PI * 1.9,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
      cx + size * 0.24,
      cy + size * 0.4,
      size * 0.17,
      Math.PI * 1.1,
      Math.PI * 1.9,
    );
    ctx.stroke();
  },

  user(ctx, cx, cy, size) {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.16, size * 0.17, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = size * 0.11;
    ctx.strokeStyle = WHITE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.36, size * 0.25, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  },

  check(ctx, cx, cy, size) {
    ctx.lineWidth = size * 0.15;
    ctx.strokeStyle = WHITE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.26, cy + size * 0.02);
    ctx.lineTo(cx - size * 0.06, cy + size * 0.22);
    ctx.lineTo(cx + size * 0.28, cy - size * 0.22);
    ctx.stroke();
  },
};

let fontsReady = false;

const ensureFonts = () => {
  if (fontsReady) {
    return;
  }
  fontsReady = true;

  try {
    if (GlobalFonts.has(FONT)) {
      return;
    }

    const candidates = [
      path.join(process.env.WINDIR ?? "C:\\Windows", "Fonts"),
      "/usr/share/fonts",
      "/usr/local/share/fonts",
      "/System/Library/Fonts",
    ];

    for (const directory of candidates) {
      try {
        GlobalFonts.loadFontsFromDir(directory);
      } catch {
        // direktori tidak tersedia, lanjut ke opsi berikutnya
      }
    }
  } catch {
    // font sistem tidak dapat dibaca, biarkan canvas memakai font bawaan
  }
};

const roundedRect = (
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

const drawFitted = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize = 24,
) => {
  let size = maxSize;
  ctx.font = `bold ${size}px "${FONT}"`;

  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `bold ${size}px "${FONT}"`;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Makassar",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const approvalCardFileName = (reservationId: string) =>
  `kartu-persetujuan-${reservationId}.jpg`;

export const approvalCardUrl = (reservationId: string) =>
  `/approval-cards/${approvalCardFileName(reservationId)}`;

export const approvalCardPath = (reservationId: string) =>
  path.join(OUT_DIR, approvalCardFileName(reservationId));

export async function getApprovalCardUrl(
  reservationId: string,
): Promise<string | null> {
  try {
    await fs.access(approvalCardPath(reservationId));
    return approvalCardUrl(reservationId);
  } catch {
    return null;
  }
}

export async function getApprovalCardUrls(
  reservationIds: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = [...new Set(reservationIds)];

  await Promise.all(
    unique.map(async (id) => {
      const url = await getApprovalCardUrl(id);
      if (url) {
        urls.set(id, url);
      }
    }),
  );

  return urls;
}

export async function generateApprovalCard(
  input: ApprovalCardInput,
): Promise<string | null> {
  try {
    ensureFonts();
    await fs.mkdir(OUT_DIR, { recursive: true });

    const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    try {
      const logo = await loadImage(LOGO_PATH);
      const textHeight =
        (LOGO_TEXT_WIDTH * LOGO_TEXT_SRC.height) / LOGO_TEXT_SRC.width;

      ctx.drawImage(
        logo,
        LOGO_ICON_SRC.x,
        LOGO_ICON_SRC.y,
        LOGO_ICON_SRC.size,
        LOGO_ICON_SRC.size,
        (CARD_WIDTH - LOGO_ICON_SIZE) / 2,
        LOGO_ICON_TOP,
        LOGO_ICON_SIZE,
        LOGO_ICON_SIZE,
      );

      ctx.drawImage(
        logo,
        LOGO_TEXT_SRC.x,
        LOGO_TEXT_SRC.y,
        LOGO_TEXT_SRC.width,
        LOGO_TEXT_SRC.height,
        (CARD_WIDTH - LOGO_TEXT_WIDTH) / 2,
        LOGO_TEXT_TOP,
        LOGO_TEXT_WIDTH,
        textHeight,
      );
    } catch {
      ctx.fillStyle = INK;
      ctx.font = `bold 92px "${FONT}"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("IDB BALI", CARD_WIDTH / 2, 180);
    }

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    ctx.moveTo(56, RULE_Y);
    ctx.lineTo(CARD_WIDTH - 56, RULE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    roundedRect(
      ctx,
      BANNER_X,
      BANNER_Y,
      BANNER_WIDTH,
      BANNER_HEIGHT,
      BANNER_RADIUS,
    );
    ctx.fillStyle = TEAL;
    ctx.fill();

    ctx.fillStyle = WHITE;
    ctx.font = `bold 52px "${FONT}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Kartu Persetujuan Ruangan",
      CARD_WIDTH / 2,
      BANNER_Y + BANNER_HEIGHT / 2 + 2,
    );

    const rows: Array<{ icon: IconName; text: string }> = [
      { icon: "door", text: input.roomName },
      { icon: "pin", text: `${input.building}, Lantai ${input.floor}` },
      { icon: "calendar", text: dateFormatter.format(input.start) },
      { icon: "book", text: input.activityName },
      {
        icon: "clock",
        text: `${timeFormatter.format(input.start)} – ${timeFormatter.format(input.end)} WITA`,
      },
      { icon: "people", text: `${input.participantCount} orang` },
      { icon: "user", text: input.borrowerName },
      {
        icon: "check",
        text: input.approverName ?? "Otomatis sesuai aturan ruangan",
      },
    ];

    rows.forEach((row, index) => {
      const centerY = ROW_START + index * ROW_STEP;

      ctx.beginPath();
      ctx.arc(ICON_CX, centerY, ICON_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = BADGE;
      ctx.fill();

      icons[row.icon](ctx, ICON_CX, centerY, ICON_RADIUS * 2);

      ctx.fillStyle = INK;
      drawFitted(
        ctx,
        row.text,
        TEXT_X,
        centerY,
        TEXT_MAX_WIDTH,
        42,
        24,
      );
    });

    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, ORANGE_BAR_Y, CARD_WIDTH, ORANGE_BAR_HEIGHT);
    ctx.fillStyle = TEAL;
    ctx.fillRect(
      0,
      ORANGE_BAR_Y + ORANGE_BAR_HEIGHT,
      CARD_WIDTH,
      CARD_HEIGHT - ORANGE_BAR_Y - ORANGE_BAR_HEIGHT,
    );

    await fs.writeFile(
      approvalCardPath(input.reservationId),
      canvas.toBuffer("image/jpeg", 92),
    );

    return approvalCardUrl(input.reservationId);
  } catch (error) {
    console.error("Gagal generate kartu persetujuan ruangan:", error);
    return null;
  }
}
