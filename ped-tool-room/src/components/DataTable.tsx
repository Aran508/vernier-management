"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pin, PinOff } from "lucide-react";

/**
 * A column can stay a plain string — every existing page passes strings — or
 * become a spec when it needs to declare alignment or width. Numeric columns
 * must set `align: "right"`, otherwise the header label sits left while its
 * figures sit right and the two never line up.
 */
export type Column =
  | string
  | {
      label: string;
      align?: "left" | "right" | "center";
      /** Tailwind width class, e.g. "w-28". Unset columns share the slack. */
      width?: string;
    };

const columnLabel = (c: Column) => (typeof c === "string" ? c : c.label);
const columnAlign = (c: Column) => (typeof c === "string" ? "left" : c.align ?? "left");
const columnWidth = (c: Column) => (typeof c === "string" ? "" : c.width ?? "");

const ALIGN_CLASS = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * The table chrome every list page shares — header treatment, skeleton rows,
 * empty state, and horizontal scroll containment. Pages still write their own
 * <tr>/<td> cells, because the columns and row interactions differ; this only
 * owns the parts that were being copy-pasted identically.
 */
export function TableShell({
  columns,
  loading,
  loadingRows = 6,
  isEmpty,
  emptyMessage = "No records found.",
  emptyHint,
  children,
  caption,
  freezeColumnLabel,
}: {
  columns: Column[];
  loading?: boolean;
  loadingRows?: number;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  children?: ReactNode;
  caption?: string;
  /** Column the freeze toggle pins, named in its tooltip. Defaults to the first. */
  freezeColumnLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [frozen, setFrozen] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  // The toggle only earns its place when the table actually overflows, so
  // narrow tables (Audit Log, Suppliers) don't grow a control that does
  // nothing. Re-measured on resize and whenever the rows change.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrollable(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children, loading]);

  return (
    <div className="card overflow-hidden">
      {scrollable && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <p className="text-label text-[11px]">Scroll sideways to see all {columns.length} columns</p>
          <button
            type="button"
            onClick={() => setFrozen((f) => !f)}
            aria-pressed={frozen}
            title={
              frozen
                ? `Unpin the ${freezeColumnLabel ?? columnLabel(columns[0])} column`
                : `Keep the ${freezeColumnLabel ?? columnLabel(columns[0])} column visible while scrolling sideways`
            }
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
              frozen
                ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
                : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {frozen ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {frozen ? "Unfreeze" : "Freeze"} {freezeColumnLabel ?? columnLabel(columns[0])}
          </button>
        </div>
      )}
      {/* The register scrolls inside its own box rather than moving the page.
          `overflow-x: auto` already makes this the scroll container, so a
          sticky thead resolves against it — giving it a height is what turns
          that into a genuinely frozen header instead of a no-op. */}
      <div
        ref={scrollRef}
        onScroll={measure}
        className={`max-h-[calc(100vh-var(--topbar-h)-11rem)] overflow-auto overscroll-contain ${
          frozen ? "freeze-first" : ""
        }`}
      >
        <table className="w-full text-[13px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          {/* Frozen against the scroll box above, so column names stay put
              through all 500 rows. */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100/95 backdrop-blur-sm dark:bg-slate-950/95">
              {columns.map((c) => (
                <th
                  key={columnLabel(c)}
                  scope="col"
                  className={`whitespace-nowrap border-b border-slate-300 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-800 dark:border-slate-700 dark:text-slate-300 ${
                    ALIGN_CLASS[columnAlign(c)]
                  } ${columnWidth(c)}`}
                >
                  {columnLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={columnLabel(c)} className="px-4 py-2.5">
                      <div className="skeleton h-3.5 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <p className="text-value text-sm font-medium">{emptyMessage}</p>
                  {emptyHint && <p className="text-label mx-auto mt-1 max-w-sm text-xs">{emptyHint}</p>}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Standard body row. `onClick` turns it into a keyboard-reachable row button. */
export function Row({
  children,
  onClick,
  highlighted,
  title,
  innerRef,
}: {
  children: ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
  title?: string;
  /** Used by the deep-link highlight on Inward/Outward to scroll a row into view. */
  innerRef?: (el: HTMLTableRowElement | null) => void;
}) {
  return (
    <tr
      ref={innerRef}
      onClick={onClick}
      title={title}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`transition-colors ${onClick ? "cursor-pointer" : ""} ${
        highlighted
          ? "bg-teal-50 ring-1 ring-inset ring-teal-500/40 dark:bg-teal-500/10"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      {children}
    </tr>
  );
}

/** Body cell. `mono` for identifiers, `num` for right-aligned figures. */
export function Cell({
  children,
  mono,
  num,
  strong,
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  num?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2.5 ${mono ? "font-mono text-[12px]" : ""} ${
        num ? "text-right tabular-nums" : ""
      } ${
        strong ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-900 dark:text-slate-300"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * Stock against its min/max envelope, drawn the way a tolerance band is drawn
 * on an engineering drawing: a track for the full range, a hard tick at the
 * minimum, and a fill showing where this part actually sits. Replaces a bare
 * "1 / 2", which told you the numbers but not whether to act.
 */
export function StockGauge({
  current,
  min,
  max,
  unit,
}: {
  current: number;
  min: number;
  max: number;
  unit?: string;
}) {
  // Scale to whichever is furthest out, so an over-stocked part still fits.
  const ceiling = Math.max(max, current, min, 1);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / ceiling) * 100))}%`;

  const state =
    current <= 0 ? "out" : current < min ? "low" : max > 0 && current > max ? "over" : "ok";
  const fill = {
    out: "bg-red-600",
    low: "bg-amber-500",
    over: "bg-blue-500",
    ok: "bg-teal-600",
  }[state];

  return (
    <div className="flex items-center justify-end gap-2.5">
      <span className="tabular-nums text-[12px] font-medium text-slate-900 dark:text-slate-300">
        {min} / {max}
      </span>
      <span
        className="relative h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="img"
        aria-label={`${current}${unit ? ` ${unit}` : ""} in stock, minimum ${min}, maximum ${max}`}
      >
        <span className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: pct(current) }} />
        {/* Minimum line — the threshold that decides whether this part is a problem. */}
        {min > 0 && (
          <span
            className="absolute inset-y-0 w-px bg-slate-900/55 dark:bg-slate-100/55"
            style={{ left: pct(min) }}
          />
        )}
      </span>
    </div>
  );
}

/** Page header used above every list: rule, title, count, and actions. */
export function PageHeader({
  title,
  caption,
  actions,
}: {
  title: string;
  caption?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span className="section-rule" />
        <h1 className="text-section text-value">{title}</h1>
        {caption && <p className="text-label mt-1 text-sm">{caption}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Filter chip row — the segmented control used for department/status filters. */
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`tabular-nums ${active ? "text-teal-700/70 dark:text-teal-400/70" : "text-slate-600"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
