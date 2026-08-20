"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, User as UserIcon, AlertTriangle, PackagePlus, PackageMinus, ShieldAlert } from "lucide-react";
import { DEPARTMENTS } from "@/lib/types";
import { getStoredTheme, setTheme } from "@/lib/theme";
import { Modal } from "@/components/Modal";

interface Session {
  id: string;
  employeeName: string;
  role: string;
  department: string;
}

interface SearchResults {
  materials: { partNumber: string; description: string }[];
  inward: { partNumber: string; description: string; invoiceNumber: string }[];
  outward: { partNumber: string; description: string; issuedTo: string }[];
}

interface NotificationItem {
  id: string;
  type: "low-stock" | "out-of-stock" | "inward" | "outward" | "admin";
  title: string;
  detail: string;
  timestamp: string;
}

export function Topbar({
  session,
  department,
  onDepartmentChange,
  onMenuClick,
  sidebarOpen,
  onToggleSidebar,
}: {
  session: Session;
  department: string;
  onDepartmentChange: (d: string) => void;
  onMenuClick: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      const res = await fetch("/api/notifications");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!query) {
      // Intentional: clearing stale results synchronously when the search box empties.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setResults(await res.json());
        setOpen(true);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isProcessOwner = session.role === "PROCESS_OWNER";

  return (
    <header className="sticky top-0 z-30 flex h-(--topbar-h) items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl md:px-6 dark:border-slate-700 dark:bg-slate-900/75">
      {/* One menu button at every size: below `md` it opens the drawer, from
          `md` up it tucks the side column away. 44px tap target. */}
      <button
        onClick={onMenuClick}
        className="-ml-1 flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-900 transition hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="app-side-column"
        title={sidebarOpen ? "Hide the side column" : "Show the side column"}
        className="-ml-1 hidden h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-900 transition hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={sidebarOpen ? "Hide navigation side column" : "Show navigation side column"}
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* Global search */}
      <div ref={boxRef} className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search material, part number, category, location, supplier, invoice…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-16 text-sm text-value placeholder:text-slate-600 outline-none transition focus:border-teal-600/50 focus:bg-white focus:ring-2 focus:ring-teal-600/15 dark:bg-slate-950/60 dark:border-slate-700 dark:focus:bg-slate-900"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 sm:block dark:border-slate-700 dark:bg-slate-900">
          Ctrl K
        </kbd>
        {open && results && (
          <div className="absolute mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 max-h-96 overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
            {results.materials.length === 0 && results.inward.length === 0 && results.outward.length === 0 && (
              <p className="px-4 py-3 text-xs text-label">No results found.</p>
            )}
            {results.materials.length > 0 && (
              <div className="p-2">
                <p className="eyebrow px-2 py-1">Materials</p>
                {results.materials.map((m) => (
                  <button
                    key={m.partNumber}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      if (pathname === "/dashboard") {
                        router.push(`/dashboard?part=${encodeURIComponent(m.partNumber)}`);
                      } else {
                        router.push(`/materials?open=${encodeURIComponent(m.partNumber)}`);
                      }
                    }}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm font-medium text-value hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="text-teal-600 dark:text-teal-400 font-mono text-xs mr-2">{m.partNumber}</span>
                    {m.description}
                  </button>
                ))}
              </div>
            )}
            {results.inward.length > 0 && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                <p className="eyebrow px-2 py-1">Inward</p>
                {results.inward.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/inward?highlight=${encodeURIComponent(m.partNumber)}`);
                    }}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm font-medium text-value hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="text-teal-600 dark:text-teal-400 font-mono text-xs mr-2">{m.partNumber}</span>
                    {m.description} <span className="text-label">· {m.invoiceNumber}</span>
                  </button>
                ))}
              </div>
            )}
            {results.outward.length > 0 && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                <p className="eyebrow px-2 py-1">Outward</p>
                {results.outward.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/outward?highlight=${encodeURIComponent(m.partNumber)}`);
                    }}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm font-medium text-value hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="text-teal-600 dark:text-teal-400 font-mono text-xs mr-2">{m.partNumber}</span>
                    {m.description} <span className="text-label">→ {m.issuedTo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Department filter */}
      <div className="hidden sm:block">
        <select
          value={department}
          disabled={isProcessOwner}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-value outline-none transition focus:border-teal-600/50 focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:border-slate-700"
        >
          <option value="All">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div ref={notifRef} className="relative">
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 blink-alert" />
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 max-h-96 overflow-y-auto z-30 dark:bg-slate-900 dark:border-slate-700">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-value">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-xs text-label text-center">Nothing to show right now.</p>
            ) : (
              notifications.map((n) => <NotificationRow key={n.id} item={n} />)
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-700">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-semibold text-value leading-tight">{session.employeeName}</p>
          <p className="text-label text-[10px] leading-tight mt-0.5">
            {session.role.replace("_", " ")} {session.department !== "All" ? `· ${session.department}` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowProfile(true)}
          className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-600 to-brand-ink flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-slate-900 transition hover:opacity-90 hover:shadow-md cursor-pointer"
          title="My Profile"
          aria-label="Open my profile"
        >
          <UserIcon className="h-4 w-4 text-white" />
        </button>
        {session.role === "STORE_ADMIN" && (
          <button
            onClick={() => setShowSettings(true)}
            className="text-slate-800 hover:text-teal-600 p-1.5 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-400 cursor-pointer"
            title="System Settings"
            aria-label="Open system settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
        <button onClick={logout} className="text-slate-800 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400 cursor-pointer" title="Logout" aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <ProfileModal open={showProfile} userId={session.id} onClose={() => setShowProfile(false)} />
      {session.role === "STORE_ADMIN" && (
        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </header>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const config: Record<NotificationItem["type"], { icon: typeof Bell; color: string }> = {
    "low-stock": { icon: AlertTriangle, color: "text-orange-600" },
    "out-of-stock": { icon: AlertTriangle, color: "text-red-600" },
    inward: { icon: PackagePlus, color: "text-emerald-600" },
    outward: { icon: PackageMinus, color: "text-purple-600" },
    admin: { icon: ShieldAlert, color: "text-blue-600" },
  };
  const { icon: Icon, color } = config[item.type];
  const when = new Date(item.timestamp);
  const timeLabel = Number.isNaN(when.getTime()) ? "" : when.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-value">{item.title}</p>
        <p className="text-[11px] text-label truncate">{item.detail}</p>
        {timeLabel && <p className="text-label text-[10px] mt-0.5">{timeLabel}</p>}
      </div>
    </div>
  );
}

function ProfileModal({ open, userId, onClose }: { open: boolean; userId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((u) => {
        setEmail(u.email || "");
        setPhone(u.phone || "");
        setLoading(false);
      });
  }, [open, userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const body: Record<string, string> = { email, phone };
    if (newPassword) {
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters");
        setSaving(false);
        return;
      }
      body.newPassword = newPassword;
    }
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to save");
      setSaving(false);
      return;
    }
    setSuccess(true);
    setNewPassword("");
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My Profile"
      description="Contact details and password"
    >
      {loading ? (
        <div className="p-8"><div className="skeleton h-24 rounded-lg" /></div>
      ) : (
        <form onSubmit={save} className="p-5 space-y-3">
          <p className="text-xs text-slate-900 dark:text-slate-300">
            This email is used to send you low-stock, inward, and outward notifications.
          </p>
          <div>
            <label className="block text-label text-xs mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-label text-xs mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-label text-xs mb-1">Change Password (optional)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className={FIELD}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Saved successfully.</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// One input treatment for the two dialogs in this file. Pages migrated later
// get the shared Field component instead.
const FIELD =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600/50 focus:bg-white focus:ring-2 focus:ring-teal-600/15 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:bg-slate-900";
const FIELD_SM = FIELD.replace("px-3 py-2 text-sm", "px-3 py-1.5 text-xs");

export function DeptChevron() {
  return <ChevronDown className="h-3 w-3" />;
}

/**
 * Server settings per provider. `smtp.office365.com` only serves Microsoft 365
 * work/school mailboxes; a personal outlook.com / hotmail / live address goes
 * through `smtp-mail.outlook.com`. Getting this wrong is the most common
 * reason a correct username and password still fails to authenticate.
 */
const SMTP_PRESETS = [
  { label: "Microsoft 365 (work)", host: "smtp.office365.com", port: "587", secure: false, domains: [] as string[] },
  {
    label: "Outlook.com (personal)",
    host: "smtp-mail.outlook.com",
    port: "587",
    secure: false,
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
  },
  { label: "Gmail", host: "smtp.gmail.com", port: "587", secure: false, domains: ["gmail.com", "googlemail.com"] },
];

interface MailLogEntry {
  id: string;
  recipients: string;
  subject: string;
  status: string;
  detail: string | null;
  transport: string | null;
  createdAt: string;
}

const MAIL_STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  outbox: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  skipped: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

type ClearModule = "materials" | "inward" | "outward";

const MODULE_META: Record<ClearModule, { label: string; blurb: string }> = {
  inward: { label: "Inward", blurb: "Receipts register. Stock these entries added is taken back off Material Master." },
  outward: { label: "Outward", blurb: "Issue register. Stock these entries took out is returned to Material Master." },
  materials: { label: "Material Master", blurb: "The part catalogue itself. Only clearable once both registers are empty." },
};

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    companyName: "",
    companyTagline: "",
    lowStockAlertsEnabled: true,
    dailyDigestEnabled: true,
    dailyDigestHour: "8",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    smtpUser: "",
    smtpFrom: "",
    smtpPass: "",
  });
  const [smtpPassSet, setSmtpPassSet] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [counts, setCounts] = useState<Record<ClearModule, number> | null>(null);
  const [armed, setArmed] = useState<ClearModule | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [mailLog, setMailLog] = useState<MailLogEntry[] | null>(null);
  const [showMailLog, setShowMailLog] = useState(false);

  async function loadCounts() {
    const res = await fetch("/api/settings/clear-data");
    if (res.ok) setCounts(await res.json());
  }

  async function loadMailLog() {
    const res = await fetch("/api/settings/test-email");
    if (res.ok) setMailLog((await res.json()).entries);
  }

  async function clearModule(module: ClearModule) {
    if (!counts) return;
    setClearing(true);
    setClearResult(null);
    const res = await fetch("/api/settings/clear-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, confirmCount: counts[module] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setClearResult({ ok: false, message: data.error || "Failed to clear" });
    } else {
      setClearResult({
        ok: true,
        message: `Cleared ${data.deleted.toLocaleString("en-IN")} ${MODULE_META[module].label} record(s). A full backup was saved to ${data.backupPath} first — keep that file if you might need this data back. Reload any open page to see the change.`,
      });
      setCounts(data.remaining);
    }
    setArmed(null);
    setConfirmText("");
    setClearing(false);
  }

  async function sendTestEmail() {
    setTestingEmail(true);
    setTestEmailResult(null);
    const res = await fetch("/api/settings/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser,
        smtpFrom: form.smtpFrom,
        smtpPass: form.smtpPass,
      }),
    });
    const data = await res.json();
    setTestEmailResult(
      res.ok ? { ok: true, message: `Sent to ${data.to} — check that inbox.` } : { ok: false, message: data.error || "Failed to send" }
    );
    setTestingEmail(false);
  }

  // The single most common setup mistake: pasting the sending address into
  // the host box. Flagged live so it's caught before the test round-trip.
  const hostLooksLikeEmail = form.smtpHost.includes("@");

  // If the address's domain has a known server and the host doesn't match it,
  // say so — rather than letting them discover it via an auth failure.
  const emailDomain = form.smtpUser.split("@")[1]?.toLowerCase() ?? "";
  const matchedPreset = SMTP_PRESETS.find((p) => p.domains.includes(emailDomain));
  const suggestedPreset =
    matchedPreset && form.smtpHost.trim() && form.smtpHost.trim() !== matchedPreset.host ? matchedPreset : null;

  const host = form.smtpHost.toLowerCase();
  const providerHint = /gmail|google/.test(host)
    ? {
        label: "App Password (16 characters)",
        help: "Gmail rejects your normal account password over SMTP. Generate an App Password instead — two-step verification must be on first.",
        url: "https://myaccount.google.com/apppasswords",
        urlLabel: "Create one →",
      }
    : /outlook|hotmail|live|msn/.test(host)
      ? {
          label: "App Password",
          help: "Personal Microsoft accounts no longer accept an ordinary password over SMTP — you'll need an app password, which requires two-step verification on the account.",
          url: "https://account.microsoft.com/security",
          urlLabel: "Account security →",
        }
      : null;

  useEffect(() => {
    // Intentional: reading the current theme from the DOM/localStorage on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDarkMode(getStoredTheme() === "dark");
  }, []);

  function toggleDarkMode(next: boolean) {
    setDarkMode(next);
    setTheme(next ? "dark" : "light");
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setForm({
          companyName: s.companyName,
          companyTagline: s.companyTagline,
          lowStockAlertsEnabled: s.lowStockAlertsEnabled === "true",
          dailyDigestEnabled: s.dailyDigestEnabled === "true",
          dailyDigestHour: s.dailyDigestHour,
          smtpHost: s.smtpHost || "",
          smtpPort: s.smtpPort || "587",
          smtpSecure: s.smtpSecure === "true",
          smtpUser: s.smtpUser || "",
          smtpFrom: s.smtpFrom || "",
          smtpPass: "",
        });
        setSmtpPassSet(s.smtpPassSet);
        setLoading(false);
      });
    // Intentional: fetching the row counts to display when the panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCounts();
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to save settings");
      setSaving(false);
      return;
    }
    setSuccess(true);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="System Settings" description="Store Admin only">
        {loading ? (
          <div className="p-8"><div className="skeleton h-40 rounded-lg" /></div>
        ) : (
          <form onSubmit={save} className="p-5 space-y-4">
            <div>
              <label className="block text-label text-xs mb-1">Company Name (shown on emails &amp; PDF reports)</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className={FIELD}
              />
            </div>
            <div>
              <label className="block text-label text-xs mb-1">Tagline</label>
              <input
                value={form.companyTagline}
                onChange={(e) => setForm((f) => ({ ...f, companyTagline: e.target.value }))}
                className={FIELD}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-900 dark:text-slate-100">Dark mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={darkMode}
                  onClick={() => toggleDarkMode(!darkMode)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${darkMode ? "bg-teal-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${darkMode ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
              </label>
              <p className="text-[11px] text-slate-800 mt-1 dark:text-slate-300">Applies instantly, remembered on this device.</p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3 dark:border-slate-800">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-900 dark:text-slate-100">Low stock email alerts</span>
                <input
                  type="checkbox"
                  checked={form.lowStockAlertsEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, lowStockAlertsEnabled: e.target.checked }))}
                  className="h-4 w-4 accent-teal-600"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-900 dark:text-slate-100">Daily stock summary email</span>
                <input
                  type="checkbox"
                  checked={form.dailyDigestEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, dailyDigestEnabled: e.target.checked }))}
                  className="h-4 w-4 accent-teal-600"
                />
              </label>
              {form.dailyDigestEnabled && (
                <div>
                  <label className="block text-label text-xs mb-1">Send daily digest at (server local time, 24h)</label>
                  <select
                    value={form.dailyDigestHour}
                    onChange={(e) => setForm((f) => ({ ...f, dailyDigestHour: e.target.value }))}
                    className={FIELD}
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-800 mt-1 dark:text-slate-300">Takes effect within the hour — no server restart needed.</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Outgoing Email (SMTP)</p>
              <p className="text-[11px] text-slate-800 mt-1 mb-2 dark:text-slate-300">
                This is the account emails are sent <em>from</em> — no need to edit any file, it&apos;s saved right here.
              </p>

              {/* A personal outlook.com address and a Microsoft 365 work
                  mailbox use *different* servers — one preset for "Outlook"
                  sent half of setups to the wrong host. */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-label text-[11px]">Presets:</span>
                {SMTP_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }))
                    }
                    title={`${p.host}:${p.port}`}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                      form.smtpHost === p.host
                        ? "border-teal-600/50 bg-teal-600/10 text-teal-800 dark:text-teal-300"
                        : "border-slate-300 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {suggestedPreset && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="font-semibold">{form.smtpUser.split("@")[1]}</span> addresses send through{" "}
                  <span className="font-mono font-semibold">{suggestedPreset.host}</span>, not the host set now.{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        smtpHost: suggestedPreset.host,
                        smtpPort: suggestedPreset.port,
                        smtpSecure: suggestedPreset.secure,
                      }))
                    }
                    className="font-semibold underline underline-offset-2"
                  >
                    Use {suggestedPreset.label}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label htmlFor="smtp-host" className="block text-label text-[11px] mb-1">
                    SMTP Host <span className="font-normal text-slate-700 dark:text-slate-400">— the mail server, not your address</span>
                  </label>
                  <input
                    id="smtp-host"
                    value={form.smtpHost}
                    onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                    placeholder="smtp.office365.com"
                    aria-invalid={hostLooksLikeEmail || undefined}
                    aria-describedby={hostLooksLikeEmail ? "smtp-host-error" : undefined}
                    className={`${FIELD_SM} ${hostLooksLikeEmail ? "border-red-400 focus:border-red-500" : ""}`}
                  />
                  {hostLooksLikeEmail && (
                    <p id="smtp-host-error" className="mt-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                      That&apos;s an email address. This box needs the server name — most likely{" "}
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: false }))}
                        className="font-semibold underline underline-offset-2"
                      >
                        smtp.office365.com
                      </button>
                      . Your address belongs in the field below.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-label text-[11px] mb-1">Port</label>
                  <input value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
                    className={FIELD_SM} />
                </div>
                <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input type="checkbox" checked={form.smtpSecure} onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))} className="h-3.5 w-3.5 accent-teal-600" />
                  <span className="text-[11px] text-slate-900 dark:text-slate-300">Secure (port 465)</span>
                </label>
                <div className="col-span-2">
                  <label className="block text-label text-[11px] mb-1">Outlook Email Address</label>
                  <input type="email" value={form.smtpUser} onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))} placeholder="notifications@yourcompany.com"
                    className={FIELD_SM} />
                </div>
                <div className="col-span-2">
                  <label className="block text-label text-[11px] mb-1">
                    {providerHint ? providerHint.label : "Password"}{" "}
                    {smtpPassSet && <span className="text-emerald-600">(currently set — leave blank to keep it)</span>}
                  </label>
                  {/* Said up front, not after a failed attempt: neither Gmail nor
                      personal Outlook accepts an ordinary account password over
                      SMTP any more. */}
                  {providerHint && (
                    <p className="mb-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      {providerHint.help}{" "}
                      {providerHint.url && (
                        <a
                          href={providerHint.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline underline-offset-2"
                        >
                          {providerHint.urlLabel}
                        </a>
                      )}
                    </p>
                  )}
                  <input type="password" value={form.smtpPass} onChange={(e) => setForm((f) => ({ ...f, smtpPass: e.target.value }))} placeholder={smtpPassSet ? "••••••••" : "App password or account password"}
                    className={FIELD_SM} />
                </div>
                <div className="col-span-2 space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={testingEmail || hostLooksLikeEmail || (!form.smtpPass && !smtpPassSet)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {testingEmail ? "Sending…" : "Send Test Email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMailLog((s) => !s);
                      if (!mailLog) loadMailLog();
                    }}
                    className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {showMailLog ? "Hide" : "View"} recent mail
                  </button>

                  {/* Given its own block, not squeezed next to the button —
                      these messages explain a fix and need the room. */}
                  {testEmailResult && (
                    <div
                      role="status"
                      className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                        testEmailResult.ok
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                      }`}
                    >
                      {testEmailResult.message}
                    </div>
                  )}

                  {showMailLog && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                      {mailLog === null ? (
                        <div className="p-3"><div className="skeleton h-12 rounded" /></div>
                      ) : mailLog.length === 0 ? (
                        <p className="text-label p-3 text-[11px]">
                          Nothing sent yet. Notifications appear here as soon as an inward, outward or alert fires.
                        </p>
                      ) : (
                        <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                          {mailLog.map((m) => (
                            <li key={m.id} className="px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-900 dark:text-slate-200">
                                  {m.subject}
                                </p>
                                <span
                                  className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    MAIL_STATUS_STYLE[m.status] ?? MAIL_STATUS_STYLE.skipped
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </div>
                              <p className="text-label mt-0.5 truncate text-[10px]">
                                {m.recipients || "no recipients"}
                                {m.transport ? ` · ${m.transport}` : ""}
                              </p>
                              {m.detail && (
                                <p className="text-label mt-0.5 line-clamp-2 text-[10px] leading-snug">{m.detail}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Danger zone ─────────────────────────────────────────────
                Per-module rather than one blanket "Clear All": wiping the
                Inward register shouldn't be able to take the part catalogue
                with it. Each button needs the module name typed to arm. */}
            <div className="rounded-lg border border-red-300 bg-red-50/50 p-3 dark:border-red-500/30 dark:bg-red-500/[0.04]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-300">Clear All Data</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-red-900/80 dark:text-red-300/80">
                    Permanently deletes records from one module. A full database backup is written to{" "}
                    <code className="font-mono">data/backups/</code> automatically before anything is deleted, so this
                    stays recoverable. Accounts, settings and the audit log are never touched.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {(["inward", "outward", "materials"] as ClearModule[]).map((m) => {
                  const n = counts?.[m];
                  const isArmed = armed === m;
                  const meta = MODULE_META[m];
                  return (
                    <div key={m} className="rounded-lg border border-red-200 bg-white p-2.5 dark:border-red-500/20 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {meta.label}{" "}
                            <span className="font-normal tabular-nums text-slate-800 dark:text-slate-400">
                              — {n === undefined ? "…" : `${n.toLocaleString("en-IN")} record${n === 1 ? "" : "s"}`}
                            </span>
                          </p>
                          <p className="text-label mt-0.5 text-[11px] leading-snug">{meta.blurb}</p>
                        </div>
                        {!isArmed && (
                          <button
                            type="button"
                            onClick={() => {
                              setArmed(m);
                              setConfirmText("");
                              setClearResult(null);
                            }}
                            disabled={!n}
                            className="flex-shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-[11px] font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {isArmed && (
                        <div className="mt-2.5 border-t border-red-200 pt-2.5 dark:border-red-500/20">
                          <label htmlFor={`confirm-${m}`} className="block text-[11px] font-medium text-slate-900 dark:text-slate-200">
                            Type <code className="font-mono font-bold">{m}</code> to confirm deleting{" "}
                            {n?.toLocaleString("en-IN")} record{n === 1 ? "" : "s"}
                          </label>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              id={`confirm-${m}`}
                              autoFocus
                              value={confirmText}
                              onChange={(e) => setConfirmText(e.target.value)}
                              placeholder={m}
                              className={`${FIELD_SM} flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() => clearModule(m)}
                              disabled={confirmText !== m || clearing}
                              className="flex-shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-800 disabled:opacity-40"
                            >
                              {clearing ? "Clearing…" : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setArmed(null);
                                setConfirmText("");
                              }}
                              className="flex-shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {clearResult && (
                <div
                  role="status"
                  className={`mt-2.5 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                    clearResult.ok
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-red-400 bg-red-100 text-red-900 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                  }`}
                >
                  {clearResult.message}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-emerald-600">Settings saved.</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Close</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
