"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

interface Session {
  id: string;
  username: string;
  employeeName: string;
  role: "STORE_ADMIN" | "PROCESS_OWNER" | "MONITORING";
  department: string;
}

interface AppContextValue {
  session: Session;
  department: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within app layout");
  return ctx;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [department, setDepartment] = useState("All");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Desktop side column can be tucked away to give a 14-column register the
  // full width. Remembered per device so it survives a reload.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      // Intentional: restoring the persisted preference on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("ped-sidebar") === "closed") setSidebarOpen(false);
    } catch {
      // localStorage unavailable (private browsing) — just defaults to open.
    }
  }, []);

  function toggleSidebar() {
    setSidebarOpen((wasOpen) => {
      const next = !wasOpen;
      try {
        localStorage.setItem("ped-sidebar", next ? "open" : "closed");
      } catch {
        // Preference just won't persist across reloads.
      }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then((s: Session) => {
        setSession(s);
        if (s.role === "PROCESS_OWNER") setDepartment(s.department);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-5 dark:bg-slate-950">
        <div className="splash-logo-in flex flex-col items-center gap-5">
          <Image src="/wipro-logo.jpg" alt="" width={120} height={68} className="w-[120px] h-[68px] object-contain" priority />
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600 splash-dot" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-brand-ink-soft splash-dot dark:bg-slate-400" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600 splash-dot" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-xs tracking-[0.2em] text-slate-800 uppercase">PED Tool Room</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ session, department }}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar role={session.role} open={sidebarOpen} />
        <MobileSidebar role={session.role} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            session={session}
            department={department}
            onDepartmentChange={setDepartment}
            onMenuClick={() => setMobileMenuOpen(true)}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
