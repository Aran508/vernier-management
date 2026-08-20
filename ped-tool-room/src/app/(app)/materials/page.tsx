"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Badge, stockTone } from "@/components/Badge";
import { useAppContext } from "../layout";
import { DEPARTMENTS, CATEGORY_SUGGESTIONS } from "@/lib/types";
import { ExportButton } from "@/components/ExportButton";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { TableShell, Row, Cell, PageHeader, StockGauge, type Column } from "@/components/DataTable";
import { Field, FormSection, ConfirmDelete, inputClass } from "@/components/Field";

interface MaterialRow {
  id: string;
  description: string;
  partNumber: string;
  category: string;
  department: string;
  unit: string;
  location: string;
  minStock: number;
  maxStock: number;
  currentStock: number;
  supplier: string;
  stockStatus: string;
  noMovementDays: number | null;
}

// Widths are declared so Description absorbs the slack instead of the short
// columns sprawling; numerics are right-aligned so header and figures line up.
const COLUMNS: Column[] = [
  { label: "Part No.", width: "w-28" },
  "Description",
  { label: "Category", width: "w-32" },
  { label: "Department", width: "w-36" },
  { label: "Location", width: "w-24" },
  { label: "Current", align: "right", width: "w-24" },
  { label: "Min / Max", align: "right", width: "w-36" },
  { label: "Status", width: "w-28" },
];

export default function MaterialsPage() {
  const { session, department } = useAppContext();
  const toast = useToast();
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const openPartNumber = searchParams.get("open");
    if (!openPartNumber) return;
    fetch(`/api/materials?department=All&q=${encodeURIComponent(openPartNumber)}`)
      .then((r) => r.json())
      .then((rows: MaterialRow[]) => {
        const match = rows.find((r) => r.partNumber === openPartNumber);
        if (match) setDetailId(match.id);
        router.replace("/materials"); // clean the URL, keep the modal open
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ department, ...(query ? { q: query } : {}) });
    const res = await fetch(`/api/materials?${params}`);
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: fetching data in response to `department` changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const canWrite = session.role === "STORE_ADMIN";
  const lowCount = rows.filter((r) => r.stockStatus === "Low" || r.stockStatus === "Out of Stock").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Material Master"
        caption={`${rows.length} ${rows.length === 1 ? "material" : "materials"}${
          department !== "All" ? ` · ${department}` : ""
        }${lowCount > 0 ? ` · ${lowCount} at or below minimum` : ""}`}
        actions={
          <>
            <ExportButton reportType="materials" department={department} q={query} />
            {canWrite && (
              <ExcelImportButton
                endpoint="/api/materials/bulk-import"
                templateColumns={["Part Number", "Description", "Category", "Department", "Unit", "Location", "Min Stock", "Max Stock", "Opening Stock", "Unit Value", "Supplier", "Remarks"]}
                templateFileName="material_master_template.xlsx"
                onImported={load}
              />
            )}
            {canWrite && (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Add Material
              </button>
            )}
          </>
        }
      />

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by description, part number, category, location, supplier…"
          aria-label="Filter materials"
          className={`${inputClass} pl-10`}
        />
      </div>

      <TableShell
        columns={COLUMNS}
        loading={loading}
        isEmpty={rows.length === 0}
        emptyMessage={query ? "No materials match that filter." : "No materials yet."}
        emptyHint={
          query
            ? "Try a shorter search term, or clear the filter to see everything."
            : canWrite
              ? "Use Add Material to create your first record, or import an existing sheet."
              : undefined
        }
        caption="Material master records"
      >
        {rows.map((m) => (
          <Row key={m.id} onClick={() => setDetailId(m.id)} title="Open material details">
            <Cell mono className="text-teal-700 dark:text-teal-400">{m.partNumber}</Cell>
            <Cell strong>{m.description}</Cell>
            <Cell>{m.category}</Cell>
            <Cell>{m.department}</Cell>
            <Cell mono>{m.location}</Cell>
            <Cell num strong>
              {m.currentStock} <span className="text-label font-normal">{m.unit}</span>
            </Cell>
            <Cell className="text-right">
              <StockGauge current={m.currentStock} min={m.minStock} max={m.maxStock} unit={m.unit} />
            </Cell>
            <Cell>
              <Badge label={m.stockStatus} tone={stockTone(m.stockStatus)} blink={m.stockStatus === "Low" || m.stockStatus === "Out of Stock"} />
            </Cell>
          </Row>
        ))}
      </TableShell>

      {showForm && (
        <AddMaterialModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            toast("Material created.");
            load();
          }}
          defaultDepartment={department !== "All" ? department : DEPARTMENTS[0]}
        />
      )}

      {detailId && (
        <MaterialDetailModal
          id={detailId}
          canEdit={canWrite}
          onClose={() => setDetailId(null)}
          onChanged={(action) => {
            setDetailId(null);
            toast(action === "deleted" ? "Material deleted." : "Material updated.");
            load();
          }}
        />
      )}
    </div>
  );
}

