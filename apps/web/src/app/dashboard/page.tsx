"use client";

import { CalendarPlus } from "lucide-react";
import Image from "next/image";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { data } = useSession();

  return (
    <main className="min-h-svh px-5 py-6 sm:px-8">
      <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <Image
            alt=""
            className="brand-neon-red size-10 rounded-xl"
            height={64}
            src="/logo.png"
            width={64}
          />
          <span className="text-lg font-semibold tracking-tight">Calendra</span>
        </div>
        <LogoutButton />
      </nav>

      <section className="mx-auto max-w-6xl py-16">
        <p className="text-sm text-muted-foreground">
          Signed in as {data?.user.email}
        </p>
        <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Your meetings
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Organizer authentication is ready. Meeting creation arrives in the
              next phase.
            </p>
          </div>
          <Button className="h-10" disabled>
            <CalendarPlus />
            Create meeting
          </Button>
        </div>
      </section>
    </main>
  );
}
