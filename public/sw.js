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

// Pergunta ao cliente se ELE consegue abrir, e espera a resposta.
//
// A versão anterior marcava "entregue" assim que o postMessage não lançava — ou
// seja, "eu postei", não "alguém tratou". E `client.postMessage` SEMPRE resolve:
// não existe do outro lado a promessa de que haja ouvinte. Com isso o último
// recurso (`openWindow`) era desarmado por uma entrega que podia nunca ter
// acontecido. O caso real: a cabine com /control aberto e em foco — o matchAll
// escolhe justamente essa aba, porque ela é a focada, e /control tem layout
// próprio, sem ChatBubble. O toque na notificação não fazia nada.
//
// Com a porta de resposta, "entregue" volta a significar o que a palavra diz.
// Os 500ms de prazo existem porque mensagem despachada durante o carregamento
// fica na fila e só chega no DOMContentLoaded, enquanto o ouvinte do React só
// existe depois da hidratação — sem prazo, uma aba nesse intervalo prenderia a
// decisão pra sempre.
function pedirAoCliente(client, url) {
  return new Promise((resolve) => {
    let respondeu = false;
    let canal;
    try {
      canal = new MessageChannel();
    } catch (_e) {
      resolve(false);
      return;
    }
    canal.port1.onmessage = (ev) => {
      respondeu = true;
      resolve(!!(ev.data && ev.data.ok));
    };
    try {
      client.postMessage({ tipo: "abrir-chat", url: url }, [canal.port2]);
    } catch (_e) {
      resolve(false);
      return;
    }
    setTimeout(() => {
      if (!respondeu) resolve(false);
    }, 500);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Preferir a aba que a pessoa estava usando. A ordem do `matchAll` é do
      // navegador, não promessa nenhuma: com duas abas do app abertas, pegar a
      // primeira que tivesse `focus` acertava a errada na cara dura.
      const client =
        clientsArr.find((c) => c.focused) ||
        clientsArr.find((c) => c.visibilityState === "visible") ||
        clientsArr.find((c) => "focus" in c);
      if (!client) return self.clients.openWindow(url);

      // `client.navigate()` devolve PROMISE, e com o app em segundo plano — o
      // caso normal no celular — ela REJEITA. O try/catch síncrono original não
      // pegava nada disso: a rejeição escapava, o `focus()` rodava igual e a aba
      // voltava na URL ANTIGA. O toque virava nada, de forma intermitente, que é
      // o pior jeito de um recurso falhar. O `await` dentro do try embrulha
      // rejeição E throw síncrono, então substitui o try/catch antigo inteiro.
      let navegado = null;
      let navegou = false;
      try {
        navegado = "navigate" in client ? await client.navigate(url) : null;
        navegou = true;
      } catch (_e) {
        navegou = false;
      }

      // Só vale o plano B se o navigate falhou. Quando ele deu certo, a página
      // já vai ler o parâmetro sozinha na montagem — mandar mensagem também
      // abriria a conversa duas vezes.
      const tratado = navegou ? true : await pedirAoCliente(client, url);

      // Focar SEMPRE: trazer o app pra frente é metade do pedido, e é a metade
      // que quase nunca falha.
      try {
        await (navegado || client).focus();
        if (tratado) return undefined;
      } catch (_e) {
        /* nem focou — cai no último recurso abaixo */
      }
      // Último recurso: ninguém tratou o destino. Abrir janela nova é melhor que
      // um toque que não fez nada.
      return tratado ? undefined : self.clients.openWindow(url);
    })(),
  );
});
