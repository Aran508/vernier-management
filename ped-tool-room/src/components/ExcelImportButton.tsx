"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, X, FileSpreadsheet, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { findHeaderRowIndex } from "@/lib/importNormalize";

interface ImportResult {
  created: number;
  skipped?: number;
  incomplete?: number;
  needsReview?: { row: number; partNumber: string; missing: string[] }[];
  errors: { row: number; reason: string }[];
}

export function ExcelImportButton({
  endpoint,
  templateColumns,
  templateFileName,
  label = "Import Excel",
  onImported,
}: {
  endpoint: string;
  templateColumns: string[];
  templateFileName: string;
  label?: string;
  onImported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        <Upload className="h-4 w-4" /> {label}
      </button>
      {open && (
        <ImportModal
          endpoint={endpoint}
          templateColumns={templateColumns}
          templateFileName={templateFileName}
          onClose={() => setOpen(false)}
          onImported={onImported}
        />
      )}
    </>
  );
}

function downloadTemplate(columns: string[], fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet([columns]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, fileName);
}

function ImportModal({
  endpoint,
  templateColumns,
  templateFileName,
  onClose,
  onImported,
}: {
  endpoint: string;
  templateColumns: string[];
  templateFileName: string;
  onClose: () => void;
  onImported?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // cellDates: true so real Excel date cells parse into JS Date
        // objects instead of raw serial numbers like "45678".
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // Parse as a plain grid first (no assumed header row) so we can
        // locate the real header row ourselves — some exports have a title,
        // logo, or blank rows above the actual column headers, which would
        // otherwise be mistaken for the header and blank out every field.
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
        if (grid.length === 0) {
          setError("No rows found in the first sheet of this file.");
          setParsedRows([]);
          setRowCount(0);
          return;
        }
        const headerIdx = findHeaderRowIndex(grid);
        const headerRow = (grid[headerIdx] ?? []).map((h) => String(h ?? "").trim());
        const dataRows = grid.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
        const json = dataRows.map((r) => {
          const obj: Record<string, unknown> = {};
          headerRow.forEach((h, i) => {
            if (h) obj[h] = r[i] ?? "";
          });
          return obj;
        });
        if (json.length === 0) {
          setError("No data rows found below the header row in this file.");
          setParsedRows([]);
          setRowCount(0);
          return;
        }
        // Convert any Date-typed cells (e.g. a "Date" column) to a plain
        // YYYY-MM-DD string our API expects, and trim stray whitespace from
        // text cells (a very common cause of "field is missing" errors when
        // someone pastes data in from elsewhere).
        const cleaned = json.map((row) => {
          const out: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value instanceof Date) {
              out[key] = value.toISOString().slice(0, 10);
            } else if (typeof value === "string") {
              out[key] = value.trim();
            } else {
              out[key] = value;
            }
          }
          return out;
        });
        setParsedRows(cleaned);
        setRowCount(cleaned.length);
      } catch {
        setError("Couldn't read that file. Make sure it's a valid .xlsx or .xls file.");
      }
    };
    reader.readAsBinaryString(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function doImport() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        setUploading(false);
        return;
      }
      setResult(data);
      onImported?.();
    } catch {
      setError("Something went wrong while uploading. Please try again.");
    }
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import from Excel</h3>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result && (
            <>
              <button
                onClick={() => downloadTemplate(templateColumns, templateFileName)}
                className="flex items-center gap-2 text-xs text-teal-700 hover:text-teal-800"
              >
                <Download className="h-3.5 w-3.5" /> Download blank template ({templateColumns.join(", ")})
              </button>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
                  dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <FileSpreadsheet className="h-8 w-8 text-slate-900 dark:text-slate-300" />
                {fileName ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{fileName}</p>
                    <p className="text-xs text-slate-900 dark:text-slate-100">{rowCount} row{rowCount === 1 ? "" : "s"} detected</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-900 dark:text-slate-100">Drag &amp; drop your Excel file here</p>
                    <p className="text-xs text-slate-900 dark:text-slate-300">or click to browse — .xlsx, .xls, .csv</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button
                  onClick={doImport}
                  disabled={!parsedRows.length || uploading}
                  className="btn-primary"
                >
                  {uploading ? "Importing…" : `Import ${rowCount || ""} row${rowCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {result.created} record{result.created === 1 ? "" : "s"} imported successfully
                {typeof result.skipped === "number" && result.skipped > 0 ? ` · ${result.skipped} skipped (already existed)` : ""}
              </div>
              {typeof result.incomplete === "number" && result.incomplete > 0 && result.needsReview && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2 text-blue-700 text-sm mb-2">
                    <AlertTriangle className="h-4 w-4" /> {result.incomplete} row{result.incomplete === 1 ? "" : "s"} imported with some fields left blank — edit to complete
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.needsReview.map((r, i) => (
                      <p key={i} className="text-xs text-blue-700">
                        Row {r.row} ({r.partNumber}): missing {r.missing.join(", ")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center gap-2 text-orange-700 text-sm mb-2">
                    <AlertTriangle className="h-4 w-4" /> {result.errors.length} row{result.errors.length === 1 ? "" : "s"} couldn&apos;t be imported
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-orange-700">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={onClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
