"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, ArrowDownToLine } from "lucide-react";
import { useAppContext } from "../layout";
import { ExportButton } from "@/components/ExportButton";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { CATEGORY_SUGGESTIONS, DEPARTMENTS, UNIT_SUGGESTIONS } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { TableShell, Row, Cell, PageHeader, FilterChip, type Column } from "@/components/DataTable";
import { Field, FormSection, ConfirmDelete, inputClass } from "@/components/Field";

interface InwardRow {
  id: string;
  date: string;
  month: string;
  supplier: string;
  invoiceNumber: string;
  grnNumber: string;
  partNumber: string;
  description: string;
  category: string;
  department: string;
  quantity: number;
  unit: string;
  unitValue: number;
  receivedBy: string;
  verifiedBy: string;
}

interface MaterialLite {
  partNumber: string;
  description: string;
  category: string;
  unit: string;
  department: string;
  supplier: string;
  unitValue: number;
}

const BASE_COLUMNS: Column[] = [
  { label: "Date", width: "w-24" }, { label: "Month", width: "w-20" },
  "Supplier", { label: "Invoice #", width: "w-28" }, { label: "GRN No.", width: "w-28" },
  { label: "Part No.", width: "w-28" }, "Description",
  { label: "Category", width: "w-28" }, { label: "Dept", width: "w-32" },
  { label: "Qty", align: "right", width: "w-28" },
  { label: "Value", align: "right", width: "w-28" },
  "Received By", "Verified By",
];

export default function InwardPage() {
  const { session, department } = useAppContext();
  const toast = useToast();
  const [rows, setRows] = useState<InwardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<InwardRow | null>(null);
  const [period, setPeriod] = useState<"today" | "month" | "all">("all");
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/inward?department=${encodeURIComponent(department)}`);
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: fetching data in response to `department` changing is the
    // canonical "synchronize with an external system" effect use case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const filteredRows = useMemo(() => {
    if (period === "today") return rows.filter((r) => r.date === today);
    if (period === "month") return rows.filter((r) => r.date.slice(0, 7) === currentMonth);
    return rows;
  }, [rows, period, today, currentMonth]);

  // Store Admin (all depts) + Process Owners (own dept only) can create entries. Monitoring is read-only.
  const canWrite = session.role === "STORE_ADMIN" || session.role === "PROCESS_OWNER";
  const columns = canWrite ? [...BASE_COLUMNS, "Edit"] : BASE_COLUMNS;
  const totalValue = filteredRows.reduce((sum, r) => sum + r.quantity * r.unitValue, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inward Module"
        caption={`${filteredRows.length} ${filteredRows.length === 1 ? "entry" : "entries"}${
          department !== "All" ? ` · ${department}` : ""
        } · ₹${Math.round(totalValue).toLocaleString("en-IN")} received`}
        actions={
          <>
            <ExportButton reportType="inward" department={department} />
            {canWrite && (
              <ExcelImportButton
                endpoint="/api/inward/bulk-import"
                templateColumns={["Date", "Part Number", "Supplier", "Invoice Number", "GRN Number", "Quantity", "Unit Value", "Received By", "Verified By", "Remarks"]}
                templateFileName="inward_import_template.xlsx"
                onImported={load}
              />
            )}
            {canWrite && (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> New Inward Entry
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "today", label: "Today" },
          { key: "month", label: "This Month" },
          { key: "all", label: "All" },
        ] as const).map((p) => (
          <FilterChip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </FilterChip>
        ))}
        {!canWrite && (
          <p className="text-label ml-2 text-xs italic">
            Read-only view — Monitoring users cannot create inward entries.
          </p>
        )}
      </div>

      <TableShell
        columns={columns}
        loading={loading}
        isEmpty={filteredRows.length === 0}
        emptyMessage={period === "all" ? "No inward entries yet." : "Nothing received in this period."}
        emptyHint={
          period !== "all"
            ? "Switch to All to see the full history."
            : canWrite
              ? "Record a goods receipt with New Inward Entry, or import a sheet."
              : undefined
        }
        caption="Inward goods receipt entries"
      >
        {filteredRows.map((r) => (
          <Row
            key={r.id}
            highlighted={highlight === r.partNumber}
            innerRef={(el) => {
              if (el && highlight === r.partNumber) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <Cell num className="whitespace-nowrap text-xs">{r.date}</Cell>
            <Cell className="text-xs">{r.month}</Cell>
            <Cell>{r.supplier}</Cell>
            <Cell mono>{r.invoiceNumber}</Cell>
            <Cell mono>{r.grnNumber || "-"}</Cell>
            <Cell mono className="text-teal-700 dark:text-teal-400">{r.partNumber}</Cell>
            <Cell strong>{r.description}</Cell>
            <Cell>{r.category}</Cell>
            <Cell>{r.department}</Cell>
            {/* Direction is carried by an arrow, not just the +/- sign, so
                which way material moved is readable at a glance (and not by
                colour alone). Inward = into the store. */}
            <Cell num className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                <ArrowDownToLine className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  +{r.quantity} {r.unit}
                </span>
                <span className="sr-only">received into store</span>
              </span>
            </Cell>
            <Cell num strong className="text-right">
              ₹{Math.round(r.quantity * r.unitValue).toLocaleString("en-IN")}
            </Cell>
            <Cell>{r.receivedBy}</Cell>
            <Cell>{r.verifiedBy}</Cell>
            {canWrite && (
              <Cell className="text-center">
                <button
                  onClick={() => setEditRow(r)}
                  className="rounded-md p-1.5 text-slate-800 transition hover:bg-slate-100 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-400"
                  title="Edit this entry"
                  aria-label={`Edit inward entry ${r.partNumber}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </Cell>
            )}
          </Row>
        ))}
      </TableShell>

      {showForm && (
        <InwardModal
          lockedDepartment={session.role === "PROCESS_OWNER" ? session.department : null}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            toast("Inward entry saved — stock updated.");
            load();
          }}
        />
      )}

      {editRow && (
        <EditInwardModal
          entry={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            toast("Inward entry updated — stock adjusted.");
            load();
          }}
        />
      )}
    </div>
  );
}

function EditInwardModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: InwardRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    date: entry.date,
    supplier: entry.supplier,
    invoiceNumber: entry.invoiceNumber,
    grnNumber: entry.grnNumber || "",
    quantity: String(entry.quantity),
    unitValue: String(entry.unitValue ?? ""),
    receivedBy: entry.receivedBy,
    verifiedBy: entry.verifiedBy,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/inward/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to update entry");
      setSaving(false);
      return;
    }
    onSaved();
  }

  async function doDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/inward/${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to delete entry");
      setDeleting(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Inward Entry"
      description={`${entry.partNumber} — ${entry.description}`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Receipt">
          <Field label="Date">
            {(id) => <input id={id} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Quantity" required>
            {(id) => <input id={id} required type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Unit Value (₹)" required>
            {(id) => <input id={id} required type="number" min={0} step="any" value={form.unitValue} onChange={(e) => set("unitValue", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Supplier">
            {(id) => <input id={id} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        <FormSection title="Documentation">
          <Field label="Invoice Number">
            {(id) => <input id={id} value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="GRN No.">
            {(id) => <input id={id} value={form.grnNumber} onChange={(e) => set("grnNumber", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Received By">
            {(id) => <input id={id} value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Verified By">
            {(id) => <input id={id} value={form.verifiedBy} onChange={(e) => set("verifiedBy", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] text-slate-800 dark:text-slate-300">
          Changing quantity automatically adjusts current stock by the difference.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <ConfirmDelete
            confirming={confirmDelete}
            onRequest={() => setConfirmDelete(true)}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={doDelete}
            busy={deleting}
            question="Delete this entry permanently?"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function InwardModal({
  onClose,
  onCreated,
  lockedDepartment,
}: {
  onClose: () => void;
  onCreated: () => void;
  lockedDepartment: string | null;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    partNumber: "",
    description: "",
    category: "",
    unit: "",
    department: lockedDepartment || "",
    supplier: "",
    invoiceNumber: "",
    grnNumber: "",
    quantity: "",
    receivedBy: "",
    verifiedBy: "",
    remarks: "",
    minStock: "",
    maxStock: "",
    unitValue: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "found" | "not-found">("idle");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function lookupPart(pn: string) {
    if (!pn) {
      setLookupState("idle");
      return;
    }
    const res = await fetch(`/api/materials?q=${encodeURIComponent(pn)}`);
    if (res.ok) {
      const list: MaterialLite[] = await res.json();
      const match = list.find((m) => m.partNumber.toLowerCase() === pn.toLowerCase());
      if (match) {
        setForm((f) => ({
          ...f,
          description: match.description,
          category: match.category,
          unit: match.unit,
          department: lockedDepartment || match.department,
          supplier: f.supplier || match.supplier,
          unitValue: f.unitValue || String(match.unitValue || ""),
        }));
        setLookupState("found");
      } else {
        setLookupState("not-found");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Brand-new part number: create the Material Master record first (this
    // is why the part number normally needs to exist — stock is tracked
    // against a material record — but you no longer have to leave this
    // screen to do it).
    if (lookupState === "not-found") {
      if (!form.description || !form.category || !form.department || !form.unit || !form.minStock || !form.maxStock || !form.unitValue) {
        setError("New part number — please fill in Description, Category, Department, Unit, Min Stock, Max Stock and Unit Value so the material can be created.");
        setSaving(false);
        return;
      }
      const matRes = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          partNumber: form.partNumber,
          category: form.category,
          department: form.department,
          unit: form.unit,
          minStock: form.minStock,
          maxStock: form.maxStock,
          unitValue: form.unitValue,
          openingStock: 0,
          supplier: form.supplier,
        }),
      });
      if (!matRes.ok) {
        const d = await matRes.json();
        setError(d.error || "Failed to create the new material");
        setSaving(false);
        return;
      }
      setLookupState("found");
    }

    const res = await fetch("/api/inward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to save entry");
      setSaving(false);
      return;
    }
    onCreated();
  }

  return (
    <Modal open onClose={onClose} title="New Inward Entry" description="Records a goods receipt and adds to stock" size="xl">
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Identify the part" description="Enter a part number and tab out — known parts fill themselves in.">
          <Field label="Inward Date">
            {(id) => <input id={id} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />}
          </Field>
          <Field
            label="Part Number"
            required
            hint={lookupState === "found" ? "Material found — fields auto-filled below (editable)" : undefined}
          >
            {(id) => (
              <input
                id={id}
                required
                value={form.partNumber}
                onChange={(e) => set("partNumber", e.target.value)}
                onBlur={(e) => lookupPart(e.target.value)}
                placeholder="e.g. PN-1001"
                className={`${inputClass} font-mono`}
              />
            )}
          </Field>

          {lookupState === "not-found" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 sm:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                New part — not in Material Master yet
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400/90">
                Fill in the fields below and the material will be created automatically when you save.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Minimum Stock" required>
                  {(id) => (
                    <input id={id} required type="number" min={0} value={form.minStock} onChange={(e) => set("minStock", e.target.value)}
                      className={`${inputClass} bg-white dark:bg-slate-900`} />
                  )}
                </Field>
                <Field label="Maximum Stock" required>
                  {(id) => (
                    <input id={id} required type="number" min={0} value={form.maxStock} onChange={(e) => set("maxStock", e.target.value)}
                      className={`${inputClass} bg-white dark:bg-slate-900`} />
                  )}
                </Field>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="Material details">
          <Field label="Material Description" className="sm:col-span-2">
            {(id) => <input id={id} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Category">
            {(id) => (
              <>
                <input id={id} list="category-suggestions-inward" value={form.category} onChange={(e) => set("category", e.target.value)}
                  placeholder="Start typing e.g. Fixtures…" className={inputClass} />
                <datalist id="category-suggestions-inward">
                  {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Department" hint={lockedDepartment ? "Locked to your process area." : undefined}>
            {(id) =>
              lockedDepartment ? (
                <input id={id} value={form.department} disabled className={inputClass} />
              ) : (
                <select id={id} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputClass}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )
            }
          </Field>
          <Field label="Unit">
            {(id) => (
              <>
                <input id={id} list="unit-suggestions-inward" value={form.unit} onChange={(e) => set("unit", e.target.value)}
                  placeholder="Nos, Kg, Litre…" className={inputClass} />
                <datalist id="unit-suggestions-inward">
                  {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
                </datalist>
              </>
            )}
          </Field>
        </FormSection>

        <FormSection title="Quantity &amp; cost">
          <Field label="Quantity" required>
            {(id) => <input id={id} required type="number" min={1} step="any" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />}
          </Field>
          <Field
            label="Unit Value (₹)"
            required
            hint="Price actually paid this shipment — drives this department's spend against its monthly budget."
          >
            {(id) => (
              <input id={id} required type="number" min={0} step="any" value={form.unitValue} onChange={(e) => set("unitValue", e.target.value)}
                placeholder="Cost per unit, this shipment" className={inputClass} />
            )}
          </Field>
        </FormSection>

        <FormSection title="Documentation">
          <Field label="Supplier" className="sm:col-span-2">
            {(id) => <input id={id} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Invoice Number">
            {(id) => <input id={id} value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="GRN No.">
            {(id) => <input id={id} value={form.grnNumber} onChange={(e) => set("grnNumber", e.target.value)} placeholder="Goods Receipt Note #" className={inputClass} />}
          </Field>
          <Field label="Received By">
            {(id) => <input id={id} value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Verified By">
            {(id) => <input id={id} value={form.verifiedBy} onChange={(e) => set("verifiedBy", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Remarks" className="sm:col-span-2">
            {(id) => <input id={id} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save Entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
