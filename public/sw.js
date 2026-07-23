// Service worker — Web Push (WS2.1). Recebe o push e mostra a notificação;
// o clique foca uma aba aberta do app (navegando pra URL) ou abre uma nova.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }
  const title = data.title || "Servir";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/inicio" },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              client.navigate(url);
            } catch (_e) {
              /* mesma origem apenas; ignora */
            }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
