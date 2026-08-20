"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HOLD_MS = 1900;
const FADE_MS = 550;

/**
 * One-time animated intro shown before the login form: a dark backdrop with
 * a glow pulse behind a floating white card, the logo revealing with a
 * light sweep across it, then the whole overlay fades out to reveal the
 * login page underneath (already mounted, just hidden behind this opaque
 * layer — no separate transition needed on the login page itself).
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadingOut, setFadingOut] = useState(false);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Intentional: skipping the decorative intro synchronously when the
      // user has reduced motion set — nothing else should render first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSkip(true);
      onDone();
      return;
    }
    const holdTimer = setTimeout(() => setFadingOut(true), HOLD_MS);
    const doneTimer = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skip) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "radial-gradient(circle at 50% 45%, #0f1f2e 0%, #0a1420 55%, #060a10 100%)",
        transitionDuration: `${FADE_MS}ms`,
      }}
      aria-hidden="true"
    >
      <div
        className="absolute h-[420px] w-[420px] rounded-full intro-glow-pulse"
        style={{
          background: "radial-gradient(circle, var(--color-brand-teal) 0%, var(--color-brand-ink-soft) 55%, transparent 75%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative intro-logo-reveal flex flex-col items-center gap-5">
        <div className="relative overflow-hidden rounded-2xl bg-white px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <Image src="/wipro-logo.jpg" alt="" width={140} height={80} className="w-[140px] h-[80px] object-contain" priority />
          <div className="absolute inset-0 intro-shine-sweep pointer-events-none" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 splash-dot" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 splash-dot" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 splash-dot" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xs tracking-widest text-slate-300 uppercase">PED Tool Room</p>
      </div>
    </div>
  );
}
