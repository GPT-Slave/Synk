import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-input bg-white/[0.035] px-3 text-sm shadow-xs outline-none transition duration-180 placeholder:text-muted-foreground/70 hover:border-white/20 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}
