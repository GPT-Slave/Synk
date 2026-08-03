export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;

    const key = cookie.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }

  return undefined;
}
