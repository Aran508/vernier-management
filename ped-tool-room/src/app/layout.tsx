import type { Metadata } from "next";
import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: "PED Tool Room | Store Management System",
  description: "Production Engineering Department - Tool Room Store & Inventory Management System",
};

// Runs before paint, before React hydrates, so there's no flash of the
// wrong theme on load. Reads the saved preference (or falls back to the
// OS setting) and applies the `.dark` class Tailwind's custom dark variant
// looks for.
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('ped-theme');
    var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