interface MaterialDetail extends MaterialRow {
  warehouse: string;
  rack: string;
  row: string;
  shelf: string;
  openingStock: number;
  unitValue: number;
  remarks: string;
  status: string;
  createdDate: string;
  createdBy: string;
  modifiedDate: string;
  modifiedBy: string;
  lastInwardDate: string | null;
  lastOutwardDate: string | null;
}

function MaterialDetailModal({
  id,
  canEdit,
  onClose,
  onChanged,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (action: "saved" | "deleted") => void;
}) {
  const [mat, setMat] = useState<MaterialDetail | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/materials/${id}`)
      .then((r) => r.json())
      .then((d: MaterialDetail) => {
        setMat(d);
        setForm({
          partNumber: d.partNumber,
          description: d.description,
          category: d.category,
          department: d.department,
          unit: d.unit,
          location: d.location,
          warehouse: d.warehouse || "",
          rack: d.rack || "",
          row: d.row || "",
          shelf: d.shelf || "",
          minStock: String(d.minStock),
          maxStock: String(d.maxStock),
          currentStock: String(d.currentStock),
          unitValue: String(d.unitValue),
          supplier: d.supplier,
          remarks: d.remarks || "",
          status: d.status || "Active",
        });
      });
  }, [id]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/materials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to update material");
      setSaving(false);
      return;
    }
    onChanged("saved");
  }

  async function doDelete() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to delete material");
      setSaving(false);
      return;
    }
    onChanged("deleted");
  }

  if (!mat) {
    return (
      <Modal open onClose={onClose} title="Loading material…" size="xl">
        <div className="p-8"><div className="skeleton h-40 rounded-lg" /></div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mat.partNumber}
      description={mode === "edit" ? "Editing material" : "Material details"}
      size="xl"
    >
      {mode === "view" ? (
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-section text-value">{mat.description}</p>
              <p className="text-label mt-1 text-xs">{mat.category} · {mat.department}</p>
            </div>
            <Badge label={mat.stockStatus} tone={stockTone(mat.stockStatus)} blink={mat.stockStatus === "Low" || mat.stockStatus === "Out of Stock"} />
          </div>

          {/* Stock reads as its own block — it's the reason most people open this. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StockTile label="Current" value={`${mat.currentStock}`} unit={mat.unit} emphasis />
            <StockTile label="Minimum" value={String(mat.minStock)} />
            <StockTile label="Maximum" value={String(mat.maxStock)} />
            <StockTile label="Opening" value={String(mat.openingStock)} unit={mat.unit} />
          </div>

          <DetailGroup title="Valuation">
            <DetailRow label="Unit Value" value={`₹${mat.unitValue?.toLocaleString?.() ?? mat.unitValue}`} />
            <DetailRow label="Inventory Value" value={`₹${(mat.currentStock * mat.unitValue).toLocaleString()}`} />
          </DetailGroup>

          <DetailGroup title="Storage">
            <DetailRow label="Location" value={mat.location || "-"} />
            <DetailRow label="Warehouse / Rack / Row / Shelf" value={`${mat.warehouse || "-"} / ${mat.rack || "-"} / ${mat.row || "-"} / ${mat.shelf || "-"}`} />
            <DetailRow label="Supplier" value={mat.supplier || "-"} />
          </DetailGroup>

          <DetailGroup title="Movement">
            <DetailRow label="No Movement" value={mat.noMovementDays !== null ? `${mat.noMovementDays} days` : "-"} />
            <DetailRow label="Last Inward" value={mat.lastInwardDate || "-"} />
            <DetailRow label="Last Outward" value={mat.lastOutwardDate || "-"} />
          </DetailGroup>

          <DetailGroup title="Record">
            <DetailRow label="Created By" value={`${mat.createdBy} on ${mat.createdDate}`} />
            <DetailRow label="Modified By" value={`${mat.modifiedBy} on ${mat.modifiedDate}`} />
            {mat.remarks && <DetailRow label="Remarks" value={mat.remarks} span2 />}
          </DetailGroup>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button onClick={onClose} className="btn-secondary">Close</button>
            {canEdit && (
              <>
                <ConfirmDelete
                  confirming={confirmDelete}
                  onRequest={() => setConfirmDelete(true)}
                  onCancel={() => setConfirmDelete(false)}
                  onConfirm={doDelete}
                  busy={saving}
                  question="Delete this material permanently?"
                />
                {!confirmDelete && (
                  <button onClick={() => setMode("edit")} className="btn-primary">Edit</button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={saveEdit} className="space-y-5 p-5">
          <FormSection title="Identification" columns={1}>
            <Field label="Part Number">
              {(id) => (
                <input id={id} value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} className={`${inputClass} font-mono`} />
              )}
            </Field>
            <Field label="Description">
              {(id) => <input id={id} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />}
            </Field>
          </FormSection>

          <FormSection title="Classification">
            <Field label="Category">
              {(id) => (
                <>
                  <input id={id} list="category-suggestions-edit" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Start typing e.g. Fixtures…" className={inputClass} />
                  <datalist id="category-suggestions-edit">
                    {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Department">
              {(id) => (
                <select id={id} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputClass}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </Field>
            <Field label="Unit">
              {(id) => <input id={id} value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Location Code">
              {(id) => <input id={id} value={form.location} onChange={(e) => set("location", e.target.value)} className={inputClass} />}
            </Field>
          </FormSection>

          <FormSection title="Inventory levels" description="Stock status on every screen is derived from these limits.">
            <Field label="Minimum Stock">
              {(id) => <input id={id} type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Maximum Stock">
              {(id) => <input id={id} type="number" value={form.maxStock} onChange={(e) => set("maxStock", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Current Stock" hint="Manual correction — normally set by inward/outward.">
              {(id) => <input id={id} type="number" value={form.currentStock} onChange={(e) => set("currentStock", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Unit Value (₹)">
              {(id) => <input id={id} type="number" value={form.unitValue} onChange={(e) => set("unitValue", e.target.value)} className={inputClass} />}
            </Field>
          </FormSection>

          <FormSection title="Supply" columns={1}>
            <Field label="Supplier">
              {(id) => <input id={id} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Remarks">
              {(id) => <input id={id} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} />}
            </Field>
          </FormSection>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" onClick={() => setMode("view")} className="btn-secondary">Back</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function StockTile({ label, value, unit, emphasis }: { label: string; value: string; unit?: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${emphasis ? "border-teal-600/30 bg-teal-600/[0.06]" : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/40"}`}>
      <p className="eyebrow">{label}</p>
      <p className="text-value mt-1 text-xl font-semibold tabular-nums">
        {value}
        {unit && <span className="text-label ml-1 text-xs font-normal">{unit}</span>}
      </p>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
      <h4 className="eyebrow mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, span2 = false }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-slate-800 dark:text-slate-300">{label}</p>
      <p className="text-value mt-0.5">{value}</p>
    </div>
  );
}

