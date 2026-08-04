"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/lib/i18n";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();

  useEffect(() => {
    if (session.isError) router.replace("/login");
  }, [router, session.isError]);

  if (session.isPending || session.isError) {
    return (
      <div className="grid min-h-svh place-items-center" role="status">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          {t("Checking your session…")}
        </div>
      </div>
    );
  }

  return children;
}
