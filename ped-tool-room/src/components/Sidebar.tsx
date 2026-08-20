"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Boxes,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Users,
  History,
  X,
  HelpCircle,
  Wallet,
  Truck,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/materials", label: "Material Master", icon: Boxes, group: "Inventory", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/inward", label: "Inward", icon: PackagePlus, group: "Inventory", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/outward", label: "Outward Register", icon: PackageMinus, group: "Inventory", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/stock-summary", label: "Stock Summary", icon: ClipboardList, group: "Analysis", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/budget", label: "Department Budget", icon: Wallet, group: "Analysis", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/suppliers", label: "Suppliers", icon: Truck, group: "Analysis", roles: ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] },
  { href: "/users", label: "User Management", icon: Users, group: "Administration", roles: ["STORE_ADMIN"] },
  { href: "/audit-log", label: "Audit Log", icon: History, group: "Administration", roles: ["STORE_ADMIN", "MONITORING"] },
];

const GROUP_ORDER = ["Overview", "Inventory", "Analysis", "Administration"] as const;

// Always last, always visible to every role — kept separate from `nav` so
// it never gets caught up in role-filtering logic by accident.
const helpItem = { href: "/help", label: "How to Use", icon: HelpCircle };

function navLinkClass(active: boolean) {
  return `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
    active
      ? "bg-teal-600/[0.08] text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
      : "text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

function navIconClass(active: boolean) {
  return `h-4 w-4 flex-shrink-0 ${
    active
      ? "text-teal-700 dark:text-teal-300"
      : "text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300"
  }`;
}

function SidebarContent({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visible = nav.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Fixed width so the links don't reflow while the rail collapses. */}
      <nav className="w-64 flex-1 overflow-y-auto px-3 py-4">
        {GROUP_ORDER.map((group) => {
          const items = visible.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-5 last:mb-0">
              <p className="eyebrow px-3 pb-1.5">{group}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={onNavigate} className={navLinkClass(active)}>
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-teal-600 dark:bg-teal-400" />
                      )}
                      <Icon className={navIconClass(active)} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="w-64 border-t border-slate-100 px-3 pt-2 pb-4 dark:border-slate-800">
        <Link href={helpItem.href} onClick={onNavigate} className={navLinkClass(pathname === helpItem.href)}>
          <HelpCircle className={navIconClass(pathname === helpItem.href)} />
          {helpItem.label}
        </Link>
      </div>
    </>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 rounded-md border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        <Image src="/wipro-logo.jpg" alt="Logo" width={46} height={26} className="h-[26px] w-[46px] object-contain" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-900 leading-tight dark:text-slate-100">
          PED Tool Room
        </p>
        <p className="text-label truncate text-[10px] tracking-wide leading-tight">Production Engineering</p>
      </div>
    </div>
  );
}

/**
 * Static sidebar, visible from the `md` breakpoint up. `open` is driven by the
 * topbar's menu button — collapsing it to zero width hands the full viewport
 * to a wide register, and the width transition keeps that legible rather than
 * making the content jump.
 */
export function Sidebar({ role, open }: { role: string; open: boolean }) {
  return (
    /* Frozen to the viewport: pinned at the top, exactly one screen tall, so
       scrolling a long register never carries the navigation away with it.
       The nav list inside scrolls on its own if it outgrows the height. */
    <aside
      id="app-side-column"
      inert={!open || undefined}
      aria-hidden={!open || undefined}
      className={`sticky top-0 hidden h-screen flex-shrink-0 flex-col self-start overflow-hidden border-slate-200 bg-white/90 backdrop-blur-xl transition-[width] duration-300 ease-out md:flex dark:border-slate-700 dark:bg-slate-900/70 ${
        open ? "w-64 border-r" : "w-0 border-r-0"
      }`}
    >
      {/* Exactly one topbar tall, so the brand block and the topbar controls
          share a single baseline instead of sitting a few pixels apart. */}
      <div className="flex h-(--topbar-h) w-64 flex-shrink-0 items-center border-b border-slate-200 px-5 dark:border-slate-700">
        <BrandMark />
      </div>
      <SidebarContent role={role} />
    </aside>
  );
}

/**
 * Slide-in drawer version for mobile/tablet (below the `md` breakpoint),
 * where the static Sidebar above is hidden entirely. Without this, the app
 * has no navigation at all on phones — this is the fix for that.
 */
export function MobileSidebar({
  role,
  open,
  onClose,
}: {
  role: string;
  open: boolean;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-brand-ink/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Reduced motion has to fade, not slide. Our global MotionConfig
              uses reducedMotion="user", which drops transform animations —
              an x-based slide would leave `initial` applied and strand the
              drawer off-screen, i.e. no navigation at all on a phone. */}
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: reduceMotion ? 0.15 : 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-700">
              <BrandMark />
              <button
                onClick={onClose}
                aria-label="Close navigation menu"
                className="p-1 text-slate-900 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent role={role} onNavigate={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