function AddMaterialModal({
  onClose,
  onCreated,
  defaultDepartment,
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultDepartment: string;
}) {
  const [form, setForm] = useState({
    description: "",
    partNumber: "",
    category: "",
    department: defaultDepartment,
    unit: "Nos",
    location: "",
    minStock: "",
    maxStock: "",
    openingStock: "",
    unitValue: "",
    supplier: "",
    remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create material");
      setSaving(false);
      return;
    }
    onCreated();
  }

  return (
    <Modal open onClose={onClose} title="Add Material" description="Creates a new master record" size="xl">
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Basic information" description="What the item is and where it belongs.">
          <Field label="Description" required className="sm:col-span-2">
            {(id) => <input id={id} required value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Part Number" required>
            {(id) => <input id={id} required value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} className={`${inputClass} font-mono`} />}
          </Field>
          <Field label="Category" required>
            {(id) => (
              <>
                <input id={id} required list="category-suggestions-add" value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass} />
                <datalist id="category-suggestions-add">
                  {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Department" required>
            {(id) => (
              <select id={id} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputClass}>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </Field>
          <Field label="Unit" required>
            {(id) => <input id={id} required value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        <FormSection title="Inventory levels" description="Used to flag low and excess stock across the app.">
          <Field label="Minimum Stock" required>
            {(id) => <input id={id} required type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Maximum Stock" required>
            {(id) => <input id={id} required type="number" value={form.maxStock} onChange={(e) => set("maxStock", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Opening Stock">
            {(id) => <input id={id} type="number" value={form.openingStock} onChange={(e) => set("openingStock", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Unit Value (₹)">
            {(id) => <input id={id} type="number" value={form.unitValue} onChange={(e) => set("unitValue", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        <FormSection title="Storage &amp; supply" columns={1}>
          <Field label="Location Code" hint="Format A11-03-05 — warehouse, rack, shelf.">
            {(id) => <input id={id} value={form.location} onChange={(e) => set("location", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Supplier">
            {(id) => <input id={id} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Remarks">
            {(id) => <input id={id} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save Material"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
