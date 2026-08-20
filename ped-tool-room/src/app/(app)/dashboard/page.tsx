"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, X } from "lucide-react";
import {
  Boxes,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  IndianRupee,
  MapPin,
  Building2,
  Clock,
  PackageX,
  PackagePlus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatCard, CardSkeleton } from "@/components/StatCard";
import { HeavyMachineryArt } from "@/components/HeavyMachineryArt";
import { Badge, stockTone } from "@/components/Badge";
import { useAppContext } from "../layout";

interface DashboardMaterialHit {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  department: string;
  unit: string;
  location: string;
  minStock: number;
  maxStock: number;
  currentStock: number;
  openingStock: number;
  unitValue: number;
  supplier: string;
  status: string;
  stockStatus: string;
  noMovementDays: number | null;
  lastInwardDate: string | null;
  lastOutwardDate: string | null;
}

interface DashboardData {
  cards: Record<string, number>;
  charts: {
    stockByDepartment: { department: string; stock: number }[];
    categoryDistribution: { category: string; qty: number }[];
    topIssuedMaterials: { description: string; qty: number }[];
  };
  recent: {
    recentIssues: { partNumber: string; description: string; issuedTo: string; quantity: number; date: string }[];
    recentInward: { partNumber: string; description: string; supplier: string; quantity: number; date: string }[];
  };
  alerts: {
    lowStock: { partNumber: string; description: string; currentStock: number; minStock: number }[];
    overStock: { partNumber: string; description: string; currentStock: number; maxStock: number }[];
    noMovement: { partNumber: string; description: string; days: number }[];
  };
}

// Teal-forward qualitative set. Violet appears exactly once so it reads as a
// category, not a second brand colour.
const PIE_COLORS = ["#0f766e", "#3b82f6", "#7c6fae", "#ea580c", "#64748b", "#0d9488"];

const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  color: "#0f172a",
};

// The three metrics that answer "how big, how much, what needs me today" —
// in that order, which is not the order they appear in the full card list.
const HERO_ORDER = ["Total Materials", "Inventory Value", "Low Stock Items"];

// A pie with ~18 slices is unreadable: the labels collide, the leader lines
// cross, and the long tail is invisible anyway. Show the categories that
// actually carry the stock and roll the rest into one honest "Other" slice —
// the tooltip still names how many were folded in.
const TOP_CATEGORIES = 7;

function foldCategories(rows: { category: string; qty: number }[]) {
  // Imported rows often arrive with no category, which would otherwise render
  // as a blank legend entry that looks like a bug rather than missing data.
  const named = rows.map((r) => ({ ...r, category: r.category?.trim() || "Uncategorised" }));
  const sorted = named.sort((a, b) => b.qty - a.qty);
  if (sorted.length <= TOP_CATEGORIES + 1) return sorted;
  const head = sorted.slice(0, TOP_CATEGORIES);
  const tail = sorted.slice(TOP_CATEGORIES);
  return [
    ...head,
    {
      category: `Other (${tail.length} categories)`,
      qty: tail.reduce((sum, r) => sum + r.qty, 0),
    },
  ];
}

