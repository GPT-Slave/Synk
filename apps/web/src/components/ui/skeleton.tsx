"use client";

import type * as React from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-[linear-gradient(90deg,oklch(1_0_0_/_0.035),oklch(1_0_0_/_0.075),oklch(1_0_0_/_0.035))] bg-[length:220%_100%]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export function DashboardSkeleton() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-7xl py-10" role="status">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-6 h-10 w-80 max-w-full" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-28" key={item} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <Skeleton className="h-[32rem]" />
        <div className="space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-52" />
        </div>
      </div>
      <span className="sr-only">{t("Loading Synk…")}</span>
    </div>
  );
}
