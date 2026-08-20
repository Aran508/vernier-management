"use client";

import { useEffect, useState } from "react";
import { Badge, stockTone } from "@/components/Badge";
import { useAppContext } from "../layout";
import { ExportButton } from "@/components/ExportButton";
import { TableShell, Row, Cell, PageHeader, FilterChip, type Column } from "@/components/DataTable";

interface SummaryRow {
  materialDescription: string;
  partNumber: string;
  category: string;
  department: string;
  openingStock: number;
  totalInward: number;
  totalOutward: number;
  closingStock: number;
  minStock: number;
  maxStock: number;
  location: string;
  rack: string;
  row: string;
  shelf: string;
  lastInwardDate: string | null;
  lastOutwardDate: string | null;
  noMovementDays: number | null;
  inventoryValue: number;
  stockStatus: string;
}

const COLUMNS: Column[] = [
  { label: "Part No.", width: "w-28" },
  "Description",
  { label: "Dept", width: "w-32" },
  { label: "Opening", align: "right", width: "w-20" },
  { label: "Inward", align: "right", width: "w-20" },
  { label: "Outward", align: "right", width: "w-20" },
  { label: "Closing", align: "right", width: "w-20" },
  { label: "Location", width: "w-24" },
  { label: "No Movement", align: "right", width: "w-28" },
  { label: "Value", align: "right", width: "w-28" },
  { label: "Status", width: "w-28" },
];

const STATUSES = ["All", "Normal", "Low", "Out of Stock", "Over Stock"];

export default function StockSummaryPage() {
  const { department } = useAppContext();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    // Intentional: fetching data in response to `department` changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/stock-summary?department=${encodeURIComponent(department)}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }, [department]);

  const filtered = statusFilter === "All" ? rows : rows.filter((r) => r.stockStatus === statusFilter);
  const totalValue = filtered.reduce((s, r) => s + r.inventoryValue, 0);

  function countFor(status: string) {
    return status === "All" ? rows.length : rows.filter((r) => r.stockStatus === status).length;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Summary"
        caption={`${filtered.length} materials · Inventory value ₹${totalValue.toLocaleString()}${
          department !== "All" ? ` · ${department}` : ""
        }`}
        actions={<ExportButton reportType="stock-summary" department={department} status={statusFilter} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            count={loading ? undefined : countFor(s)}
          >
            {s}
          </FilterChip>
        ))}
      </div>

      <TableShell
        columns={COLUMNS}
        loading={loading}
        loadingRows={8}
        isEmpty={filtered.length === 0}
        emptyMessage={statusFilter === "All" ? "No records." : `Nothing is currently "${statusFilter}".`}
        emptyHint={statusFilter === "All" ? undefined : "That's usually good news — pick All to see everything."}
        caption="Opening, movement and closing stock per material"
      >
        {filtered.map((r) => (
          <Row key={r.partNumber}>
            <Cell mono className="text-teal-700 dark:text-teal-400">{r.partNumber}</Cell>
            <Cell strong className="whitespace-nowrap">{r.materialDescription}</Cell>
            <Cell>{r.department}</Cell>
            <Cell num className="text-right">{r.openingStock}</Cell>
            <Cell num className="text-right text-emerald-600 dark:text-emerald-400">+{r.totalInward}</Cell>
            <Cell num className="text-right text-orange-600 dark:text-orange-400">-{r.totalOutward}</Cell>
            <Cell num strong className="text-right">{r.closingStock}</Cell>
            <Cell mono>{r.location}</Cell>
            <Cell num className="text-right">{r.noMovementDays !== null ? `${r.noMovementDays}d` : "-"}</Cell>
            <Cell num className="text-right">₹{r.inventoryValue.toLocaleString()}</Cell>
            <Cell>
              <Badge label={r.stockStatus} tone={stockTone(r.stockStatus)} blink={r.stockStatus === "Low" || r.stockStatus === "Out of Stock"} />
            </Cell>
          </Row>
        ))}
      </TableShell>
    </div>
  );
}
