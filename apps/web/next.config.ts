import type { NextConfig } from "next";
import path from "node:path";

const production = process.env.NODE_ENV === "production";
const deploymentId = deploymentIdentifier();
const apiOrigin = safeOrigin(
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:4000",
);
const socketOrigin = safeOrigin(
  process.env.NEXT_PUBLIC_WS_URL,
  apiOrigin.replace(/^http/, "ws"),
);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${socketOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const noCacheHeaders = [
  {
    key: "Cache-Control",
    value: "no-cache, no-store, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  compress: true,
  ...(deploymentId ? { deploymentId } : {}),
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@meet-planner/shared-types"],
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          ...(production
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          ...noCacheHeaders,
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/logo.png",
        headers: noCacheHeaders,
      },
      {
        source: "/logo_nobg.png",
        headers: noCacheHeaders,
      },
    ];
  },
};

export default nextConfig;

function safeOrigin(value: string | undefined, fallback: string) {
  try {
    return new URL(value ?? fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

function deploymentIdentifier() {
  const raw = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  const sanitized = raw?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return sanitized || undefined;
}
