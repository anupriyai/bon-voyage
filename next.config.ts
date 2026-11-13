import type { NextConfig } from "next";

// Staged CSP: collect violations before enforcing a nonce policy on all routes.
// A strict nonce policy makes these server-rendered pages dynamic (see installed Next guide).
const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'",
  "form-action 'self'", "frame-ancestors 'self'",
  "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "frame-src 'self'",
].join("; ");
const nextConfig: NextConfig = {
  distDir: process.env.BON_VOYAGE_ISOLATED_TESTS === "1" ? ".next-isolated" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy-Report-Only", value: csp },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ] }];
  },
};

export default nextConfig;
