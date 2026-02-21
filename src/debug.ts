let debugEnabled = false;

export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function debugLog(scope: string, message: string, meta?: unknown): void {
  if (!debugEnabled) {
    return;
  }

  const prefix = `[debug][${scope}] ${message}`;
  if (meta === undefined) {
    console.error(prefix);
    return;
  }

  console.error(prefix, meta);
}
