const BRAND_TEAL = "#0f766e";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

function layout(title: string, bodyHtml: string, accent = BRAND_TEAL) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid ${BORDER}; border-radius:12px; overflow:hidden;">
      <div style="background:${INK}; border-top:4px solid ${accent}; padding:18px 24px;">
        <p style="margin:0; color:#ffffff; font-size:15px; font-weight:700;">PED Tool Room</p>
        <p style="margin:2px 0 0; color:#94a3b8; font-size:11px;">Production Engineering Department — Store &amp; Inventory Management</p>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 14px; color:${INK}; font-size:17px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:14px 24px; border-top:1px solid ${BORDER}; color:${MUTED}; font-size:11px;">
        Automated notification from the PED Tool Room Management System. Please do not reply to this email.
      </div>
    </div>
  </div>`;
}

function fieldRow(label: string, value: string | number) {
  return `<tr>
    <td style="padding:4px 0; color:${MUTED}; font-size:12px; width:140px;">${label}</td>
    <td style="padding:4px 0; color:${INK}; font-size:13px; font-weight:600;">${value}</td>
  </tr>`;
}

export function lowStockEmail(params: {
  partNumber: string;
  description: string;
  department: string;
  currentStock: number;
  minStock: number;
  unit: string;
}) {
  const isOut = params.currentStock <= 0;
  const body = `
    <p style="margin:0 0 14px; color:${INK}; font-size:13px;">
      ${isOut ? "A material has run out of stock" : "A material has fallen at or below its minimum stock level"} in the
      <strong>${params.department}</strong> store.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${fieldRow("Part Number", params.partNumber)}
      ${fieldRow("Description", params.description)}
      ${fieldRow("Department", params.department)}
      ${fieldRow("Current Stock", `${params.currentStock} ${params.unit}`)}
      ${fieldRow("Minimum Stock", `${params.minStock} ${params.unit}`)}
    </table>
    <p style="margin:16px 0 0; font-size:12px; color:${MUTED};">Please arrange replenishment at the earliest.</p>
  `;
  return layout(isOut ? "⚠ Stock Out Alert" : "⚠ Low Stock Alert", body, "#dc2626");
}

export function materialIssuedEmail(params: {
  partNumber: string;
  description: string;
  department: string;
  quantity: number;
  unit: string;
  issuedTo: string;
  purpose: string;
  issuedBy: string;
  date: string;
}) {
  const body = `
    <p style="margin:0 0 14px; color:${INK}; font-size:13px;">
      Material has been issued from the ${params.department} store.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${fieldRow("Part Number", params.partNumber)}
      ${fieldRow("Description", params.description)}
      ${fieldRow("Quantity", `${params.quantity} ${params.unit}`)}
      ${fieldRow("Issued To", params.issuedTo)}
      ${fieldRow("Purpose", params.purpose || "-")}
      ${fieldRow("Issued By", params.issuedBy)}
      ${fieldRow("Date", params.date)}
    </table>
  `;
  return layout("Material Issued Confirmation", body, BRAND_TEAL);
}

export function materialReceivedEmail(params: {
  partNumber: string;
  description: string;
  department: string;
  quantity: number;
  unit: string;
  supplier: string;
  invoiceNumber: string;
  receivedBy: string;
  date: string;
}) {
  const body = `
    <p style="margin:0 0 14px; color:${INK}; font-size:13px;">
      Material has been received into the ${params.department} store.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${fieldRow("Part Number", params.partNumber)}
      ${fieldRow("Description", params.description)}
      ${fieldRow("Quantity", `${params.quantity} ${params.unit}`)}
      ${fieldRow("Supplier", params.supplier || "-")}
      ${fieldRow("Invoice #", params.invoiceNumber || "-")}
      ${fieldRow("Received By", params.receivedBy)}
      ${fieldRow("Date", params.date)}
    </table>
  `;
  return layout("Material Received Confirmation", body, "#16a34a");
}

export function dailyDigestEmail(params: {
  scopeName: string; // e.g. "Machining" or "All Departments"
  date: string;
  totalMaterials: number;
  totalStockQuantity: number;
  inventoryValue: number;
  lowStockCount: number;
  overStockCount: number;
  noMovementCount: number;
  todaysInward: number;
  todaysOutward: number;
  lowStockItems: { partNumber: string; description: string; currentStock: number; minStock: number; unit: string }[];
}) {
  const cardCell = (label: string, value: string | number) => `
    <td style="padding:10px 12px; background:#f8fafc; border:1px solid ${BORDER}; border-radius:8px;">
      <p style="margin:0; font-size:10px; color:${MUTED}; text-transform:uppercase;">${label}</p>
      <p style="margin:3px 0 0; font-size:16px; font-weight:700; color:${INK};">${value}</p>
    </td>`;

  const lowStockRows = params.lowStockItems
    .slice(0, 10)
    .map(
      (m) => `<tr>
        <td style="padding:5px 8px; font-size:11px; color:${INK}; border-top:1px solid ${BORDER};">${m.partNumber}</td>
        <td style="padding:5px 8px; font-size:11px; color:${INK}; border-top:1px solid ${BORDER};">${m.description}</td>
        <td style="padding:5px 8px; font-size:11px; color:#dc2626; border-top:1px solid ${BORDER}; text-align:right;">${m.currentStock} ${m.unit}</td>
        <td style="padding:5px 8px; font-size:11px; color:${MUTED}; border-top:1px solid ${BORDER}; text-align:right;">${m.minStock} ${m.unit}</td>
      </tr>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 14px; color:${INK}; font-size:13px;">
      Daily stock summary for <strong>${params.scopeName}</strong> — ${params.date}
    </p>
    <table style="width:100%; border-collapse:separate; border-spacing:6px 6px; margin:0 0 6px -6px;">
      <tr>
        ${cardCell("Total Materials", params.totalMaterials)}
        ${cardCell("Total Stock Qty", params.totalStockQuantity)}
        ${cardCell("Inventory Value", `₹${params.inventoryValue.toLocaleString()}`)}
      </tr>
      <tr>
        ${cardCell("Low / Out of Stock", params.lowStockCount)}
        ${cardCell("Over Stock", params.overStockCount)}
        ${cardCell("No Movement (30d+)", params.noMovementCount)}
      </tr>
      <tr>
        ${cardCell("Today's Inward", params.todaysInward)}
        ${cardCell("Today's Outward", params.todaysOutward)}
        ${cardCell("&nbsp;", "&nbsp;")}
      </tr>
    </table>
    ${
      lowStockRows
        ? `<p style="margin:16px 0 6px; font-size:12px; font-weight:600; color:${INK};">Items needing attention</p>
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <th style="text-align:left; padding:5px 8px; font-size:10px; color:${MUTED}; text-transform:uppercase;">Part No.</th>
        <th style="text-align:left; padding:5px 8px; font-size:10px; color:${MUTED}; text-transform:uppercase;">Description</th>
        <th style="text-align:right; padding:5px 8px; font-size:10px; color:${MUTED}; text-transform:uppercase;">Current</th>
        <th style="text-align:right; padding:5px 8px; font-size:10px; color:${MUTED}; text-transform:uppercase;">Min</th>
      </tr>
      ${lowStockRows}
    </table>`
        : `<p style="margin:16px 0 0; font-size:12px; color:${MUTED};">No items are currently low or out of stock. 👍</p>`
    }
  `;
  return layout("Daily Stock Summary", body, BRAND_TEAL);
}

export function adminNotificationEmail(params: { heading: string; message: string; details?: Record<string, string | number> }) {
  const rows = params.details
    ? Object.entries(params.details).map(([k, v]) => fieldRow(k, v)).join("")
    : "";
  const body = `
    <p style="margin:0 0 14px; color:${INK}; font-size:13px;">${params.message}</p>
    ${rows ? `<table style="width:100%; border-collapse:collapse;">${rows}</table>` : ""}
  `;
  return layout(params.heading, body, "#7c3aed");
}
