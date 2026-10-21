/* Ranna service worker: shows "your order is ready" pushes and opens the order on tap.
 * It deliberately caches nothing: order pages must always be live. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Ranna";
  const url =
    typeof data.url === "string" && data.url.startsWith(self.location.origin) ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "ranna",
      // Same tag replaces the earlier notification; renotify makes it ring and buzz again.
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 800],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const target = new URL(url, self.location.origin);
      // "/o/<token>" identifies the order whatever the language prefix.
      const order = target.pathname.match(/\/o\/[A-Za-z0-9_-]+/);
      for (const client of windows) {
        if (order && new URL(client.url).pathname.includes(order[0])) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
