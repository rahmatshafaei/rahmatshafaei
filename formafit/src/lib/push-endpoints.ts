/**
 * Push services used by current browsers (Chrome/Edge/Samsung/Opera via FCM, Firefox, Safari,
 * legacy Edge via WNS). The server only ever sends to these hosts, so a stored endpoint cannot
 * make it call anything else.
 */
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_SERVICE_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: string, extraHosts: readonly string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port !== "") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(host) || PUSH_SERVICE_SUFFIXES.some((s) => host.endsWith(s)) || extraHosts.includes(host);
}
