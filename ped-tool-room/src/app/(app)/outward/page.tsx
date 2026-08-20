"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, ArrowUpFromLine } from "lucide-react";
import { useAppContext } from "../layout";
import { ExportButton } from "@/components/ExportButton";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { TableShell, Row, Cell, PageHeader, FilterChip, type Column } from "@/components/DataTable";
import { Field, FormSection, ConfirmDelete, inputClass } from "@/components/Field";

interface OutwardRow {
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
  department: string;
  issuedBy: string;
  remarks: string;
}

interface MaterialLite {
  partNumber: string;
  description: string;
  category: string;
  unit: string;
  department: string;
  currentStock: number;
}

const BASE_COLUMNS: Column[] = [
  { label: "Date", width: "w-24" }, { label: "Month", width: "w-20" },
  { label: "Part No.", width: "w-28" }, "Description",
  { label: "Category", width: "w-28" },
  { label: "Qty", align: "right", width: "w-24" },
  { label: "Nos", align: "right", width: "w-16" },
  "Issued To", "Purpose", "Received By",
  { label: "Dept", width: "w-32" }, "Issued By", "Remarks",
];

// Auto-filled, read-only fields — visually distinct from anything you can type in.
const readOnlyFieldClass =
  "w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";

export default function OutwardPage() {
  const { session, department } = useAppContext();
  const toast = useToast();
  const [rows, setRows] = useState<OutwardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<OutwardRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"today" | "month" | "all">("all");
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/outward?department=${encodeURIComponent(department)}`);
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: fetching data in response to `department` changing.
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
  const totalIssued = filteredRows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Outward Register"
        caption={`${filteredRows.length} ${filteredRows.length === 1 ? "entry" : "entries"}${
          department !== "All" ? ` · ${department}` : ""
        } · ${totalIssued.toLocaleString("en-IN")} issued`}
        actions={
          <>
            <ExportButton reportType="outward" department={department} />
            {canWrite && (
              <ExcelImportButton
                endpoint="/api/outward/bulk-import"
                templateColumns={["Date", "Part Number", "Quantity", "Issued To", "Purpose", "Received By", "Remarks"]}
                templateFileName="outward_import_template.xlsx"
                onImported={load}
              />
            )}
            {canWrite && (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Issue Material
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
            Read-only view — Monitoring users cannot issue materials.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <TableShell
        columns={columns}
        loading={loading}
        isEmpty={filteredRows.length === 0}
        emptyMessage={period === "all" ? "No outward entries yet." : "Nothing issued in this period."}
        emptyHint={
          period !== "all"
            ? "Switch to All to see the full register."
            : canWrite
              ? "Use Issue Material to record the first issue from the store."
              : undefined
        }
        caption="Outward issue register"
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
            <Cell mono className="text-teal-700 dark:text-teal-400">{r.partNumber}</Cell>
            <Cell strong className="whitespace-nowrap">{r.description}</Cell>
            <Cell>{r.category}</Cell>
            {/* Mirrors the Inward arrow — outward = out of the store. */}
            <Cell num className="text-right font-semibold text-orange-700 dark:text-orange-400">
              <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                <ArrowUpFromLine className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>-{r.quantity}</span>
                <span className="sr-only">issued out of store</span>
              </span>
            </Cell>
            <Cell num className="text-right">{r.nos}</Cell>
            <Cell>{r.issuedTo}</Cell>
            <Cell>{r.purpose}</Cell>
            <Cell>{r.receivedBy}</Cell>
            <Cell>{r.department}</Cell>
            <Cell>{r.issuedBy}</Cell>
            <Cell>{r.remarks}</Cell>
            {canWrite && (
              <Cell className="text-center">
                <button
                  onClick={() => setEditRow(r)}
                  className="rounded-md p-1.5 text-slate-800 transition hover:bg-slate-100 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-400"
                  title="Edit this entry"
                  aria-label={`Edit outward entry ${r.partNumber}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </Cell>
            )}
          </Row>
        ))}
      </TableShell>

      {showForm && (
        <OutwardModal
          lockedDepartment={session.role === "PROCESS_OWNER" ? session.department : null}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); toast("Material issued — stock deducted."); load(); }}
          onError={setError}
        />
      )}

      {editRow && (
        <EditOutwardModal
          entry={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); toast("Outward entry updated — stock adjusted."); load(); }}
        />
      )}
    </div>
  );
}

function EditOutwardModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: OutwardRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    date: entry.date,
    quantity: String(entry.quantity),
    issuedTo: entry.issuedTo,
    purpose: entry.purpose,
    receivedBy: entry.receivedBy,
    remarks: entry.remarks,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function doDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/outward/${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to delete entry");
      setDeleting(false);
      return;
    }
    onSaved();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/outward/${entry.id}`, {
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

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Outward Entry"
      description={`${entry.partNumber} — ${entry.description}`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Issue">
          <Field label="Date">
            {(id) => <input id={id} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Quantity" required>
            {(id) => <input id={id} required type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Issued To">
            {(id) => <input id={id} value={form.issuedTo} onChange={(e) => set("issuedTo", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Purpose">
            {(id) => <input id={id} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Received By">
            {(id) => <input id={id} value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Remarks">
            {(id) => <input id={id} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] text-slate-800 dark:text-slate-300">
          Changing quantity automatically adjusts current stock by the difference (blocked if it would exceed available stock).
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

function OutwardModal({
  onClose,
  onCreated,
  onError,
  lockedDepartment,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (e: string | null) => void;
  lockedDepartment: string | null;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    partNumber: "",
    description: "",
    category: "",
    department: lockedDepartment || "",
    quantity: "",
    nos: "",
    issuedTo: "",
    purpose: "",
    receivedBy: "",
    remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
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
          department: lockedDepartment || match.department,
        }));
        setAvailableStock(match.currentStock);
        setLookupState("found");
      } else {
        setAvailableStock(null);
        setLookupState("not-found");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    onError(null);
    const res = await fetch("/api/outward", {
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

  const overIssuing =
    availableStock !== null && form.quantity !== "" && Number(form.quantity) > availableStock;

  return (
    <Modal open onClose={onClose} title="Issue Material (Outward)" description="Deducts from current stock" size="xl">
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Identify the part" description="Enter a part number and tab out to load its details and available stock.">
          <Field label="Date">
            {(id) => <input id={id} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />}
          </Field>
          <Field
            label="Part Number"
            required
            error={lookupState === "not-found" ? "No material found for this part number" : undefined}
          >
            {(id) => (
              <input
                id={id}
                required
                value={form.partNumber}
                onChange={(e) => set("partNumber", e.target.value)}
                onBlur={(e) => lookupPart(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            )}
          </Field>

          {lookupState === "found" && (
            <div className="rounded-lg border border-teal-600/25 bg-teal-600/[0.06] px-4 py-3 sm:col-span-2">
              <p className="eyebrow">Available stock</p>
              <p className="text-value mt-0.5 text-xl font-semibold tabular-nums">{availableStock}</p>
            </div>
          )}
        </FormSection>

        <FormSection title="Material" description="Filled in from the master record — not editable here.">
          <Field label="Description" className="sm:col-span-2">
            {(id) => <input id={id} value={form.description} disabled className={readOnlyFieldClass} />}
          </Field>
          <Field label="Category">
            {(id) => <input id={id} value={form.category} disabled className={readOnlyFieldClass} />}
          </Field>
          <Field label="Department">
            {(id) => <input id={id} value={form.department} disabled className={readOnlyFieldClass} />}
          </Field>
        </FormSection>

        <FormSection title="Quantity">
          <Field
            label="Quantity"
            required
            error={overIssuing ? `Only ${availableStock} available — this will be rejected.` : undefined}
          >
            {(id) => (
              <input id={id} required type="number" min={1} step="any" value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)} className={inputClass} />
            )}
          </Field>
          <Field label="Nos">
            {(id) => (
              <input id={id} type="number" min={0} value={form.nos} onChange={(e) => set("nos", e.target.value)}
                placeholder="Defaults to Quantity" className={inputClass} />
            )}
          </Field>
        </FormSection>

        <FormSection title="Issue record">
          <Field label="Issued To">
            {(id) => <input id={id} value={form.issuedTo} onChange={(e) => set("issuedTo", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Purpose">
            {(id) => <input id={id} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Received By">
            {(id) => <input id={id} value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Remarks">
            {(id) => <input id={id} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Issue Material"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
