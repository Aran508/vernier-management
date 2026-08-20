"use client";

import { useEffect, useState } from "react";
import { Pencil, Check, X, Wallet, TrendingDown, TrendingUp, CalendarClock, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { useAppContext } from "../layout";
import { StatCard } from "@/components/StatCard";
import { PageHeader, FilterChip } from "@/components/DataTable";
import { inputClass } from "@/components/Field";

interface DepartmentSpend {
  department: string;
  spent: number;
  lastMonthSpent: number;
  yearToDateSpent: number;
}

interface BudgetOverview {
  month: string;
  budget: number;
  spent: number;
  balance: number;
  lastMonth: { month: string; spent: number };
  yearToDate: { year: string; spent: number };
  byDepartment: DepartmentSpend[];
}

// Same qualitative family the dashboard uses — teal-forward, one muted violet.
const BAR_COLORS = ["#0f766e", "#3b82f6", "#ea580c", "#7c6fae"];

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function BudgetPage() {
  const { session } = useAppContext();
  const [month, setMonth] = useState(currentMonthISO());
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite = session.role === "STORE_ADMIN";

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/budget?month=${month}`);
    const data = await res.json();
    setOverview(data);
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: refetching whenever the selected month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Native <input type="month"> fires onChange with an empty string while a
  // segment (most often the year, mid-keystroke) is incomplete. Committing
  // that to state made the controlled value snap back and ate every
  // keystroke — which is exactly what made picking a year "not work".
  function handleMonthChange(value: string) {
    if (value && MONTH_RE.test(value)) setMonth(value);
  }

  async function saveBudget() {
    const amount = Number(draft);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, amount }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to save budget");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(false);
    load();
  }

  const isCurrentMonth = month === currentMonthISO();
  const isUpcoming = month > currentMonthISO();
  const overBudget = !!overview && overview.budget > 0 && overview.spent > overview.budget;
  const pctUsed = overview && overview.budget > 0 ? Math.min(200, Math.round((overview.spent / overview.budget) * 100)) : 0;

  const chartData = overview?.byDepartment.map((d) => ({ name: d.department.replace(" & ", " &\n"), spent: d.spent })) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Department Budget"
        caption="One monthly establishing cost for the whole store — spend is calculated automatically from inward."
        actions={
          <>
            <div className="relative">
              <CalendarClock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input
                type="month"
                defaultValue={month}
                key={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                aria-label="Budget month"
                className={`${inputClass} pl-9`}
              />
            </div>
            <FilterChip active={isCurrentMonth} onClick={() => setMonth(currentMonthISO())}>
              This Month
            </FilterChip>
            <FilterChip
              active={false}
              onClick={() => {
                const [y, m] = month.split("-").map(Number);
                setMonth(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7));
              }}
            >
              Next Month
            </FilterChip>
          </>
        }
      />

      {isUpcoming && (
        <p className="rounded-lg border border-teal-600/25 bg-teal-600/[0.07] px-3 py-2 text-xs text-teal-800 dark:text-teal-300">
          Viewing {monthLabel(month)} — an upcoming month. {canWrite ? "Set the allocation now so it's ready when the month starts." : "Spend figures will fill in once this month begins."}
        </p>
      )}

      {loading || !overview ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[92px] rounded-xl border border-slate-200 dark:border-slate-700" />
            ))}
          </div>
          <div className="skeleton h-[300px] rounded-xl border border-slate-200 dark:border-slate-700" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label={`Total Budget — ${monthLabel(month)}`}
              value={
                editing ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBudget(); if (e.key === "Escape") setEditing(false); }}
                      aria-label="Monthly budget amount"
                      className={`${inputClass} py-1.5 text-sm`}
                    />
                    <button onClick={saveBudget} disabled={saving} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50" aria-label="Save budget">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(false)} className="text-slate-600 hover:text-slate-600" aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  inr(overview.budget)
                )
              }
              icon={Wallet}
              tone="teal"
              sub={error ?? undefined}
              action={
                canWrite && !editing ? (
                  <button
                    onClick={() => { setEditing(true); setDraft(String(overview.budget || "")); setError(null); }}
                    className="rounded p-0.5 text-slate-600 transition hover:text-teal-700 dark:hover:text-teal-400"
                    aria-label="Edit monthly budget"
                    title="Edit monthly budget"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : undefined
              }
            >
              {overview.budget > 0 && (
                <div className="mt-3">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    role="progressbar"
                    aria-valuenow={pctUsed}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Budget used"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : pctUsed > 80 ? "bg-amber-500" : "bg-teal-600"}`}
                      style={{ width: `${Math.min(100, pctUsed)}%` }}
                    />
                  </div>
                  <p className="text-label mt-1 text-[11px]">{pctUsed}% used</p>
                </div>
              )}
            </StatCard>

            <StatCard label="Spent This Month" value={inr(overview.spent)} icon={TrendingDown} tone="orange" />
            <StatCard
              label="Balance"
              value={inr(overview.balance)}
              icon={overview.balance < 0 ? TrendingDown : TrendingUp}
              tone={overview.balance < 0 ? "red" : "green"}
            />
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={monthLabel(overview.lastMonth.month)} value={inr(overview.lastMonth.spent)} icon={CalendarClock} tone="slate" compact />
              <StatCard label={`${overview.yearToDate.year} YTD`} value={inr(overview.yearToDate.spent)} icon={TrendingUp} tone="blue" compact />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h3 className="text-value text-sm font-semibold">Spend by Process — {monthLabel(month)}</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a", borderRadius: 8 }}
                  formatter={(value) => [inr(Number(value)), "Spent"]}
                />
                <Bar dataKey="spent" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40">
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">Process</th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">Spent This Month</th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">{monthLabel(overview.lastMonth.month)}</th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">{overview.yearToDate.year} YTD</th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">Share of Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byDepartment.map((d, i) => {
                    const share = overview.spent > 0 ? Math.round((d.spent / overview.spent) * 100) : 0;
                    return (
                      <tr key={d.department} className="border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-value font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                            {d.department}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-value tabular-nums">{inr(d.spent)}</td>
                        <td className="px-4 py-3 text-right text-label tabular-nums">{inr(d.lastMonthSpent)}</td>
                        <td className="px-4 py-3 text-right text-label tabular-nums">{inr(d.yearToDateSpent)}</td>
                        <td className="px-4 py-3 text-right text-label tabular-nums">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const MONTH_RE = /^\d{4}-\d{2}$/;
