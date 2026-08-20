import { ShieldOff } from "lucide-react";

/**
 * Shown instead of a page body when the signed-in role isn't permitted to see
 * it. Replaces the bare "You do not have access to this page." line so a
 * permission boundary reads as deliberate rather than as a broken screen.
 */
export function AccessDenied({ page, reason }: { page: string; reason?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        <ShieldOff className="h-6 w-6 text-slate-600" aria-hidden="true" />
      </div>
      <h1 className="text-section text-value mt-4">{page} isn&apos;t available to your role</h1>
      <p className="text-label mt-2 max-w-sm text-sm">
        {reason ?? "Your account doesn't include permission for this area. Ask a Store Admin if you need access."}
      </p>
    </div>
  );
}
