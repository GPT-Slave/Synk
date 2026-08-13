const RECOVERY_TIMESTAMP_KEY = "synk:deployment-recovery-at";
const RECOVERY_COOLDOWN_MS = 60_000;

const DEPLOYMENT_ASSET_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Failed to load module script/i,
  /Failed to load CSS chunk/i,
  /CSS_CHUNK_LOAD_FAILED/i,
];

export function isDeploymentAssetError(error: unknown): boolean {
  return deploymentErrorText(error).some((text) =>
    DEPLOYMENT_ASSET_ERROR_PATTERNS.some((pattern) => pattern.test(text)),
  );
}

export async function recoverFromDeploymentAssetError(
  error: unknown,
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !isDeploymentAssetError(error) ||
    !reserveRecoveryAttempt()
  ) {
    return false;
  }

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    } catch {
      // A hard reload can still recover a version-skewed client when the
      // service-worker update check itself is unavailable.
    }
  }

  window.location.reload();
  return true;
}

function reserveRecoveryAttempt(): boolean {
  try {
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(RECOVERY_TIMESTAMP_KEY));
    if (Number.isFinite(previous) && now - previous < RECOVERY_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(RECOVERY_TIMESTAMP_KEY, String(now));
    return true;
  } catch {
    // Do not risk an unbounded reload loop when storage is unavailable.
    return false;
  }
}

function deploymentErrorText(error: unknown): string[] {
  const texts: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; current != null && depth < 4; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);

    if (current instanceof Error) {
      texts.push(current.name, current.message, current.stack ?? "");
      current = current.cause;
      continue;
    }

    if (typeof current === "string") {
      texts.push(current);
    }
    break;
  }

  return texts;
}
