"use client";

import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/Toast";

// `reducedMotion="user"` makes every framer-motion animation in the app collapse
// when the OS asks for reduced motion, matching what the CSS keyframes already
// do via their own media queries. MotionConfig renders no DOM node, so wrapping
// the tree in it can't shift layout or cause a hydration mismatch.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
