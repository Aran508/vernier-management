"use client";

import { ReactNode, useId } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-teal-600/50 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:bg-slate-900";

/**
 * Label + control + hint/error wrapper. Wraps a single form control passed as
 * children and wires the label, hint and error message to it by id, so the
 * association is correct without every page repeating aria attributes.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required,
  htmlFor,
  className = "",
}: {
  label: string;
  children: ReactNode | ((id: string) => ReactNode);
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;

  return (
    <div className={className}>
      <label htmlFor={id} className="text-label mb-1 block text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-label mt-1 text-[11px]">{hint}</p>
      ) : null}
    </div>
  );
}

/** Groups related fields under a heading — the "progressive disclosure" spine
 *  that keeps the long Add/Edit forms from reading as one undifferentiated wall. */
export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const cols = columns === 1 ? "grid-cols-1" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <section className="border-t border-slate-100 pt-4 first:border-0 first:pt-0 dark:border-slate-800">
      <div className="mb-3">
        <h4 className="text-value text-xs font-semibold uppercase tracking-wider">{title}</h4>
        {description && <p className="text-label mt-0.5 text-[11px]">{description}</p>}
      </div>
      <div className={`grid gap-3 ${cols}`}>{children}</div>
    </section>
  );
}

/**
 * Two-step destructive confirm, inline. Replaces the identical
 * "click Delete → Confirm/Cancel" markup that four pages had each written out.
 */
export function ConfirmDelete({
  confirming,
  onRequest,
  onConfirm,
  onCancel,
  label = "Delete",
  question = "Delete permanently?",
  busy,
}: {
  confirming: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  label?: string;
  question?: string;
  busy?: boolean;
}) {
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={onRequest}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
      <span className="text-xs font-medium text-red-700 dark:text-red-300">{question}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-800 transition hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Cancel
      </button>
    </div>
  );
}
