/**
 * The server sends an HTTP request to every push endpoint a customer registers, so an endpoint
 * is only accepted when it is HTTPS on a known browser push service. Anything else (an internal
 * address, a random site) would turn "subscribe" into a request-forgery primitive.
 */
const PUSH_HOSTS: (string | RegExp)[] = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Samsung Internet, Opera, Android browsers
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari / iOS Home Screen apps
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/, // legacy Edge / Windows
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => (typeof h === "string" ? host === h : h.test(host)));
}
