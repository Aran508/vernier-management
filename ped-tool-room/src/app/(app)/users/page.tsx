"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/Badge";
import { useAppContext } from "../layout";
import { DEPARTMENTS } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { TableShell, Row, Cell, PageHeader } from "@/components/DataTable";
import { Field, FormSection, ConfirmDelete, inputClass } from "@/components/Field";
import { AccessDenied } from "@/components/AccessDenied";

interface UserRow {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  username: string;
  email: string;
  phone: string;
  status: string;
  lastLogin: string | null;
}

const ROLE_TONE: Record<string, "purple" | "blue" | "green"> = {
  STORE_ADMIN: "purple",
  PROCESS_OWNER: "blue",
  MONITORING: "green",
};

const COLUMNS = ["Employee", "Username", "Role", "Department", "Email", "Status", "Last Login"];

export default function UsersPage() {
  const { session } = useAppContext();
  const toast = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: fetching the user list once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (session.role !== "STORE_ADMIN") {
    return (
      <AccessDenied
        page="User management"
        reason="Only Store Admin accounts can view and manage users."
      />
    );
  }

  const activeCount = rows.filter((u) => u.status === "Active").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        caption={`${rows.length} ${rows.length === 1 ? "account" : "accounts"} · ${activeCount} active`}
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Create User
          </button>
        }
      />

      <TableShell
        columns={COLUMNS}
        loading={loading}
        isEmpty={rows.length === 0}
        emptyMessage="No user accounts yet."
        emptyHint="Create accounts for process owners and monitoring staff to give them access."
        caption="User accounts and their roles"
      >
        {rows.map((u) => (
          <Row key={u.id} onClick={() => setDetailId(u.id)} title="Open user details">
            <Cell>
              <p className="font-medium text-slate-900 dark:text-slate-100">{u.employeeName}</p>
              <p className="text-label mt-0.5 font-mono text-[10px]">{u.employeeId}</p>
            </Cell>
            <Cell mono>{u.username}</Cell>
            <Cell><Badge label={u.role.replace("_", " ")} tone={ROLE_TONE[u.role]} /></Cell>
            <Cell>{u.department}</Cell>
            <Cell>{u.email}</Cell>
            <Cell><Badge label={u.status} tone={u.status === "Active" ? "green" : "slate"} /></Cell>
            <Cell num className="whitespace-nowrap text-xs">
              {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
            </Cell>
          </Row>
        ))}
      </TableShell>

      {showForm && (
        <UserModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); toast("User created."); load(); }} />
      )}

      {detailId && (
        <UserDetailModal
          id={detailId}
          currentUserId={session.id}
          onClose={() => setDetailId(null)}
          onChanged={() => { setDetailId(null); toast("User updated."); load(); }}
        />
      )}
    </div>
  );
}

