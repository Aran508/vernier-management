"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { SplashScreen } from "@/components/SplashScreen";

const DEPARTMENTS_SERVED = ["Machining", "Welding", "Assembly & Testing", "Burnishing & Project"];

export default function LoginPage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Ambient motion is decoration, so it holds a still frame when the viewer
  // has asked for reduced motion rather than looping regardless.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) v.pause();
      else v.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <div className="flex min-h-screen bg-white dark:bg-slate-950">
        {/* ── Left half: the rig at work ─────────────────────────────────
            Hidden below lg, where a video would cost bandwidth and vertical
            room without earning either. */}
        <div className="relative hidden w-1/2 overflow-hidden bg-brand-ink lg:block">
          <video
            ref={videoRef}
            src="/login-cylinder.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            /* Cropped to the working half of the footage. The left ~39% of the
               source frame is flat pale backdrop — measured: it holds under 3%
               of all motion — so the frame is pushed across to sit on the
               animation itself (motion centres on x=869 of 1280). Taller than
               the panel too, which drops the bottom strip out of view. */
            className="absolute left-0 top-0 h-[122%] w-full object-cover object-[79%_0%]"
          />

          {/* Ink wash — carries the copy and keeps the footage from competing. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/70 to-brand-ink/25"
            aria-hidden="true"
          />

          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white p-2">
                <Image
                  src="/wipro-logo.jpg"
                  alt="Company logo"
                  width={54}
                  height={30}
                  className="h-[30px] w-[54px] object-contain"
                  priority
                />
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white">PED Tool Room</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/70">Production Engineering</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                Tool Room Control Centre
              </p>
              <h2 className="mt-3 max-w-md text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
                Every tool
                <span className="block text-teal-300">accounted for.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
                Receipts, issues and stock levels for four production areas — recorded once, visible to everyone who
                needs them.
              </p>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5">
                {DEPARTMENTS_SERVED.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-teal-300" aria-hidden="true" />
                    <span className="text-xs font-medium text-white/80">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right half: the form ───────────────────────────────────────── */}
        <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
          {/* Faint drawing grid and a single warm-cool wash, so the panel reads
              as drafting paper rather than an empty white field. */}
          <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-600/[0.07] blur-3xl"
            aria-hidden="true"
          />
          <div className="relative w-full max-w-[26rem]">
            {/* Brand block repeats here only on small screens, where the
                left panel isn't rendered at all. */}
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <div className="mb-4 rounded-xl bg-white p-3 shadow-md dark:bg-slate-900">
                <Image
                  src="/wipro-logo.jpg"
                  alt="Company logo"
                  width={100}
                  height={56}
                  className="h-[56px] w-[100px] object-contain"
                  priority
                />
              </div>
              <h1 className="text-section text-slate-900 dark:text-slate-100">PED Tool Room</h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-800 dark:text-slate-400">
                Production Engineering
              </p>
            </div>

            {/* The form sits in a real card: on a half-screen white panel a
                bare form reads as unfinished, and the border gives the fields
                something to belong to. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,31,46,0.04),0_12px_32px_-8px_rgba(15,31,46,0.14)] sm:p-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="hidden lg:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-800 dark:text-teal-400">
                  Tool Room Access
                </p>
                <h1 className="mt-2.5 text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.025em] text-slate-900 dark:text-slate-100">
                  Sign in
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-400">
                  Enter the credentials issued to you by the Store Admin.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-200">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="e.g. admin"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-teal-600/60 focus:ring-2 focus:ring-teal-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-200">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                    onBlur={() => setCapsLock(false)}
                    aria-describedby={capsLock ? "caps-warning" : undefined}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-teal-600/60 focus:ring-2 focus:ring-teal-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Caps Lock is a common cause of "wrong password" — say so
                    before the attempt rather than after it fails. */}
                {capsLock && (
                  <p
                    id="caps-warning"
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    Caps Lock is on
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex cursor-pointer select-none items-center gap-2 font-medium text-slate-900 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-400 bg-white accent-teal-700"
                  />
                  Remember me
                </label>
                <button type="button" className="font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-400">
                  Forgot password?
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  {error}
                </div>
              )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-[15px]">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              {/* Requesting access, not self-registration: this system has no
                  public sign-up route by design — `/api/users` requires an
                  authenticated Store Admin — so this points at the real path
                  instead of offering a button that couldn't work. */}
              <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Need an account?</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-800 dark:text-slate-400">
                  Accounts are issued by the Store Admin for your department. Ask them to create one — this system
                  doesn&apos;t allow self sign-up.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-teal-800 dark:text-teal-400" aria-hidden="true" />
                <p className="text-[11px] text-slate-800 dark:text-slate-400">
                  Access is recorded against your account
                </p>
              </div>
            </div>

            {/* Outside the card: which areas this store serves, so the page
                says what the system is for even before you're in. */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 lg:hidden">
              {DEPARTMENTS_SERVED.map((d) => (
                <div key={d} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-teal-700" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-slate-800 dark:text-slate-400">{d}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-800 dark:text-slate-500">
              PED Tool Room · Store Management System
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
