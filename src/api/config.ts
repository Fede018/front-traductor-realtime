const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

/** URL absoluta para un endpoint HTTP del backend. */
export function apiUrl(path: string): string {
  if (configuredBase) {
    return `${configuredBase}${path}`;
  }
  return path;
}

/** URL absoluta (ws/wss) para un endpoint WebSocket del backend. */
export function wsUrl(path: string): string {
  if (configuredBase) {
    return configuredBase.replace(/^http/, "ws") + path;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}
