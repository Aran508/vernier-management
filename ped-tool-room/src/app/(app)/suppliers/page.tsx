"use client";

import { useEffect, useState } from "react";
import { Search, Truck, Package, IndianRupee, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/DataTable";
import { inputClass } from "@/components/Field";

interface SupplierSummary {
  supplier: string;
  materialCount: number;
  totalQuantity: number;
  totalValue: number;
}

interface SupplierMaterialLine {
  partNumber: string;
  description: string;
  category: string;
  totalQuantity: number;
  totalValue: number;
  lastReceivedDate: string | null;
}

interface SupplierDetail {
  supplier: string;
  totalQuantity: number;
  totalValue: number;
  materials: SupplierMaterialLine[];
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function SuppliersPage() {
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/suppliers${params}`);
    setSuppliers(await res.json());
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!selected) {
      // Intentional: clearing stale detail when the selection is cleared.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    // Intentional: fetching supplier detail whenever the selection changes.
    setDetailLoading(true);
    fetch(`/api/suppliers/${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d: SupplierDetail) => {
        setDetail(d);
        setDetailLoading(false);
      });
  }, [selected]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        caption={`${
          suppliers === null ? "Loading…" : `${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"}`
        } — from Material Master and the Inward register`}
      />

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search suppliers…"
          aria-label="Search suppliers"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Side column — supplier list */}
        <div className="card overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {suppliers === null ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 m-2 rounded-lg" />)
            ) : suppliers.length === 0 ? (
              <p className="px-4 py-8 text-center text-label text-sm">No suppliers found.</p>
            ) : (
              suppliers.map((s) => (
                <button
                  key={s.supplier}
                  onClick={() => setSelected(s.supplier)}
                  className={`w-full flex items-center justify-between gap-2 border-l-2 px-4 py-3 text-left transition ${
                    selected === s.supplier
                      ? "border-teal-600 bg-teal-600/[0.08]"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-value text-sm font-medium truncate">{s.supplier}</p>
                    <p className="text-label text-xs mt-0.5">
                      {s.materialCount} item{s.materialCount === 1 ? "" : "s"} · {inr(s.totalValue)}
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 ${selected === s.supplier ? "text-teal-600 dark:text-teal-400" : "text-slate-300 dark:text-slate-600"}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="card p-5 min-h-[300px]">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                <Truck className="h-6 w-6 text-slate-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-value text-sm font-medium">No supplier selected</p>
                <p className="text-label mx-auto mt-1 max-w-xs text-xs">
                  Pick a supplier on the left to see everything received from them, by part.
                </p>
              </div>
            </div>
          ) : detailLoading || !detail ? (
            <div className="space-y-3">
              <div className="skeleton h-8 w-48 rounded" />
              <div className="skeleton h-24 rounded-lg" />
              <div className="skeleton h-24 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="min-w-0">
                  <span className="section-rule" />
                  <h2 className="text-section text-value">{detail.supplier}</h2>
                  <p className="text-label mt-1 text-xs">
                    {detail.materials.length} part{detail.materials.length === 1 ? "" : "s"} received
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-lg border border-slate-200 px-4 py-2.5 text-right dark:border-slate-700">
                    <p className="eyebrow flex items-center justify-end gap-1"><Package className="h-3 w-3" /> Total Received</p>
                    <p className="text-value mt-1 text-xl font-semibold tabular-nums">{detail.totalQuantity.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="rounded-lg border border-teal-600/25 bg-teal-600/[0.06] px-4 py-2.5 text-right">
                    <p className="eyebrow flex items-center justify-end gap-1"><IndianRupee className="h-3 w-3" /> Total Spent</p>
                    <p className="text-value mt-1 text-xl font-semibold tabular-nums">{inr(detail.totalValue)}</p>
                  </div>
                </div>
              </div>

              {detail.materials.length === 0 ? (
                <p className="text-label text-sm py-8 text-center">No inward history from this supplier yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40">
                        {["Part No.", "Description", "Category", "Qty Received", "Value", "Last Received"].map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300 ${
                              i === 3 || i === 4 ? "text-right" : "text-left"
                            } ${i === 0 ? "rounded-l-lg" : ""} ${i === 5 ? "rounded-r-lg" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.materials.map((m, i) => (
                        <tr key={m.partNumber} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2.5 text-teal-600 dark:text-teal-400 font-mono text-xs">
                            {i === 0 && <span className="mr-1.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase align-middle">Top</span>}
                            {m.partNumber}
                          </td>
                          <td className="px-3 py-2.5 text-value">{m.description}</td>
                          <td className="px-3 py-2.5 text-label">{m.category}</td>
                          <td className="px-3 py-2.5 text-right text-value tabular-nums font-medium">{m.totalQuantity.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2.5 text-right text-value tabular-nums">{inr(m.totalValue)}</td>
                          <td className="px-3 py-2.5 text-label text-xs whitespace-nowrap">{m.lastReceivedDate || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
