// Service worker — Web Push (WS2.1). Recebe o push e mostra a notificação;
// o clique foca uma aba aberta do app (navegando pra URL) ou abre uma nova.
//
// A cobrança de escala (migration 0045) manda BOTÕES: "Confirmo" resolve aqui
// mesmo, com o app fechado (POST autenticado pelo cookie de sessão, que o fetch
// do SW carrega), e "Não posso" abre o app já na pergunta — recusar exige um
// motivo de 3+ letras, que é o que deixa o líder remanejar.
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
    data: { url: data.url || "/inicio", ...(data.meta || {}) },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    // iOS ignora `actions` silenciosamente; o toque no corpo continua abrindo o app
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function abrir(url) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
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
  });
}

self.addEventListener("notificationclick", (event) => {
  const dados = event.notification.data || {};
  const url = dados.url || "/inicio";
  const assignmentId = dados.assignmentId;
  event.notification.close();

  // "Não posso": precisa do motivo, então abre o app já na pergunta.
  if (event.action === "recusar" && assignmentId) {
    event.waitUntil(abrir(`/inicio?responder=${assignmentId}`));
    return;
  }

  // "Confirmo": resolve sem abrir o app. Se a sessão expirou (401), cai pro app.
  if (event.action === "confirmar" && assignmentId) {
    event.waitUntil(
      fetch("/api/escala/responder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      })
        .then((r) => {
          if (!r.ok) return abrir(url);
          return self.registration.showNotification("Presença confirmada 🙌", {
            body: "Valeu! A equipe já sabe que você vem.",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: `confirmado-${assignmentId}`,
          });
        })
        .catch(() => abrir(url)),
    );
    return;
  }

  event.waitUntil(abrir(url));
});
