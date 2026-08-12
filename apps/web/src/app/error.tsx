"use client";

import { useEffect } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { recoverFromDeploymentAssetError } from "@/lib/deployment-recovery";
import { useI18n } from "@/lib/i18n";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
    void recoverFromDeploymentAssetError(error);
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center px-5">
      <StatePanel
        className="w-full max-w-lg"
        description={t(
          "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.",
        )}
        kind="error"
        onRetry={unstable_retry}
        title={t("Something went wrong")}
      />
    </main>
  );
}
