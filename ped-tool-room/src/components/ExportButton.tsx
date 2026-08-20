"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";

type Format = "pdf" | "excel";

export function ExportButton({
  reportType,
  department,
  q,
  status,
}: {
  reportType: "outward" | "inward" | "stock-summary" | "materials";
  department: string;
  q?: string;
  status?: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function runExport(scope: "filtered" | "all") {
    const params = new URLSearchParams({ type: reportType, scope, department });
    if (scope === "filtered" && q) params.set("q", q);
    if (scope === "filtered" && status) params.set("status", status);
    const endpoint = format === "pdf" ? "/api/reports/pdf" : "/api/reports/excel";
    window.open(`${endpoint}?${params.toString()}`, "_blank");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" /> Export
        <ChevronDown className={`h-3.5 w-3.5 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:bg-slate-900 dark:border-slate-700">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Format</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setFormat("pdf")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  format === "pdf"
                    ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
                    : "border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
              <button
                onClick={() => setFormat("excel")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  format === "excel"
                    ? "border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                    : "border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </button>
            </div>
          </div>

          <button
            onClick={() => runExport("filtered")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-900 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">Current filtered view</span>
              <span className="block text-[11px] text-slate-800 dark:text-slate-300">Applies active search / filters</span>
            </span>
          </button>
          <button
            onClick={() => runExport("all")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-900 hover:bg-slate-50 border-t border-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">Entire dataset</span>
              <span className="block text-[11px] text-slate-800 dark:text-slate-300">Everything you have access to</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
