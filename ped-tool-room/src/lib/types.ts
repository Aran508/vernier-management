export type Role = "STORE_ADMIN" | "PROCESS_OWNER" | "MONITORING";

export type Department = "Machining" | "Welding" | "Assembly & Testing" | "Burnishing & Project";

export const DEPARTMENTS: Department[] = [
  "Machining",
  "Welding",
  "Assembly & Testing",
  "Burnishing & Project",
];

/** Standard category suggestions shown while typing — not a hard restriction,
 *  just speeds up data entry and keeps naming consistent. */
export const CATEGORY_SUGGESTIONS: string[] = [
  "Cutting Tools",
  "Fixtures",
  "Consumables",
  "Gauges",
  "Electrodes",
  "Abrasives",
  "Measuring Instruments",
  "Spare Parts",
];

/** Standard unit-of-measure suggestions — same rationale as categories. */
export const UNIT_SUGGESTIONS: string[] = [
  "Nos",
  "Kg",
  "Litre",
  "Meter",
  "Box",
  "Set",
  "Pack",
  "Roll",
];

export interface User {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department | "All";
  role: Role;
  username: string;
  passwordHash: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  lastLogin: string | null;
  createdAt: string;
}

export type StockStatus = "Normal" | "Low" | "Out of Stock" | "Over Stock";

export interface Material {
  id: string;
  description: string;
  partNumber: string;
  category: string;
  department: Department;
  unit: string;
  location: string; // e.g. A11-03-05
  warehouse: string;
  rack: string;
  row: string;
  shelf: string;
  minStock: number;
  maxStock: number;
  currentStock: number;
  openingStock: number;
  unitValue: number;
  status: "Active" | "Inactive";
  remarks: string;
  createdDate: string;
  createdBy: string;
  modifiedDate: string;
  modifiedBy: string;
  lastInwardDate: string | null;
  lastOutwardDate: string | null;
  supplier: string;
}

export interface InwardEntry {
  id: string;
  date: string;
  month: string;
  supplier: string;
  invoiceNumber: string;
  grnNumber: string;
  partNumber: string;
  description: string;
  category: string;
  department: Department;
  quantity: number;
  unit: string;
  unitValue: number;
  receivedBy: string;
  verifiedBy: string;
  remarks: string;
  createdAt: string;
}

export interface OutwardEntry {
  id: string;
  date: string;
  month: string;
  partNumber: string;
  description: string;
  category: string;
  quantity: number;
  nos: number;
  issuedTo: string;
  purpose: string;
  receivedBy: string;
  department: Department;
  issuedBy: string;
  remarks: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  action: string;
  oldValue: string;
  newValue: string;
  date: string;
  time: string;
  ipAddress: string;
}