/** Section wrapper — one restrained fade/rise so blocks arrive in reading order. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

export default function DashboardPage() {
  const { department, session } = useAppContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"today" | "month" | "all" | "date">("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);
  const [partResult, setPartResult] = useState<DashboardMaterialHit | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  async function sendDigestNow() {
    setSendingDigest(true);
    setDigestResult(null);
    const res = await fetch("/api/reports/daily-digest", { method: "POST" });
    const d = await res.json();
    if (!res.ok) {
      setDigestResult(d.error || "Failed to send");
    } else if (!d.smtpConfigured) {
      setDigestResult(
        `Email isn't set up yet, so nothing was actually sent (${d.skipped} skipped). Go to Settings (gear icon) → Outgoing Email to configure it — no file editing needed.`
      );
    } else {
      setDigestResult(`Sent to ${d.sent} of ${d.sent + d.skipped} user(s) with an email on file.`);
    }
    setSendingDigest(false);
  }

  // Populated by clicking a material result in the search bar at the top —
  // there's only ever the one search input in the app; this just reacts to it.
  useEffect(() => {
    const partNumber = searchParams.get("part");
    if (!partNumber) {
      // Intentional: clearing stale detail when navigating away from a part number.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPartResult(null);
      return;
    }
    fetch(`/api/materials?department=All&q=${encodeURIComponent(partNumber)}`)
      .then((r) => r.json())
      .then((rows: DashboardMaterialHit[]) => {
        const exact = rows.find((r) => r.partNumber.toLowerCase() === partNumber.toLowerCase());
        setPartResult(exact || rows[0] || null);
        router.replace("/dashboard"); // clean the URL, keep the panel open
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const dateParam = period === "date" && selectedDate ? `&date=${selectedDate}` : "";
    fetch(`/api/dashboard?department=${encodeURIComponent(department)}&period=${period}${dateParam}`)
      .then((r) => r.json())
      .then(setData);
  }, [department, period, selectedDate]);

  const allCards = data
    ? ([
        { label: "Total Materials", value: data.cards.totalMaterials, icon: Boxes, tone: "teal" },
        { label: "Total Stock Qty", value: data.cards.totalStockQuantity, icon: Package, tone: "blue" },
        { label: "Low Stock Items", value: data.cards.lowStockItems, icon: AlertTriangle, tone: "signal" },
        { label: "Excess Stock", value: data.cards.excessStock, icon: TrendingUp, tone: "orange" },
        { label: "No Movement Items", value: data.cards.noMovementItems, icon: Clock, tone: "orange" },
        { label: "Today's Outward", value: data.cards.todaysOutward, icon: ArrowUpCircle, tone: "purple" },
        { label: "Today's Inward", value: data.cards.todaysInward, icon: ArrowDownCircle, tone: "green" },
        { label: "Total Inward Qty", value: data.cards.totalInwardQuantity, icon: PackagePlus, tone: "green" },
        { label: "Total Inward Value", value: `₹${data.cards.totalInwardValue.toLocaleString()}`, icon: IndianRupee, tone: "teal" },
        { label: "Total Outward Qty", value: data.cards.totalOutwardQuantity, icon: PackageX, tone: "purple" },
        { label: "Inventory Value", value: `₹${data.cards.inventoryValue.toLocaleString()}`, icon: IndianRupee, tone: "blue" },
        { label: "Active Locations", value: data.cards.activeLocations, icon: MapPin, tone: "slate" },
      ] as const)
    : [];

  const heroCards = HERO_ORDER.map((label) => allCards.find((c) => c.label === label)).filter(
    (c): c is (typeof allCards)[number] => Boolean(c)
  );
  const restCards = allCards.filter((c) => !HERO_ORDER.includes(c.label));

  const scopeLabel = department === "All" ? "All departments" : department;
  const periodLabel =
    period === "today" ? "Today" : period === "month" ? "This month" : period === "date" ? selectedDate : "Overall";

  return (
    <div className="space-y-8">
      {/* Hero — the one place the app states what it is and what you're looking at. */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative -mx-4 -mt-4 overflow-hidden border-b border-slate-200 px-4 pb-7 pt-8 md:-mx-6 md:-mt-6 md:px-6 dark:border-slate-800"
      >
        {/* Site plant behind the copy — still, not animated: this screen is
            worked in all day and moving artwork behind live figures gets old
            fast. The login page carries the animated version. */}
        <div
          className="pointer-events-none absolute -right-10 top-1/2 hidden h-[240px] w-[560px] -translate-y-1/2 opacity-[0.17] lg:block dark:opacity-[0.24]"
          aria-hidden="true"
        >
          <HeavyMachineryArt />
        </div>

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow">Tool Room Control Centre</p>
            <h1 className="text-hero text-value mt-2 max-w-xl">
              Precision Inventory
              <span className="block text-teal-800 dark:text-teal-400">Hub</span>
            </h1>
            <p className="text-label mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-300">{scopeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{periodLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{session.role.replace("_", " ").toLowerCase()}</span>
            </p>
            {session.role === "STORE_ADMIN" && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={sendDigestNow}
                  disabled={sendingDigest}
                  className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 underline-offset-2 hover:underline disabled:opacity-50 dark:text-teal-400"
                >
                  <Mail className="h-3 w-3" />
                  {sendingDigest ? "Sending…" : "Send daily digest email now"}
                </button>
                {digestResult && (
                  <span className="max-w-md text-xs text-slate-900 dark:text-slate-300">· {digestResult}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "today", label: "Today" },
              { key: "month", label: "This Month" },
              { key: "all", label: "Overall" },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setSelectedDate(""); }}
                aria-pressed={period === p.key}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  period === p.key
                    ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
                    : "border-slate-200 bg-white/60 text-slate-800 hover:bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPeriod(e.target.value ? "date" : "all");
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs outline-none cursor-pointer ${
                period === "date"
                  ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
                  : "border-slate-200 bg-white/60 text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-900/60"
              }`}
              title="Pick a specific date to see what happened that day"
            />
          </div>
        </div>
      </motion.section>

      {/* Part number detail — populated by clicking a material result in the
          search bar at the top of the page (no separate search box here,
          so there's only ever one search input in the app). */}
      {partResult && (
        <Reveal>
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow">Part detail</p>
                <p className="text-value mt-1 text-sm font-semibold">
                  <span className="font-mono text-teal-700 dark:text-teal-400">{partResult.partNumber}</span>
                  {" — "}
                  {partResult.description}
                </p>
                <p className="text-label text-xs">{partResult.category} · {partResult.department}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={partResult.stockStatus} tone={stockTone(partResult.stockStatus)} blink={partResult.stockStatus === "Low" || partResult.stockStatus === "Out of Stock"} />
                <button onClick={() => setPartResult(null)} className="text-slate-800 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Close part details">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4 dark:border-slate-800">
              <DashDetail label="Current Stock" value={`${partResult.currentStock} ${partResult.unit}`} />
              <DashDetail label="Minimum Stock" value={String(partResult.minStock)} />
              <DashDetail label="Maximum Stock" value={String(partResult.maxStock)} />
              <DashDetail label="Opening Stock" value={String(partResult.openingStock)} />
              <DashDetail label="Location" value={partResult.location || "-"} />
              <DashDetail label="Supplier" value={partResult.supplier || "-"} />
              <DashDetail label="Inventory Value" value={`₹${(partResult.currentStock * partResult.unitValue).toLocaleString()}`} />
              <DashDetail label="No Movement" value={partResult.noMovementDays !== null ? `${partResult.noMovementDays} days` : "-"} />
              <DashDetail label="Last Inward" value={partResult.lastInwardDate || "-"} />
              <DashDetail label="Last Outward" value={partResult.lastOutwardDate || "-"} />
            </div>
          </div>
        </Reveal>
      )}

      {/* Headline metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        {!data
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} variant="hero" />)
          : heroCards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <StatCard {...c} variant="hero" />
              </motion.div>
            ))}
      </div>

      {/* Supporting metrics */}
      <section>
        <SectionHeading title="Store Metrics" caption={periodLabel} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {!data
            ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
            : restCards.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <StatCard {...c} />
                </motion.div>
              ))}
        </div>
      </section>

      {/* Alerts */}
      {data && (
        <Reveal>
          <SectionHeading title="Needs Attention" caption="Items outside their configured limits" />
          <div className="grid gap-4 lg:grid-cols-3">
            <AlertPanel
              title="Low Stock Alert"
              tone="red"
              items={data.alerts.lowStock.map((m) => `${m.partNumber} — ${m.description} (${m.currentStock}/${m.minStock})`)}
            />
            <AlertPanel
              title="Excess Stock"
              tone="orange"
              items={data.alerts.overStock.map((m) => `${m.partNumber} — ${m.description} (${m.currentStock}/${m.maxStock})`)}
            />
            <AlertPanel
              title="No Movement (30+ days)"
              tone="slate"
              items={data.alerts.noMovement.map((m) => `${m.partNumber} — ${m.description} (${m.days} days)`)}
            />
          </div>
        </Reveal>
      )}

      {/* Charts */}
      {data && (
        <Reveal>
          <SectionHeading title="Distribution" caption="Where stock sits and what moves" />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard icon={Building2} title="Stock by Department">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.charts.stockByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="department" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(15,118,110,0.06)" }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="stock" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              icon={Package}
              title="Material Category Distribution"
              caption={`Top ${TOP_CATEGORIES} of ${data.charts.categoryDistribution.length} categories by stock`}
            >
              <CategoryDonut rows={data.charts.categoryDistribution} />
            </ChartCard>

            <div className="lg:col-span-2">
              <ChartCard icon={TrendingUp} title="Top Issued Materials">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.charts.topIssuedMaterials} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="description"
                      width={160}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(15,31,46,0.05)" }} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="qty" fill="#475569" radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        </Reveal>
      )}

      {/* Recent activity */}
      {data && (
        <Reveal>
          <SectionHeading title="Latest Movement" caption="Most recent entries across the store" />
          <div className="grid gap-4 lg:grid-cols-2">
            <ActivityTable
              title="Recent Issues (Outward)"
              rows={data.recent.recentIssues.map((r) => ({
                left: `${r.partNumber} · ${r.description}`,
                right: `${r.quantity} → ${r.issuedTo}`,
                date: r.date,
              }))}
            />
            <ActivityTable
              title="Recent Inward"
              rows={data.recent.recentInward.map((r) => ({
                left: `${r.partNumber} · ${r.description}`,
                right: `+${r.quantity} · ${r.supplier}`,
                date: r.date,
              }))}
            />
          </div>
        </Reveal>
      )}
    </div>
  );
}

function SectionHeading({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="mb-4">
      <span className="section-rule" />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-section text-value">{title}</h2>
        {caption && <p className="text-label text-xs">{caption}</p>}
      </div>
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  caption,
  children,
}: {
  icon: typeof Building2;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-5 flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-700 dark:text-teal-400" />
        <div className="min-w-0">
          <h3 className="text-value text-sm font-semibold">{title}</h3>
          {caption && <p className="text-label mt-0.5 text-xs">{caption}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Donut + its own legend. Recharts' built-in <Legend> wrapped into an
 * unreadable block at this many series, and the slice labels drew crossing
 * leader lines — so the legend is plain markup beside the chart instead,
 * carrying the numbers the labels were trying to show.
 */
function CategoryDonut({ rows }: { rows: { category: string; qty: number }[] }) {
  const folded = foldCategories(rows);
  const total = folded.reduce((sum, r) => sum + r.qty, 0);
  const pct = (q: number) => (total > 0 ? Math.round((q / total) * 100) : 0);

  if (total === 0) {
    return <p className="text-label py-16 text-center text-sm">No stock recorded yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-[220px] w-[220px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={folded}
              dataKey="qty"
              nameKey="category"
              innerRadius={62}
              outerRadius={95}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {folded.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => {
                const qty = Number(value) || 0;
                return [`${qty.toLocaleString("en-IN")} (${pct(qty)}%)`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total sits in the hole — the one number the whole ring adds up to. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="eyebrow">Total</p>
          <p className="text-value text-xl font-semibold tabular-nums">{total.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {folded.map((r, i) => (
          <li key={r.category} className="flex items-center gap-2.5 text-xs">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="text-value min-w-0 flex-1 truncate" title={r.category}>
              {r.category}
            </span>
            <span className="text-value flex-shrink-0 font-medium tabular-nums">
              {r.qty.toLocaleString("en-IN")}
            </span>
            <span className="text-label w-9 flex-shrink-0 text-right tabular-nums">{pct(r.qty)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertPanel({ title, tone, items }: { title: string; tone: "red" | "orange" | "slate"; items: string[] }) {
  const rail = tone === "red" ? "bg-red-500" : tone === "orange" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600";
  return (
    <div className="card relative overflow-hidden p-5">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${rail}`} />
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-value text-sm font-semibold">{title}</h3>
        <Badge label={String(items.length)} tone={tone === "slate" ? "slate" : tone} blink={tone === "red" && items.length > 0} />
      </div>
      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-label text-xs">Nothing flagged — all within limits.</p>
        ) : (
          items.map((it, i) => (
            <p key={i} className="text-value border-l-2 border-slate-200 py-0.5 pl-2 text-xs dark:border-slate-700">
              {it}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function ActivityTable({ title, rows }: { title: string; rows: { left: string; right: string; date: string }[] }) {
  return (
    <div className="card p-5">
      <h3 className="text-value mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-label text-xs">No recent activity</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-value truncate text-xs">{r.left}</p>
              <p className="text-label mt-0.5 text-[10px] tabular-nums">{r.date}</p>
            </div>
            <p className="ml-3 whitespace-nowrap text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-400">{r.right}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="text-value mt-1 tabular-nums">{value}</p>
    </div>
  );
}
