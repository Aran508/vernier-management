export function Badge({
  label,
  tone = "slate",
  blink = false,
}: {
  label: string;
  tone?: "slate" | "green" | "red" | "orange" | "blue" | "purple";
  blink?: boolean;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
    orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${
        blink ? "blink-alert" : ""
      }`}
    >
      {label}
    </span>
  );
}

export function stockTone(status: string): "green" | "red" | "orange" | "slate" {
  if (status === "Low" || status === "Out of Stock") return "red";
  if (status === "Over Stock") return "orange";
  if (status === "Normal") return "green";
  return "slate";
}
