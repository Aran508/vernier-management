import { listInward, listMaterials, listOutward, noMovementDays, stockStatus } from "./db";
import { Department } from "./types";

/**
 * Generic column definition used by both the PDF renderer and any future
 * Excel/CSV export — add a new report by adding one entry here plus one
 * data-builder function below. No other file needs to change.
 */
export interface ReportColumn {
  key: string;
  header: string;
  width?: number; // relative flex width in the PDF table
  align?: "left" | "right" | "center";
}

export interface ReportResult {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

type Scope = Department | "All";

export function buildOutwardReport(department: Scope): ReportResult {
  const rows = listOutward({ department }).map((r) => ({
    date: r.date,
    partNumber: r.partNumber,
    description: r.description,
    category: r.category,
    quantity: r.quantity,
    issuedTo: r.issuedTo,
    purpose: r.purpose,
    department: r.department,
    issuedBy: r.issuedBy,
  }));
  return {
    title: "Outward Register",
    columns: [
      { key: "date", header: "Date", width: 1.1 },
      { key: "partNumber", header: "Part No.", width: 1.3 },
      { key: "description", header: "Description", width: 2.2 },
      { key: "category", header: "Category", width: 1.3 },
      { key: "quantity", header: "Qty", width: 0.7, align: "right" },
      { key: "issuedTo", header: "Issued To", width: 1.6 },
      { key: "department", header: "Dept", width: 1.3 },
      { key: "issuedBy", header: "Issued By", width: 1.2 },
    ],
    rows,
  };
}

export function buildInwardReport(department: Scope): ReportResult {
  const rows = listInward({ department }).map((r) => ({
    date: r.date,
    partNumber: r.partNumber,
    description: r.description,
    category: r.category,
    quantity: r.quantity,
    supplier: r.supplier,
    invoiceNumber: r.invoiceNumber,
    grnNumber: r.grnNumber,
    value: r.quantity * r.unitValue,
    department: r.department,
    receivedBy: r.receivedBy,
  }));
  return {
    title: "Inward Register",
    columns: [
      { key: "date", header: "Date", width: 1.1 },
      { key: "partNumber", header: "Part No.", width: 1.3 },
      { key: "description", header: "Description", width: 2 },
      { key: "supplier", header: "Supplier", width: 1.6 },
      { key: "invoiceNumber", header: "Invoice #", width: 1.2 },
      { key: "grnNumber", header: "GRN No.", width: 1.2 },
      { key: "quantity", header: "Qty", width: 0.7, align: "right" },
      { key: "value", header: "Value (₹)", width: 1, align: "right" },
      { key: "department", header: "Dept", width: 1.3 },
      { key: "receivedBy", header: "Received By", width: 1.3 },
    ],
    rows,
  };
}

export function buildStockSummaryReport(department: Scope): ReportResult {
  const materials = listMaterials({ department });
  const allInward = listInward({ department });
  const allOutward = listOutward({ department });

  const rows = materials.map((m) => {
    const totalInward = allInward.filter((i) => i.partNumber === m.partNumber).reduce((s, i) => s + i.quantity, 0);
    const totalOutward = allOutward.filter((o) => o.partNumber === m.partNumber).reduce((s, o) => s + o.quantity, 0);
    return {
      partNumber: m.partNumber,
      description: m.description,
      department: m.department,
      opening: m.openingStock,
      inward: totalInward,
      outward: totalOutward,
      closing: m.currentStock,
      location: m.location,
      noMovementDays: noMovementDays(m) ?? "-",
      value: m.currentStock * m.unitValue,
      status: stockStatus(m),
    };
  });

  return {
    title: "Stock Summary",
    columns: [
      { key: "partNumber", header: "Part No.", width: 1.2 },
      { key: "description", header: "Description", width: 2 },
      { key: "department", header: "Dept", width: 1.1 },
      { key: "opening", header: "Opening", width: 0.8, align: "right" },
      { key: "inward", header: "Inward", width: 0.8, align: "right" },
      { key: "outward", header: "Outward", width: 0.8, align: "right" },
      { key: "closing", header: "Closing", width: 0.8, align: "right" },
      { key: "location", header: "Location", width: 1.1 },
      { key: "value", header: "Value (₹)", width: 1, align: "right" },
      { key: "status", header: "Status", width: 1 },
    ],
    rows,
  };
}

export function buildMaterialMasterReport(department: Scope): ReportResult {
  const rows = listMaterials({ department }).map((m) => ({
    partNumber: m.partNumber,
    description: m.description,
    category: m.category,
    department: m.department,
    unit: m.unit,
    location: m.location,
    minStock: m.minStock,
    maxStock: m.maxStock,
    currentStock: m.currentStock,
    status: stockStatus(m),
  }));
  return {
    title: "Material Master",
    columns: [
      { key: "partNumber", header: "Part No.", width: 1.2 },
      { key: "description", header: "Description", width: 2.2 },
      { key: "category", header: "Category", width: 1.3 },
      { key: "department", header: "Dept", width: 1.2 },
      { key: "location", header: "Location", width: 1.1 },
      { key: "minStock", header: "Min", width: 0.6, align: "right" },
      { key: "maxStock", header: "Max", width: 0.6, align: "right" },
      { key: "currentStock", header: "Current", width: 0.7, align: "right" },
      { key: "status", header: "Status", width: 1 },
    ],
    rows,
  };
}

export const REPORT_BUILDERS: Record<string, (department: Scope) => ReportResult> = {
  outward: buildOutwardReport,
  inward: buildInwardReport,
  "stock-summary": buildStockSummaryReport,
  materials: buildMaterialMasterReport,
};
