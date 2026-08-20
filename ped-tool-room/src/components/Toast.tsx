"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, X } from "lucide-react";

type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

/**
 * Confirmation layer for actions that previously succeeded silently — a saved
 * material just closed its dialog and left you guessing. Inline error text in
 * forms is untouched; this sits alongside it.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  // Deliberately non-throwing: a page rendered outside the provider should
  // still work, just without confirmations.
  return ctx?.toast ?? (() => {});
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${
                t.tone === "success"
                  ? "border-teal-600/25 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                  : "border-red-300 bg-white text-slate-900 dark:border-red-500/40 dark:bg-slate-900 dark:text-slate-100"
              }`}
            >
              {t.tone === "success" ? (
                <span className="mt-0.5 rounded-full bg-teal-600/10 p-1 text-teal-700 dark:text-teal-400">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              ) : (
                <span className="mt-0.5 rounded-full bg-red-500/10 p-1 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
              <p className="min-w-0 flex-1 text-sm">{t.message}</p>
              <button
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                className="rounded p-0.5 text-slate-600 transition hover:text-slate-900 dark:hover:text-slate-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
