import { LucideIcon } from "lucide-react";

type Tone = "slate" | "teal" | "purple" | "red" | "orange" | "green" | "blue" | "signal";

const tones: Record<Tone, string> = {
  slate: "from-slate-100 to-slate-50 text-slate-800 dark:from-slate-800 dark:to-slate-800/60 dark:text-slate-300",
  teal: "from-teal-100 to-teal-50 text-teal-700 dark:from-teal-500/20 dark:to-teal-500/5 dark:text-teal-400",
  purple: "from-purple-100 to-purple-50 text-purple-700 dark:from-purple-500/20 dark:to-purple-500/5 dark:text-purple-400",
  red: "from-red-100 to-red-50 text-red-700 dark:from-red-500/20 dark:to-red-500/5 dark:text-red-400",
  orange: "from-orange-100 to-orange-50 text-orange-700 dark:from-orange-500/20 dark:to-orange-500/5 dark:text-orange-400",
  green: "from-emerald-100 to-emerald-50 text-emerald-700 dark:from-emerald-500/20 dark:to-emerald-500/5 dark:text-emerald-400",
  blue: "from-blue-100 to-blue-50 text-blue-700 dark:from-blue-500/20 dark:to-blue-500/5 dark:text-blue-400",
  signal: "from-amber-100 to-amber-50 text-amber-700 dark:from-amber-500/20 dark:to-amber-500/5 dark:text-amber-400",
};

// The accent rule sitting on top of a hero card — the one place a metric gets
// to declare its own colour at full strength.
const heroRule: Record<Tone, string> = {
  slate: "bg-slate-400",
  teal: "bg-teal-600",
  purple: "bg-purple-600",
  red: "bg-red-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  signal: "bg-amber-500",
};

const heroWatermark: Record<Tone, string> = {
  slate: "text-slate-900/[0.045] dark:text-slate-100/[0.05]",
  teal: "text-teal-700/[0.07] dark:text-teal-400/[0.07]",
  purple: "text-purple-700/[0.07] dark:text-purple-400/[0.07]",
  red: "text-red-600/[0.07] dark:text-red-400/[0.07]",
  orange: "text-orange-600/[0.08] dark:text-orange-400/[0.08]",
  green: "text-emerald-600/[0.07] dark:text-emerald-400/[0.07]",
  blue: "text-blue-600/[0.07] dark:text-blue-400/[0.07]",
  signal: "text-amber-600/[0.09] dark:text-amber-400/[0.09]",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  sub,
  variant = "default",
  compact = false,
  action,
  children,
}: {
  label: string;
  /** Usually a formatted string; accepts nodes so a card can host an inline editor. */
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  sub?: string;
  variant?: "default" | "hero";
  /** Half-width tiles (e.g. the paired budget figures) — smaller value type. */
  compact?: boolean;
  /** Optional control rendered beside the label, e.g. an inline edit pencil. */
  action?: React.ReactNode;
  /** Optional footer, e.g. a progress bar. */
  children?: React.ReactNode;
}) {
  if (variant === "hero") {
    return (
      <div className="card card-interactive relative overflow-hidden p-6">
        <span className={`absolute inset-x-0 top-0 h-[3px] ${heroRule[tone]}`} />
        <Icon
          className={`pointer-events-none absolute -right-3 -bottom-4 h-28 w-28 ${heroWatermark[tone]}`}
          strokeWidth={1.25}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="eyebrow">{label}</p>
          <p className="text-value mt-3 text-metric tabular-nums">{value}</p>
          {sub && <p className="text-label mt-2 text-xs">{sub}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="card card-interactive p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-label truncate text-xs font-medium">{label}</p>
            {action}
          </div>
          <p className={`text-value mt-1.5 font-semibold tabular-nums ${compact ? "text-base" : "text-2xl"}`}>
            {value}
          </p>
          {sub && <p className="text-label mt-1 text-[11px]">{sub}</p>}
        </div>
        <div className={`flex-shrink-0 rounded-lg bg-gradient-to-br ${tones[tone]} ${compact ? "p-2" : "p-2.5"}`}>
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>
      </div>
      {children}
    </div>
  );
}

export function CardSkeleton({ variant = "default" }: { variant?: "default" | "hero" }) {
  return (
    <div
      className={`skeleton rounded-xl border border-slate-200 dark:border-slate-700 ${
        variant === "hero" ? "h-[136px]" : "h-[92px]"
      }`}
    />
  );
}
