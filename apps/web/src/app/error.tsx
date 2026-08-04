"use client";

import { useEffect } from "react";
import { StatePanel } from "@/components/ui/state-panel";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center px-5">
      <StatePanel
        className="w-full max-w-lg"
        description="Synk hit an unexpected problem. Your saved data is safe; retry the page to continue."
        kind="error"
        onRetry={unstable_retry}
        title="Something went wrong"
      />
    </main>
  );
}
