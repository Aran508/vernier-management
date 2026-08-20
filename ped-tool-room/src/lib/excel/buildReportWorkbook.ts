import ExcelJS from "exceljs";
import { ReportColumn } from "../reportData";

// Same palette as the PDF letterhead (src/lib/pdf/ReportDocument.tsx) so a
// PDF and an Excel export of the same report look like they came from the
// same system, not two different tools bolted together. All body text is
// solid black for maximum readability in Excel — only the header banner
// (white on navy) and semantic accents (status colors, part number) stay
// off-black, since those are informative, not "muted" filler text.
const COLORS = {
  headerBg: "FF0F172A", // slate-900
  headerText: "FFFFFFFF",
  brandTeal: "FF0F766E",
  border: "FFCBD5E1", // slate-300 — a touch darker than before for visible grid lines
  black: "FF000000",
  statusRed: "FFB91C1C",
  statusOrange: "FFC2410C",
  statusGreen: "FF15803D",
  statusSlate: "FF334155",
};

const STATUS_COLOR: Record<string, string> = {
  Low: COLORS.statusRed,
  "Out of Stock": COLORS.statusRed,
  "Over Stock": COLORS.statusOrange,
  Normal: COLORS.statusGreen,
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

export interface ReportWorkbookOptions {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  companyName?: string;
  companySub?: string;
  filterSummary?: string;
  generatedBy?: string;
  logoBuffer?: Buffer;
}

export async function buildReportWorkbook({
  title,
  columns,
  rows,
  companyName = "PED Tool Room",
  companySub = "Production Engineering Department — Store & Inventory Management",
  filterSummary,
  generatedBy,
  logoBuffer,
}: ReportWorkbookOptions): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();

  // Excel sheet names: max 31 chars, no []:*?/\
  const sheetName = title.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Report";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const colCount = columns.length;

  // The table (including column A) starts flush left. Column A still needs
  // to be wide enough that the logo — which only lives in rows 1-2, well
  // above the table — never bleeds into the company name text next to it.
  // Column widths below (based on real content) may widen it further; this
  // is just the floor.
  ws.getColumn(1).width = 16;

  let r = 1;

  if (logoBuffer) {
    const imageId = wb.addImage({ buffer: logoBuffer as never, extension: "jpeg" });
    ws.addImage(imageId, { tl: { col: 0.1, row: 0.08 }, ext: { width: 78, height: 44 } });
  }

  // Letterhead block — company name/tagline start at column B on these two
  // rows only, so they never sit under the logo image in column A.
  ws.mergeCells(r, 2, r, colCount);
  const nameCell = ws.getCell(r, 2);
  nameCell.value = companyName;
  nameCell.font = { size: 15, bold: true, color: { argb: COLORS.black } };
  ws.getRow(r).height = 24;
  r++;

  ws.mergeCells(r, 2, r, colCount);
  const subCell = ws.getCell(r, 2);
  subCell.value = companySub;
  subCell.font = { size: 9, italic: true, color: { argb: COLORS.black } };
  ws.getRow(r).height = 16;
  r++;
  r++; // spacer

  // Report title — its own full-width row so it's never squeezed.
  ws.mergeCells(r, 1, r, colCount);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { size: 13, bold: true, color: { argb: COLORS.black } };
  r++;

  // Generated/by line — also its own full-width, left-aligned row. Cramming
  // this into a narrow right-aligned half-row previously clipped the start
  // of the text ("Generated" showing as "erated"); a full row never does.
  const now = new Date();
  ws.mergeCells(r, 1, r, colCount);
  const metaCell = ws.getCell(r, 1);
  metaCell.value = `Generated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}${generatedBy ? `  ·  By ${generatedBy}` : ""}`;
  metaCell.font = { size: 9, color: { argb: COLORS.black } };
  r++;

  if (filterSummary) {
    ws.mergeCells(r, 1, r, colCount);
    const filterCell = ws.getCell(r, 1);
    filterCell.value = filterSummary;
    filterCell.font = { size: 9, color: { argb: COLORS.black } };
    r++;
  }

  ws.mergeCells(r, 1, r, colCount);
  const countCell = ws.getCell(r, 1);
  countCell.value = `${rows.length} record${rows.length === 1 ? "" : "s"}`;
  countCell.font = { size: 9, bold: true, color: { argb: COLORS.brandTeal } };
  r++;
  r++; // spacer before table

  const headerRowNum = r;

  // Column widths — based on header length and a sample of content. Column
  // A keeps whichever is larger: the logo's floor (16) or its real content.
  columns.forEach((col, i) => {
    const contentLengths = rows.slice(0, 200).map((row) => String(row[col.key] ?? "").length);
    const maxContent = contentLengths.length ? Math.max(...contentLengths) : 0;
    const width = Math.min(42, Math.max(col.header.length + 4, maxContent + 3, 10));
    const colIndex = i + 1;
    ws.getColumn(colIndex).width = colIndex === 1 ? Math.max(16, width) : width;
  });

  // A real Excel Table (not just a bordered+autofiltered range) — shows up
  // in Excel's Table Design ribbon, gets native filter buttons per column,
  // and expands automatically if rows are added later.
  const tableName = `Tbl_${sheetName.replace(/[^A-Za-z0-9_]/g, "_")}`;
  const tableRows = rows.length > 0 ? rows.map((row) => columns.map((c) => row[c.key] ?? "-")) : [columns.map(() => "-")];

  ws.addTable({
    name: tableName,
    ref: `A${headerRowNum}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: columns.map((c) => ({ name: c.header, filterButton: true })),
    rows: tableRows,
  });

  // Re-skin the header to our exact brand navy/white instead of the table
  // theme's default blue, and apply number formats / semantic colors / a
  // real border grid to the body — addTable creates plain cells we can
  // style same as before.
  const headerRow = ws.getRow(headerRowNum);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: col.align === "right" ? "right" : col.align === "center" ? "center" : "left" };
    cell.border = thinBorder;
  });
  headerRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];

  const dataRowCount = rows.length > 0 ? rows.length : 1;
  for (let rowIdx = 0; rowIdx < dataRowCount; rowIdx++) {
    const excelRow = ws.getRow(headerRowNum + 1 + rowIdx);
    columns.forEach((col, i) => {
      const raw = rows[rowIdx]?.[col.key];
      const cell = excelRow.getCell(i + 1);
      cell.border = thinBorder;
      cell.font = { color: { argb: COLORS.black } };
      cell.alignment = { vertical: "middle", horizontal: col.align === "right" ? "right" : col.align === "center" ? "center" : "left" };

      if (typeof raw === "number") {
        cell.numFmt = col.key === "value" ? "#,##0.00" : "#,##0.##";
      }
      if (col.key === "status" && typeof raw === "string") {
        cell.font = { bold: true, color: { argb: STATUS_COLOR[raw] ?? COLORS.statusSlate } };
      } else if (col.key === "partNumber") {
        cell.font = { color: { argb: COLORS.brandTeal }, name: "Consolas" };
      }
    });
  }

  if (rows.length === 0) {
    const emptyCell = ws.getCell(headerRowNum + 1, 1);
    emptyCell.value = "No records found for the selected filters.";
    emptyCell.font = { italic: true, color: { argb: COLORS.black } };
    ws.mergeCells(headerRowNum + 1, 1, headerRowNum + 1, colCount);
    emptyCell.alignment = { horizontal: "center" };
  }

  const footerRowNum = headerRowNum + dataRowCount + 2;
  ws.mergeCells(footerRowNum, 1, footerRowNum, colCount);
  const footerCell = ws.getCell(footerRowNum, 1);
  footerCell.value = "PED Tool Room Management System — Internal Use Only";
  footerCell.font = { size: 8, italic: true, color: { argb: COLORS.black } };

  return wb;
}
