import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateKind = "empty" | "error" | "loading";

export function StatePanel({
  action,
  className,
  description,
  icon,
  kind = "empty",
  onRetry,
  title,
}: {
  action?: React.ReactNode;
  className?: string;
  description: string;
  icon?: React.ReactNode;
  kind?: StateKind;
  onRetry?: () => void;
  title: string;
}) {
  const fallbackIcon = {
    empty: <Inbox />,
    error: <AlertTriangle />,
    loading: <LoaderCircle className="animate-spin" />,
  }[kind];

  return (
    <div
      aria-live={kind === "loading" ? "polite" : undefined}
      className={cn(
        "grid min-h-40 place-items-center rounded-lg border border-dashed border-white/12 bg-white/[0.018] px-5 py-8 text-center",
        kind === "error" && "border-destructive/30 bg-destructive/[0.05]",
        className,
      )}
      role={
        kind === "error" ? "alert" : kind === "loading" ? "status" : undefined
      }
    >
      <div className="max-w-sm">
        <span
          className={cn(
            "mx-auto grid size-10 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-5",
            kind === "error" && "bg-destructive/10 text-destructive",
          )}
        >
          {icon ?? fallbackIcon}
        </span>
        <p className="mt-4 text-sm font-medium">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {onRetry && (
          <Button
            className="mt-5"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
