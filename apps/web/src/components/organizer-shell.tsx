"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProtectedRoute } from "@/components/auth/protected-route";

export function OrganizerShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <main className="relative min-h-svh overflow-x-hidden px-5 py-6 sm:px-8">
        <div
          aria-hidden="true"
          className="synk-float pointer-events-none fixed -end-52 top-20 size-[34rem] rounded-full bg-[radial-gradient(circle,oklch(0.82_0.18_245_/_0.09),transparent_68%)]"
        />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
          <Link className="group flex items-center gap-3" href="/dashboard">
            <Image
              alt=""
              className="brand-neon-blue size-10 rounded-lg transition-transform duration-200 group-hover:scale-105"
              height={64}
              src="/logo.png"
              width={64}
            />
            <span className="brand-wordmark text-lg">Synk</span>
          </Link>
          <LogoutButton />
        </nav>
        <div className="relative z-10">{children}</div>
      </main>
    </ProtectedRoute>
  );
}
