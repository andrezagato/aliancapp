// Service worker — Web Push (WS2.1). Recebe o push e mostra a notificação;
// o clique foca uma aba aberta do app (navegando pra URL) ou abre uma nova.
//
// Sem botões de ação dentro da notificação, por dois motivos: iOS não suporta
// `actions` em web push (e a igreja é majoritariamente iPhone), e responder
// olhando a ESCALA é melhor que responder no escuro — a pessoa vê com quem vai
// servir e em que posição antes de aceitar. Então o toque leva pro culto.

// ATUALIZAÇÃO IMEDIATA. Sem `skipWaiting`, um sw.js novo instala e fica parado em
// `waiting` até TODAS as abas do app fecharem — e num PWA aberto pela tela de
// início do iPhone ninguém fecha, o app só suspende. Ou seja: qualquer conserto
// aqui poderia levar semanas pra virar o worker ativo no aparelho da igreja.
//
// É seguro NESTE worker porque ele não tem `fetch` nem `caches`: não existe a
// version skew clássica (página velha servida por cache velho + worker novo). O
// que ele faz são dois listeners, push e notificationclick, e trocar os dois na
// hora é exatamente o desejado.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// `claim()` é o par honesto do skipWaiting: as abas já abertas passam a ser
// controladas por este worker. Não é ele que faz o deep link funcionar — push e
// notificationclick chegam no worker ATIVO, controlando ou não, e o matchAll lá
// embaixo já usa `includeUncontrolled` —, mas deixa o estado previsível em vez de
// meia-boca.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
      // Preferir a aba que a pessoa estava usando. A ordem do `matchAll` é do
      // navegador, não promessa nenhuma: com duas abas do app abertas, pegar a
      // primeira que tivesse `focus` acertava a errada na cara dura.
      const client =
        clientsArr.find((c) => c.focused) ||
        clientsArr.find((c) => c.visibilityState === "visible") ||
        clientsArr.find((c) => "focus" in c);
      if (!client) return self.clients.openWindow(url);

      // `client.navigate()` devolve PROMISE, e com o app em segundo plano — o
      // caso normal no celular — ela REJEITA. O try/catch síncrono de antes não
      // pegava nada disso: a rejeição escapava, o `focus()` rodava igual e a aba
      // voltava na URL ANTIGA. O toque na notificação virava nada, de forma
      // intermitente, que é o pior jeito de um recurso falhar.
      //
      // Agora a rejeição tem plano B: o destino vai pela porta dos fundos e quem
      // já está montado na página (o ChatBubble, que mora no layout de (app))
      // abre a conversa sem trocar de URL. O `Promise.resolve().then(…)` também
      // embrulha um throw SÍNCRONO do navigate, então ele substitui o try/catch
      // antigo por inteiro.
      let entregue = false;
      return (
        Promise.resolve()
          .then(() => ("navigate" in client ? client.navigate(url) : null))
          .catch(() => {
            try {
              client.postMessage({ tipo: "abrir-chat", url: url });
              entregue = true;
            } catch (_e) {
              /* cliente morreu entre o matchAll e agora — nada a fazer */
            }
          })
          // Focar SEMPRE, tenha o navigate dado certo ou não: trazer o app pra
          // frente é metade do pedido, e é a metade que quase nunca falha. O
          // `navigate` resolve com o cliente (às vezes outro); na volta do catch
          // vem `undefined` e vale o de sempre.
          .then((navegado) => (navegado || client).focus())
          // Último recurso: nem navegou, nem focou. Só abre janela nova se a
          // mensagem também não tiver sido entregue — senão a pessoa ganharia
          // DUAS telas do app pelo mesmo toque.
          .catch(() => (entregue ? undefined : self.clients.openWindow(url)))
      );
    }),
  );
});
