"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProtectedRoute } from "@/components/auth/protected-route";

export function OrganizerShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <main className="min-h-svh px-5 py-6 sm:px-8">
        <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
          <Link className="flex items-center gap-3" href="/dashboard">
            <Image
              alt=""
              className="brand-neon-blue size-10 rounded-lg"
              height={64}
              src="/logo.png"
              width={64}
            />
            <span className="text-lg font-semibold tracking-tight">Synk</span>
          </Link>
          <LogoutButton />
        </nav>
        {children}
      </main>
    </ProtectedRoute>
  );
}
