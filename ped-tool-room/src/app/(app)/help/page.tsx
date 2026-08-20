"use client";

import { useAppContext } from "../layout";
import {
  Boxes,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Search,
  Bell,
  FileText,
  Upload,
  Users,
  Mail,
  ShieldCheck,
} from "lucide-react";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Boxes;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card card-interactive p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-teal-600/[0.08] p-2 dark:bg-teal-400/10">
          <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
        </div>
        <h2 className="text-value text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-slate-900 dark:text-slate-300">{children}</div>
    </section>
  );
}

export default function HelpPage() {
  const { session } = useAppContext();
  const isAdmin = session.role === "STORE_ADMIN";
  const isProcessOwner = session.role === "PROCESS_OWNER";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <span className="section-rule" />
        <h1 className="text-hero text-value">How to use<br />PED Tool Room</h1>
        <p className="mt-4 text-sm text-slate-900 dark:text-slate-300">
          A guide to the main workflows, tailored to your role
          ({session.role.replace("_", " ")}
          {isProcessOwner ? ` · ${session.department}` : ""}).
        </p>
      </header>

      <Section icon={Boxes} title="Material Master">
        <p>Every item the store tracks starts here. Each material has a part number, category, department, min/max stock, and location.</p>
        {isAdmin ? (
          <p>As Store Admin, click <strong>Add Material</strong> to create one, or click any row to view, edit, or delete it.</p>
        ) : (
          <p>You can search and view all materials in your department. Only Store Admin can add, edit, or delete materials — click any row to view full details.</p>
        )}
      </Section>

      <Section icon={PackagePlus} title="Inward (receiving stock)">
        <p>Log stock arriving from a supplier. Pick the part number — matching material details auto-fill.</p>
        <p><strong>New part number?</strong> If it isn&apos;t in Material Master yet, the form shows extra fields (min/max stock) right there — fill those in and it creates the material and the inward entry together, in one step.</p>
        {(isAdmin || isProcessOwner) && <p>Click the pencil icon on any row to edit an existing entry — stock is automatically recalculated.</p>}
      </Section>

      <Section icon={PackageMinus} title="Outward Register (issuing stock)">
        <p>Log stock going out to a department/line. The system blocks issuing more than what&apos;s currently available.</p>
        {(isAdmin || isProcessOwner) && <p>Click the pencil icon to edit an existing entry — quantity changes are re-checked against available stock.</p>}
      </Section>

      <Section icon={ClipboardList} title="Stock Summary">
        <p>Opening, inward, outward, and closing balances for every material, plus inventory value and no-movement tracking. Use the status chips to filter to Low/Out of Stock/Over Stock items quickly.</p>
      </Section>

      <Section icon={Upload} title="Bulk Excel Import">
        <p>On Materials, Inward, and Outward, use <strong>Import Excel</strong> to upload many rows at once instead of typing them one by one.</p>
        <p>Click <strong>Download blank template</strong> first to get the right columns. Header names are flexible — &ldquo;Part Number&rdquo;, &ldquo;Part No.&rdquo;, and &ldquo;PN&rdquo; are all recognized, so you don&apos;t need to match the template exactly.</p>
        <p>After importing, review the result summary — any row that couldn&apos;t be imported shows exactly why. Imported records can be edited afterward like any normal entry.</p>
      </Section>

      <Section icon={FileText} title="PDF Export">
        <p>Every table has an <strong>Export PDF</strong> button. Choose <strong>Current filtered view</strong> to export exactly what you&apos;re looking at, or <strong>Entire dataset</strong> for everything you have access to.</p>
      </Section>

      <Section icon={Search} title="Global Search">
        <p>The search bar at the top works across materials, inward, and outward records. Click any result to jump straight to it.</p>
      </Section>

      <Section icon={Bell} title="Notifications">
        <p>The bell icon shows low-stock alerts and recent inward/outward activity{isAdmin || session.role === "MONITORING" ? ", plus recent admin actions" : ""}.</p>
      </Section>

      <Section icon={Mail} title="Email Notifications">
        <p>The system can email you automatically when: a material is issued, received, runs low on stock, or a daily stock summary — if your admin has configured email sending (SMTP) and you have an email address on file.</p>
        <p>Click your profile picture (top right) → set or update your email — that&apos;s where notifications get sent.</p>
      </Section>

      {isAdmin && (
        <>
          <Section icon={Users} title="User Management (Admin only)">
            <p>Create accounts for Process Owners and Monitoring users, reset passwords, and deactivate accounts that shouldn&apos;t log in anymore. Click any user to view, edit, or delete them.</p>
          </Section>

          <Section icon={ShieldCheck} title="System Settings (Admin only)">
            <p>Click the gear icon (top right) to change the company name shown on reports/emails, toggle low-stock email alerts, and control the daily stock summary email — including what time it sends.</p>
          </Section>
        </>
      )}

      <Section icon={ShieldCheck} title="Roles at a glance">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Store Admin</strong> — full access to every department, every feature.</li>
          <li><strong>Process Owner</strong> — full inward/outward access, but only for their own department.</li>
          <li><strong>Monitoring</strong> — read-only access across all departments (cannot create or edit records).</li>
        </ul>
      </Section>
    </div>
  );
}
