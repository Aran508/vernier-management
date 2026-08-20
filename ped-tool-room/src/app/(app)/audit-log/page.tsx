"use client";

import { useEffect, useState } from "react";
import { useAppContext } from "../layout";
import { TableShell, Row, Cell, PageHeader } from "@/components/DataTable";
import { AccessDenied } from "@/components/AccessDenied";

interface LogRow {
  id: string;
  user: string;
  action: string;
  oldValue: string;
  newValue: string;
  date: string;
  time: string;
  ipAddress: string;
}

const COLUMNS = ["User", "Action", "Old Value", "New Value", "Date", "Time", "IP Address"];

export default function AuditLogPage() {
  const { session } = useAppContext();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit-log")
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }, []);

  if (session.role === "PROCESS_OWNER") {
    return (
      <AccessDenied
        page="The audit log"
        reason="Audit history is visible to Store Admin and Monitoring accounts only."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        caption={`${rows.length.toLocaleString()} recorded actions — every create, edit, delete and login`}
      />

      <TableShell
        columns={COLUMNS}
        loading={loading}
        loadingRows={8}
        isEmpty={rows.length === 0}
        emptyMessage="Nothing recorded yet."
        emptyHint="Actions taken in the app will appear here automatically."
        caption="Recorded user actions"
      >
        {rows.map((r) => (
          <Row key={r.id}>
            <Cell strong>{r.user}</Cell>
            <Cell mono className="text-teal-700 dark:text-teal-400">{r.action}</Cell>
            <Cell>{r.oldValue}</Cell>
            <Cell>{r.newValue}</Cell>
            <Cell num className="whitespace-nowrap text-xs">{r.date}</Cell>
            <Cell num className="text-xs">{r.time}</Cell>
            <Cell mono>{r.ipAddress}</Cell>
          </Row>
        ))}
      </TableShell>
    </div>
  );
}
