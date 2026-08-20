import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `npm run host` serves the dev server on the local network so other PCs on
   * the shop floor can open it by IP. Next.js blocks cross-origin dev requests
   * unless the origin is listed here, which otherwise shows up as assets
   * failing to load from any machine that isn't the one running the server.
   * These are private (LAN-only) ranges plus mDNS names — never public hosts.
   */
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.local",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.2*.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "192.168.*.*",
  ],
};

export default nextConfig;
