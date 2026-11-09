import ExcelJS from "exceljs";
import type { ReservationStatus } from "@prisma/client";
import { STATUSES, statusLabels, type UsageReport } from "@/lib/reports";
import { getWitaParts } from "@/lib/wita";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BRAND = "FF024D71";
const BRAND_SOFT = "FFFBF7EE";
const LINE = "FFDED7C8";
const INK = "FF14262D";
const WHITE = "FFFFFFFF";
const ACCENT = "FFF17711";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDateTimeLabel = (date: Date) => {
  const parts = getWitaParts(date);
  return `${pad2(parts.day)} ${MONTH_LABELS[parts.month - 1]} ${parts.year} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
};

const periodLabel = (fromIso: string, toIso: string) => {
  const from = new Date(fromIso);
  const inclusiveEnd = new Date(new Date(toIso).getTime() - 1);
  return `${formatDateTimeLabel(from)} – ${formatDateTimeLabel(inclusiveEnd)} WITA`;
};

const thinBorder: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin", color: { argb: LINE } },
};

const allBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: LINE } },
  left: { style: "thin", color: { argb: LINE } },
  bottom: { style: "thin", color: { argb: LINE } },
  right: { style: "thin", color: { argb: LINE } },
};

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.height = 26;

  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = allBorder;
  });
};

const fitColumns = (
  worksheet: ExcelJS.Worksheet,
  minimums: number[],
  maximum = 52,
) => {
  worksheet.columns.forEach((column, index) => {
    const minimum = minimums[index] ?? 10;
    let longest = minimum;

    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const text =
        cell.value instanceof Date ? "00 Jan 0000" : (cell.text ?? "");
      const longestLine = text
        .split("\n")
        .reduce((length, line) => Math.max(length, line.length), 0);
      longest = Math.max(longest, longestLine);
    });

    column.width = Math.min(maximum, Math.max(minimum, longest + 2));
  });
};

const buildSummarySheet = (
  workbook: ExcelJS.Workbook,
  report: UsageReport,
) => {
  const sheet = workbook.addWorksheet("Ringkasan", {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { width: 26 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  sheet.mergeCells("A1:E1");
  const title = sheet.getCell("A1");
  title.value = "LAPORAN PENGGUNAAN RUANGAN";
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  sheet.getRow(1).height = 34;

  const detailRows: Array<[string, string]> = [
    ["Ruangan", report.room.name],
    ["Gedung dan lantai", `${report.room.building}, lantai ${report.room.floor}`],
    ["Periode (WITA)", periodLabel(report.from, report.to)],
  ];

  detailRows.forEach(([label, value], index) => {
    const row = 3 + index;
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: INK },
    };
    sheet.mergeCells(`B${row}:E${row}`);
    const valueCell = sheet.getCell(`B${row}`);
    valueCell.value = value;
    valueCell.font = { name: "Calibri", size: 11, color: { argb: INK } };
    valueCell.alignment = { vertical: "middle", wrapText: true };
    sheet.getCell(`A${row}`).border = thinBorder;
    valueCell.border = thinBorder;
  });

  sheet.mergeCells("A7:E7");
  const metricsTitle = sheet.getCell("A7");
  metricsTitle.value = "ANGKA UTAMA";
  metricsTitle.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND } };
  metricsTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_SOFT },
  };
  metricsTitle.border = thinBorder;
  sheet.getRow(7).height = 24;

  const metrics: Array<[string, number]> = [
    ["Jumlah Reservasi", report.totalReservations],
    ["Jam Terpakai", report.usedHours],
    ["Pembatalan", report.cancellations],
  ];

  metrics.forEach(([label, value], index) => {
    const column = index + 1;
    const labelCell = sheet.getCell(8, column);
    labelCell.value = label;
    labelCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_SOFT },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
    labelCell.border = allBorder;

    const valueCell = sheet.getCell(9, column);
    valueCell.value = value;
    valueCell.numFmt = "0.##";
    valueCell.font = { name: "Calibri", size: 20, bold: true, color: { argb: BRAND } };
    valueCell.alignment = { vertical: "middle", horizontal: "center" };
    valueCell.border = allBorder;
  });

  sheet.mergeCells("A11:E11");
  const statusTitle = sheet.getCell("A11");
  statusTitle.value = "KOMPOSISI STATUS";
  statusTitle.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND } };
  statusTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_SOFT },
  };
  statusTitle.border = thinBorder;
  sheet.getRow(11).height = 24;

  sheet.getCell("A12").value = "Status";
  sheet.getCell("B12").value = "Jumlah";
  sheet.mergeCells("B12:E12");
  styleHeaderRow(sheet.getRow(12));

  STATUSES.forEach((status: ReservationStatus, index) => {
    const row = 13 + index;
    const statusCell = sheet.getCell(`A${row}`);
    statusCell.value = statusLabels[status];
    statusCell.font = { name: "Calibri", size: 11, color: { argb: INK } };
    statusCell.border = allBorder;

    sheet.mergeCells(`B${row}:E${row}`);
    const countCell = sheet.getCell(`B${row}`);
    countCell.value = report.byStatus[status];
    countCell.numFmt = "0";
    countCell.alignment = { vertical: "middle", horizontal: "left" };
    countCell.font = { name: "Calibri", size: 11, color: { argb: INK } };
    countCell.border = allBorder;

    if (index % 2 === 1) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_SOFT },
      };
      countCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_SOFT },
      };
    }
  });

  const footerRow = 13 + STATUSES.length + 1;
  sheet.mergeCells(`A${footerRow}:E${footerRow}`);
  const footer = sheet.getCell(`A${footerRow}`);
  footer.value = "Dibuat otomatis oleh SIRU — Sistem Reservasi Ruangan IDB Bali.";
  footer.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF5C6E73" } };
  footer.alignment = { vertical: "middle", horizontal: "left" };
  footer.border = { top: { style: "thin", color: { argb: ACCENT } } };

  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 18;

  sheet.headerFooter.oddFooter = "&C&9SIRU — IDB Bali";

  return sheet;
};

const buildDetailSheet = (
  workbook: ExcelJS.Workbook,
  report: UsageReport,
) => {
  const sheet = workbook.addWorksheet("Rincian", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { width: 16 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 26 },
    { width: 24 },
    { width: 40 },
    { width: 10 },
    { width: 12 },
    { width: 24 },
    { width: 34 },
  ];

  const headers = [
    "Status",
    "Tanggal",
    "Mulai",
    "Selesai",
    "Durasi (Jam)",
    "Ruangan",
    "Organisasi",
    "Kegiatan",
    "Peserta",
    "Jenis",
    "Peminjam",
    "ID",
  ];

  sheet.getRow(1).values = headers;
  styleHeaderRow(sheet.getRow(1));

  if (report.details.length === 0) {
    sheet.mergeCells("A2:L2");
    const empty = sheet.getCell("A2");
    empty.value = "Tidak ada reservasi pada periode ini.";
    empty.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF5C6E73" } };
    empty.alignment = { vertical: "middle", horizontal: "left" };
    empty.border = allBorder;
  }

  report.details.forEach((detail, index) => {
    const row = sheet.addRow([
      detail.statusLabel,
      new Date(`${detail.date}T00:00:00.000Z`),
      detail.start,
      detail.end,
      detail.durationHours,
      report.room.name,
      detail.organizationName ?? "Tanpa organisasi",
      detail.activityName,
      detail.participantCount,
      detail.type === "ORGANISASI" ? "Organisasi" : "Pribadi",
      detail.borrowerName,
      detail.id,
    ]);

    row.height = 22;
    row.getCell(2).numFmt = "dd mmm yyyy";
    row.getCell(5).numFmt = "0.##";
    row.getCell(9).numFmt = "0";

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        horizontal: [3, 4, 5, 9].includes(columnNumber) ? "center" : "left",
        wrapText: columnNumber === 8,
      };
      cell.border = allBorder;

      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND_SOFT },
        };
      }
    });
  });

  sheet.autoFilter = "A1:L1";
  sheet.headerFooter.oddFooter = "&C&9SIRU — IDB Bali — Halaman &P dari &N";

  fitColumns(sheet, [16, 14, 10, 10, 12, 26, 24, 34, 10, 12, 24, 34]);

  return sheet;
};

export async function buildUsageWorkbook(
  report: UsageReport,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIRU — Sistem Reservasi Ruangan IDB Bali";
  workbook.lastModifiedBy = "SIRU";
  workbook.created = new Date();
  workbook.modified = new Date();

  buildSummarySheet(workbook, report);
  buildDetailSheet(workbook, report);

  return workbook.xlsx.writeBuffer();
}