function UserDetailModal({
  id,
  currentUserId,
  onClose,
  onChanged,
}: {
  id: string;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "reset">("view");
  const [form, setForm] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((d: UserRow) => {
        setUser(d);
        setForm({
          employeeName: d.employeeName,
          department: d.department,
          role: d.role,
          email: d.email,
          phone: d.phone || "",
          status: d.status,
          username: d.username,
        });
      });
  }, [id]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to update user");
      setSaving(false);
      return;
    }
    onChanged();
  }

  async function saveReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to reset password");
      setSaving(false);
      return;
    }
    onChanged();
  }

  async function doDelete() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to delete user");
      setSaving(false);
      return;
    }
    onChanged();
  }

  const isSelf = id === currentUserId;

  if (!user) {
    return (
      <Modal open onClose={onClose} title="Loading user…">
        <div className="p-8"><div className="skeleton h-32 rounded-lg" /></div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={user.employeeName}
      description={mode === "edit" ? "Editing user" : mode === "reset" ? "Reset password" : `@${user.username}`}
      size="lg"
    >
      {mode === "view" && (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <UserDetail label="Employee ID" value={user.employeeId} />
            <UserDetail label="Username" value={user.username} mono />
            <div>
              <p className="eyebrow">Role</p>
              <div className="mt-1"><Badge label={user.role.replace("_", " ")} tone={ROLE_TONE[user.role]} /></div>
            </div>
            <UserDetail label="Department" value={user.department} />
            <UserDetail label="Email (used for notifications)" value={user.email} span2 />
            <UserDetail label="Phone" value={user.phone || "-"} />
            <div>
              <p className="eyebrow">Status</p>
              <div className="mt-1"><Badge label={user.status} tone={user.status === "Active" ? "green" : "slate"} /></div>
            </div>
            <UserDetail
              label="Last Login"
              value={user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
              span2
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button onClick={onClose} className="btn-secondary">Close</button>
            {!isSelf && (
              <ConfirmDelete
                confirming={confirmDelete}
                onRequest={() => setConfirmDelete(true)}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={doDelete}
                busy={saving}
                question="Delete this user permanently?"
              />
            )}
            {!confirmDelete && (
              <>
                <button onClick={() => setMode("reset")} className="btn-secondary">Reset Password</button>
                <button onClick={() => setMode("edit")} className="btn-primary">Edit</button>
              </>
            )}
          </div>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={saveEdit} className="space-y-5 p-5">
          <FormSection title="Identity" columns={1}>
            <Field label="Employee Name">
              {(id) => <input id={id} value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Username" hint="Used to log in.">
              {(id) => <input id={id} value={form.username} onChange={(e) => set("username", e.target.value)} className={`${inputClass} font-mono`} />}
            </Field>
          </FormSection>

          <FormSection title="Access" description="Department only applies to Process Owners — other roles see all departments.">
            <Field label="Role">
              {(id) => (
                <select id={id} value={form.role} onChange={(e) => set("role", e.target.value)} className={inputClass}>
                  <option value="STORE_ADMIN">Store Admin</option>
                  <option value="PROCESS_OWNER">Process Owner</option>
                  <option value="MONITORING">Monitoring</option>
                </select>
              )}
            </Field>
            <Field label="Department">
              {(id) => (
                <select id={id} disabled={form.role !== "PROCESS_OWNER"} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputClass}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  <option value="All">All</option>
                </select>
              )}
            </Field>
            <Field label="Status">
              {(id) => (
                <select id={id} value={form.status} onChange={(e) => set("status", e.target.value)} className={inputClass}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              )}
            </Field>
          </FormSection>

          <FormSection title="Contact">
            <Field label="Email" hint="Where notifications are sent — e.g. Outlook address." className="sm:col-span-2">
              {(id) => <input id={id} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Phone">
              {(id) => <input id={id} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />}
            </Field>
          </FormSection>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" onClick={() => setMode("view")} className="btn-secondary">Back</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {mode === "reset" && (
        <form onSubmit={saveReset} className="space-y-4 p-5">
          <p className="text-xs text-slate-900 dark:text-slate-300">
            Set a new password for <strong>{user.username}</strong>. Share it with them securely.
          </p>
          <Field label="New Password" required hint="At least 6 characters.">
            {(id) => (
              <input id={id} type="text" minLength={6} required value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
            )}
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" onClick={() => setMode("view")} className="btn-secondary">Back</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Reset Password"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function UserDetail({ label, value, mono, span2 }: { label: string; value: string; mono?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <p className="eyebrow">{label}</p>
      <p className={`text-value mt-1 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function UserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    employeeId: "",
    employeeName: "",
    department: DEPARTMENTS[0] as string,
    role: "PROCESS_OWNER",
    username: "",
    password: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, department: form.role === "STORE_ADMIN" || form.role === "MONITORING" ? "All" : form.department };
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create user");
      setSaving(false);
      return;
    }
    onCreated();
  }

  return (
    <Modal open onClose={onClose} title="Create User" description="Grants access to the Tool Room system" size="lg">
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormSection title="Employee">
          <Field label="Employee ID" required>
            {(id) => <input id={id} required value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Employee Name" required>
            {(id) => <input id={id} required value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        <FormSection title="Access" description="Department only applies to Process Owners.">
          <Field label="Role" required>
            {(id) => (
              <select id={id} value={form.role} onChange={(e) => set("role", e.target.value)} className={inputClass}>
                <option value="STORE_ADMIN">Store Admin</option>
                <option value="PROCESS_OWNER">Process Owner</option>
                <option value="MONITORING">Monitoring</option>
              </select>
            )}
          </Field>
          <Field label="Department">
            {(id) => (
              <select
                id={id}
                disabled={form.role !== "PROCESS_OWNER"}
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                className={inputClass}
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </Field>
        </FormSection>

        <FormSection title="Credentials">
          <Field label="Username" required>
            {(id) => <input id={id} required value={form.username} onChange={(e) => set("username", e.target.value)} className={`${inputClass} font-mono`} />}
          </Field>
          <Field label="Password" required>
            {(id) => <input id={id} required type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        <FormSection title="Contact">
          <Field label="Email" required hint="Low-stock and movement notifications go here.">
            {(id) => <input id={id} required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Phone">
            {(id) => <input id={id} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />}
          </Field>
        </FormSection>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
