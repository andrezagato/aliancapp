#!/usr/bin/env node
"use strict";

/**
 * PONTE SIRVO → PROPRESENTER 7.6.1
 *
 * Por que isto existe como programa separado, e não como um botão no app:
 * o Sirvo roda na Vercel (HTTPS, na internet) e o ProPresenter escuta HTTP/WS
 * dentro da rede da igreja. Navegador não fala `http://` da LAN de dentro de
 * página `https://` (mixed content), e a Vercel não tem rota pra dentro da
 * igreja — nem queremos que tenha. Então quem faz a costura é este processo,
 * rodando NA máquina do ProPresenter, falando com `127.0.0.1`.
 *
 * O que ele faz, em uma frase: quando um bloco novo do roteiro fica ao vivo,
 * ele escreve a duração planejada do bloco num timer do ProPresenter e dá
 * start. Nada mais.
 *
 * Duas decisões que valem explicar:
 *
 * 1. ZERO DEPENDÊNCIA. É um arquivo só, com `node` e nada mais. Sem
 *    `node_modules` pra copiar, sem `npm install` num PC de sala de controle.
 *    Por isso o cliente WebSocket é escrito à mão aqui embaixo (e há um motivo
 *    técnico extra: o Pro7 exige os cabeçalhos `Sec-WebSocket-Key` e
 *    `Sec-WebSocket-Version` em CamelCase, violando a própria HTTP; escrevendo
 *    o handshake à mão eu controlo isso) e a leitura do banco é por HTTP puro
 *    (PostgREST) em vez do SDK do Supabase.
 *
 * 2. ELE É DESCARTÁVEL. Se cair, se você fechar a janela, se a internet sumir,
 *    o roteiro do Sirvo continua funcionando exatamente como hoje. Nada no app
 *    depende desta ponte. E ela só mexe no timer que você configurar — nunca
 *    para um timer que não foi ela quem começou (a contagem de pré-culto que o
 *    operador põe na mão fica intocada).
 *
 * A documentação do protocolo da 7.6 é reversa e avisa que mensagem inválida
 * DERRUBA o ProPresenter. Por isso aqui só existem quatro mensagens, todas de
 * forma fixa: authenticate, clockRequest, clockUpdate, clockStop/Reset/Start.
 *
 * Modos:
 *   node ponte.js                 roda ao vivo
 *   node ponte.js --diagnosticar  testa tudo e lista os timers do ProPresenter
 *   node ponte.js --testar 5      aplica 5 minutos no timer e inicia (ensaio)
 *   node ponte.js --seco          roda ao vivo, mas só escreve o que FARIA
 */

const crypto = require("node:crypto");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = __dirname;
const ARQ_CONFIG = path.join(RAIZ, "config.json");
const ARQ_LOG = path.join(RAIZ, "ponte.log");

// ---------------------------------------------------------------- log

const hhmmss = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function log(...partes) {
  const linha = `[${hhmmss.format(new Date())}] ${partes.join(" ")}`;
  console.log(linha);
  try {
    fs.appendFileSync(ARQ_LOG, linha + "\n");
  } catch {
    /* log é conveniência, nunca motivo pra derrubar a ponte */
  }
}

const morrer = (msg) => {
  log("ERRO:", msg);
  process.exit(1);
};

// ---------------------------------------------------------------- config

function lerConfig({ exigePro = true } = {}) {
  if (!fs.existsSync(ARQ_CONFIG)) {
    morrer(
      `não achei ${ARQ_CONFIG}\n\n` +
        "Copie config.example.json para config.json e preencha. Veja LEIA-ME.md.",
    );
  }
  let c;
  try {
    c = JSON.parse(fs.readFileSync(ARQ_CONFIG, "utf8"));
  } catch (e) {
    morrer(`config.json não é um JSON válido: ${e.message}`);
  }
  const falta = [];
  if (!c.supabaseUrl) falta.push("supabaseUrl");
  if (!c.supabaseAnonKey) falta.push("supabaseAnonKey");
  if (!c.email) falta.push("email");
  if (!c.senha) falta.push("senha");
  if (!c.proPresenter && exigePro) falta.push("proPresenter");
  if (falta.length) morrer(`config.json sem: ${falta.join(", ")}`);

  const pp = (c.proPresenter = c.proPresenter || {});
  if (!pp.host) pp.host = "127.0.0.1";
  c.supabaseUrl = String(c.supabaseUrl).replace(/\/+$/, "");
  c.pollAoVivoMs = c.pollAoVivoMs || 1000;
  c.pollParadoMs = c.pollParadoMs || 10000;

  // No ensaio seco e no diagnóstico a ponte tolera config incompleta do
  // ProPresenter — que é justamente o que você ainda não tem em mãos hoje.
  if (!exigePro) return c;

  if (!pp.porta) morrer("proPresenter.porta é obrigatória (Preferências → Rede do ProPresenter)");
  if (typeof pp.senha !== "string") morrer("proPresenter.senha é obrigatória (pode ser \"\" se não houver)");
  if (pp.timerIndice == null && !pp.timerNome) {
    morrer("informe proPresenter.timerIndice OU proPresenter.timerNome");
  }
  if (pp.renomearTimer && pp.timerIndice == null) {
    morrer(
      "com renomearTimer=true é obrigatório fixar proPresenter.timerIndice — " +
        "senão, depois de renomear, a ponte não acha mais o timer pelo nome.",
    );
  }
  return c;
}

// ---------------------------------------------------------------- websocket à mão

/**
 * Cliente WebSocket mínimo (RFC 6455, só o que o Pro7 usa): handshake com
 * cabeçalhos em CamelCase, frames de texto mascarados na ida, leitura com
 * remontagem de fragmento, resposta a ping. Não faz TLS — é LAN.
 */
class SoquetePro {
  constructor({ host, porta, caminho = "/remote" }) {
    this.host = host;
    this.porta = porta;
    this.caminho = caminho;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.pedaco = null; // acumulador de frame fragmentado
    this.aoTexto = () => {};
    this.aoFechar = () => {};
  }

  conectar() {
    return new Promise((ok, falha) => {
      const chave = crypto.randomBytes(16).toString("base64");
      const sock = net.connect({ host: this.host, port: this.porta });
      this.sock = sock;
      let cabecalhoLido = false;
      let cru = Buffer.alloc(0);

      const limpar = () => {
        sock.removeAllListeners("data");
        sock.removeAllListeners("error");
      };

      sock.setTimeout(8000, () => {
        sock.destroy(new Error("timeout conectando no ProPresenter"));
      });

      sock.on("connect", () => {
        sock.setTimeout(0);
        sock.write(
          [
            `GET ${this.caminho} HTTP/1.1`,
            `Host: ${this.host}:${this.porta}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            // CamelCase de propósito: o Pro7 exige assim (a doc reversa é
            // explícita que isso viola a HTTP, mas "é o que é").
            `Sec-WebSocket-Key: ${chave}`,
            "Sec-WebSocket-Version: 13",
            "",
            "",
          ].join("\r\n"),
        );
      });

      sock.on("error", (e) => {
        if (!cabecalhoLido) falha(e);
        else this.aoFechar(e);
      });

      sock.on("close", () => {
        if (cabecalhoLido) this.aoFechar(new Error("conexão fechada"));
      });

      sock.on("data", (d) => {
        if (cabecalhoLido) {
          this.buf = Buffer.concat([this.buf, d]);
          this._digerir();
          return;
        }
        cru = Buffer.concat([cru, d]);
        const fim = cru.indexOf("\r\n\r\n");
        if (fim === -1) return;
        const cabeca = cru.subarray(0, fim).toString("latin1");
        if (!/^HTTP\/1\.1 101/i.test(cabeca)) {
          limpar();
          sock.destroy();
          falha(new Error(`ProPresenter recusou o upgrade:\n${cabeca.split("\r\n")[0]}`));
          return;
        }
        cabecalhoLido = true;
        // O que veio depois do cabeçalho já é frame — não pode ser descartado.
        this.buf = cru.subarray(fim + 4);
        this._digerir();
        ok();
      });
    });
  }

  _digerir() {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fim = (b[0] & 0x80) !== 0;
      const op = b[0] & 0x0f;
      const mascarado = (b[1] & 0x80) !== 0;
      let tam = b[1] & 0x7f;
      let off = 2;
      if (tam === 126) {
        if (b.length < 4) return;
        tam = b.readUInt16BE(2);
        off = 4;
      } else if (tam === 127) {
        if (b.length < 10) return;
        const grande = b.readBigUInt64BE(2);
        if (grande > 8_000_000n) {
          // Nada que o Pro7 manda chega perto disso. Se chegou, o fluxo
          // dessincronizou — melhor cair e reconectar que interpretar lixo.
          this.sock.destroy(new Error("frame absurdo, fluxo dessincronizado"));
          return;
        }
        tam = Number(grande);
        off = 10;
      }
      if (mascarado) off += 4;
      if (b.length < off + tam) return;

      let corpo = b.subarray(off, off + tam);
      if (mascarado) {
        const m = b.subarray(off - 4, off);
        const c = Buffer.from(corpo);
        for (let i = 0; i < c.length; i++) c[i] ^= m[i % 4];
        corpo = c;
      }
      this.buf = b.subarray(off + tam);

      if (op === 0x8) {
        this.sock.end();
        return;
      }
      if (op === 0x9) {
        this._frame(0xa, corpo); // pong
        continue;
      }
      if (op === 0xa) continue;

      if (op === 0x0) {
        this.pedaco = this.pedaco ? Buffer.concat([this.pedaco, corpo]) : corpo;
      } else if (op === 0x1 || op === 0x2) {
        this.pedaco = corpo;
      } else {
        continue;
      }
      if (fim && this.pedaco) {
        const txt = this.pedaco.toString("utf8");
        this.pedaco = null;
        try {
          this.aoTexto(JSON.parse(txt));
        } catch {
          log("aviso: mensagem do ProPresenter que não é JSON:", txt.slice(0, 120));
        }
      }
    }
  }

  _frame(op, dados) {
    const mask = crypto.randomBytes(4);
    let cabeca;
    if (dados.length < 126) {
      cabeca = Buffer.from([0x80 | op, 0x80 | dados.length]);
    } else if (dados.length < 65536) {
      cabeca = Buffer.alloc(4);
      cabeca[0] = 0x80 | op;
      cabeca[1] = 0x80 | 126;
      cabeca.writeUInt16BE(dados.length, 2);
    } else {
      cabeca = Buffer.alloc(10);
      cabeca[0] = 0x80 | op;
      cabeca[1] = 0x80 | 127;
      cabeca.writeBigUInt64BE(BigInt(dados.length), 2);
    }
    const corpo = Buffer.from(dados);
    for (let i = 0; i < corpo.length; i++) corpo[i] ^= mask[i % 4];
    if (this.sock && !this.sock.destroyed) {
      this.sock.write(Buffer.concat([cabeca, mask, corpo]));
    }
  }

  enviarJson(obj) {
    this._frame(0x1, Buffer.from(JSON.stringify(obj), "utf8"));
  }

  fechar() {
    if (this.sock && !this.sock.destroyed) {
      this._frame(0x8, Buffer.alloc(0));
      this.sock.end();
    }
  }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** O Pro7 manda booleanos como 0/1 e (às vezes, herança do Pro6) como "0"/"1". */
const verdade = (v) => v === true || v === 1 || v === "1";

// ---------------------------------------------------------------- driver ProPresenter 7.6

/** Duração em segundos → "HH:MM:SS", como o clockUpdate espera. */
function hms(segundos) {
  const s = Math.max(0, Math.round(segundos));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

class DriverPro76 {
  constructor(cfg) {
    this.cfg = cfg;
    this.pp = cfg.proPresenter;
    this.ws = null;
    this.pronto = false;
    this.indice = this.pp.timerIndice ?? null;
    this.ehControlador = null;
    this.relogios = [];
    this.reconectando = false;
    this.espiao = null; // usado só pelo --diagnosticar
  }

  async ligar() {
    this.ws = new SoquetePro({ host: this.pp.host, porta: this.pp.porta, caminho: "/remote" });
    this.ws.aoTexto = (m) => this._receber(m);
    this.ws.aoFechar = () => {
      if (!this.pronto) return;
      this.pronto = false;
      log("ProPresenter: conexão caiu — vou reconectar");
      this._reconectar();
    };

    await this.ws.conectar();

    const autenticado = new Promise((ok, falha) => {
      const t = setTimeout(() => falha(new Error("ProPresenter não respondeu o authenticate em 8s")), 8000);
      this._resolverAuth = (m) => {
        clearTimeout(t);
        if (!verdade(m.authenticated)) falha(new Error(`ProPresenter recusou a senha: ${m.error || "(sem detalhe)"}`));
        else ok(m);
      };
    });

    this.ws.enviarJson({ action: "authenticate", protocol: 701, password: this.pp.senha });
    const m = await autenticado;
    this.ehControlador = verdade(m.controller);
    this.pronto = true;
    const versao = [m.majorVersion, m.minorVersion, m.patchVersion].filter((n) => n != null).join(".");
    log(
      `ProPresenter${versao ? ` ${versao}` : ""}: autenticado em ${this.pp.host}:${this.pp.porta}` +
        (this.ehControlador ? " (controlador)" : " — ATENÇÃO: sem permissão de controle, só observador"),
    );
    if (!this.ehControlador) {
      log("   → use a senha de CONTROLE (controller) em Preferências → Rede, não a de observador.");
    }

    await this.lerRelogios();
    if (this.pp.timerIndice == null) this._resolverIndicePorNome();
  }

  _receber(m) {
    if (this.espiao) this.espiao(m);
    if (m.action === "authenticate" && this._resolverAuth) {
      const f = this._resolverAuth;
      this._resolverAuth = null;
      f(m);
      return;
    }
    if (m.action === "clockRequest" && Array.isArray(m.clockInfo)) {
      this.relogios = m.clockInfo;
      if (this._resolverRelogios) {
        const f = this._resolverRelogios;
        this._resolverRelogios = null;
        f(m.clockInfo);
      }
    }
  }

  /** clockRequest devolve a lista de timers; é daí que sai o índice. */
  lerRelogios() {
    const p = new Promise((ok) => {
      this._resolverRelogios = ok;
      setTimeout(() => {
        if (this._resolverRelogios) {
          this._resolverRelogios = null;
          ok(this.relogios);
        }
      }, 4000);
    });
    this.ws.enviarJson({ action: "clockRequest" });
    return p;
  }

  _resolverIndicePorNome() {
    const alvo = String(this.pp.timerNome).trim().toLowerCase();
    const i = this.relogios.findIndex((c) => String(c.clockName ?? "").trim().toLowerCase() === alvo);
    if (i === -1) {
      const nomes = this.relogios.map((c, n) => `${n}: ${c.clockName ?? "(sem nome)"}`).join(" | ") || "(nenhum)";
      const recado =
        `não achei um timer chamado "${this.pp.timerNome}" no ProPresenter.\n` +
        `Timers existentes → ${nomes}\n` +
        "Crie um timer de contagem regressiva com esse nome, ou fixe proPresenter.timerIndice no config.json.";
      // Se já tínhamos resolvido antes, isto é uma reconexão no meio do culto:
      // reclamar e seguir com o índice velho é MUITO melhor que morrer no ar.
      if (this.indice != null) {
        log(`aviso: ${recado.split("\n")[0]} Sigo com o índice ${this.indice}.`);
        return;
      }
      morrer(recado);
    }
    this.indice = i;
    log(`ProPresenter: timer "${this.relogios[i].clockName}" resolvido no índice ${i}`);
  }

  async _reconectar() {
    if (this.reconectando) return;
    this.reconectando = true;
    for (let tentativa = 1; ; tentativa++) {
      const atraso = Math.min(30000, 2000 * tentativa);
      await espera(atraso);
      try {
        await this.ligar();
        this.reconectando = false;
        return;
      } catch (e) {
        log(`ProPresenter: falhou reconectar (tentativa ${tentativa}): ${e.message}`);
      }
    }
  }

  /**
   * O coração: escreve a duração no timer e dá start.
   *
   * DUAS DESCOBERTAS DURAS, medidas contra a 7.6.1 de verdade (04/ago/2026,
   * modo `--sonda`), porque a documentação reversa erra as duas:
   *
   * 1. O `clockUpdate` tem que ser o ECO DO OBJETO INTEIRO que o próprio
   *    ProPresenter reportou no `clockRequest`, trocando só a duração. Ele
   *    decodifica a mensagem numa estrutura rígida e, se faltar QUALQUER campo
   *    — inclusive o `clockFormat` aninhado e o `clockState` —, descarta tudo
   *    calado: sem erro, sem resposta, e o timer segue com a duração velha.
   *    Foram 6 variantes ignoradas antes desta (só `clockTime`, só
   *    `clockDuration`, os dois, payload mínimo, `clockEndTime`, com
   *    milissegundos). Por isso o estado é RELIDO a cada bloco em vez de
   *    montado à mão: se alguém mexer no formato do relógio na interface, o eco
   *    continua certo.
   * 2. Os campos que a doc jura obrigatórios — `clockIsPM` e
   *    `clockElapsedTime` — NÃO existem no que ele reporta, e a única variante
   *    que funciona é justamente a que não os manda. Não os reintroduza.
   *
   * A ordem também importa: `clockUpdate` sozinho não reseta o valor corrente,
   * então é parar → reescrever → resetar → iniciar. Confirmado na sonda que o
   * `clockReset` PRESERVA a duração nova. Os intervalos existem porque o Pro7
   * não responde ao clockUpdate — não há o que aguardar, só dar tempo dele
   * processar.
   */
  async aplicar({ nome, segundos }) {
    if (!this.pronto) {
      log("ProPresenter: sem conexão — pulei este bloco (vou tentar no próximo)");
      return false;
    }
    if (this.indice == null) {
      log("ProPresenter: sem índice de timer — nada a fazer");
      return false;
    }
    const idx = this.indice;

    this.ws.enviarJson({ action: "clockStop", clockIndex: idx });
    await espera(150);

    // Releitura: é daqui que sai o objeto a ecoar (ver nota 1 acima).
    await this.lerRelogios();
    const base = this.relogios[idx];
    if (!base) {
      log(`ProPresenter: o timer ${idx} não veio no clockRequest — não vou mandar update às cegas`);
      return false;
    }

    const duracao = hms(segundos);
    this.ws.enviarJson({
      ...base,
      action: "clockUpdate",
      clockIndex: idx,
      clockType: 0, // 0 = contagem regressiva
      clockDuration: duracao,
      clockTime: duracao,
      clockOverrun: this.pp.overrun === undefined ? base.clockOverrun : Boolean(this.pp.overrun),
      clockName: this.pp.renomearTimer ? nome : (base.clockName ?? this.pp.timerNome ?? "Timer"),
    });
    await espera(150);
    this.ws.enviarJson({ action: "clockReset", clockIndex: idx });
    await espera(150);
    this.ws.enviarJson({ action: "clockStart", clockIndex: idx });
    return true;
  }

  async parar() {
    if (!this.pronto || this.indice == null) return;
    this.ws.enviarJson({ action: "clockStop", clockIndex: this.indice });
  }

  fechar() {
    this.pronto = false;
    if (this.ws) this.ws.fechar();
  }
}

/** Driver de mentira, pro modo --seco: escreve no log em vez de falar com o telão. */
class DriverSeco {
  constructor() {
    this.indice = "(seco)";
    this.pronto = true;
  }
  async ligar() {
    log("MODO SECO: não vou tocar no ProPresenter, só registrar o que faria.");
  }
  async aplicar({ nome, segundos }) {
    log(`SECO → aplicaria ${hms(segundos)} no timer e daria start (bloco "${nome}")`);
    return true;
  }
  async parar() {
    log("SECO → pararia o timer");
  }
  fechar() {}
}

// ---------------------------------------------------------------- Supabase por HTTP puro

class Banco {
  constructor(cfg) {
    this.cfg = cfg;
    this.token = null;
    this.refresh = null;
    this.expira = 0;
    this.uid = null;
    this.churchId = null;
  }

  async _auth(caminho, corpo) {
    const r = await fetch(`${this.cfg.supabaseUrl}/auth/v1/token?grant_type=${caminho}`, {
      method: "POST",
      headers: { apikey: this.cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`login falhou (${r.status}): ${j.error_description || j.msg || j.error || "?"}`);
    this.token = j.access_token;
    this.refresh = j.refresh_token;
    this.expira = Date.now() + (j.expires_in ?? 3600) * 1000;
    this.uid = j.user?.id ?? this.uid;
    return j;
  }

  async entrar() {
    await this._auth("password", { email: this.cfg.email, password: this.cfg.senha });
    const perfil = await this.consultar(`profiles?select=church_id,nickname,full_name&id=eq.${this.uid}`);
    if (!perfil.length) throw new Error("a conta logou mas não tem perfil visível (RLS)");
    this.churchId = perfil[0].church_id;
    if (!this.churchId) throw new Error("a conta logou mas está sem igreja (church_id nulo) — destrave em Equipes");
    log(`Sirvo: logado como ${perfil[0].nickname || perfil[0].full_name || this.cfg.email}`);
  }

  async _garantirToken() {
    if (Date.now() < this.expira - 60_000) return;
    await this._auth("refresh_token", { refresh_token: this.refresh });
  }

  async consultar(query) {
    await this._garantirToken();
    const r = await fetch(`${this.cfg.supabaseUrl}/rest/v1/${query}`, {
      headers: {
        apikey: this.cfg.supabaseAnonKey,
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    });
    if (!r.ok) throw new Error(`consulta falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  /** O culto que está AO VIVO agora: roteiro iniciado e não encerrado. */
  async cultoAoVivo() {
    const q =
      "events?select=id,title,starts_at,rundown_started_at" +
      `&church_id=eq.${this.churchId}` +
      "&rundown_started_at=not.is.null&rundown_ended_at=is.null" +
      "&order=rundown_started_at.desc&limit=1";
    const r = await this.consultar(q);
    return r[0] ?? null;
  }

  async blocos(eventId) {
    return this.consultar(
      `event_rundown?select=id,sort_order,title,duration_min,done_at&event_id=eq.${eventId}&order=sort_order.asc`,
    );
  }
}

// ---------------------------------------------------------------- laço principal

/**
 * O bloco ao vivo é DERIVADO, igual no app (src/components/rundown-timing.ts):
 * é o primeiro sem `done_at`, enquanto o roteiro está iniciado e não encerrado.
 * Nenhuma coluna nova, nenhuma mudança no Sirvo — a ponte só lê.
 */
function blocoAoVivo(blocos) {
  return blocos.find((b) => !b.done_at) ?? null;
}

async function rodar(cfg, driver) {
  const banco = new Banco(cfg);
  await banco.entrar();
  await driver.ligar();

  // A chave é (culto, bloco). Duração de propósito FORA dela: se alguém
  // ajustar a duração do bloco que já está no ar, não queremos reiniciar o
  // cronômetro do telão no meio da pregação.
  let chaveAplicada = null;
  let nossoTimerRodando = false;
  let erroSeguido = 0;

  log("Ponte no ar. Esperando um roteiro começar. (Ctrl+C encerra; nada no app depende disso.)");

  for (;;) {
    let intervalo = cfg.pollParadoMs;
    try {
      const culto = await banco.cultoAoVivo();

      if (!culto) {
        if (nossoTimerRodando) {
          log("Roteiro encerrado — parando o timer.");
          await driver.parar();
          nossoTimerRodando = false;
        }
        chaveAplicada = null;
      } else {
        intervalo = cfg.pollAoVivoMs;
        const blocos = await banco.blocos(culto.id);
        const bloco = blocoAoVivo(blocos);

        if (!bloco) {
          // Todos os blocos encerrados, mas o culto ainda não foi finalizado.
          if (nossoTimerRodando) {
            log("Último bloco encerrado — parando o timer.");
            await driver.parar();
            nossoTimerRodando = false;
          }
          chaveAplicada = `${culto.id}:fim`;
        } else {
          const chave = `${culto.id}:${bloco.id}`;
          if (chave !== chaveAplicada) {
            const segundos = Math.max(0, Math.round((bloco.duration_min || 0) * 60));
            const ok = await driver.aplicar({ nome: bloco.title || "Bloco", segundos });
            if (ok) {
              chaveAplicada = chave;
              nossoTimerRodando = true;
              log(`▶ "${bloco.title}" — ${hms(segundos)} no telão`);
            }
          }
        }
      }
      erroSeguido = 0;
    } catch (e) {
      erroSeguido++;
      // Rede de igreja oscila. Isso não é motivo pra derrubar a ponte no meio
      // do culto: loga, respira e tenta de novo, com o intervalo crescendo.
      log(`falha na leitura (${erroSeguido}ª): ${e.message}`);
      intervalo = Math.min(30000, 2000 * erroSeguido);
    }
    await espera(intervalo);
  }
}

// ---------------------------------------------------------------- diagnóstico

async function diagnosticar(cfg) {
  console.log("\n=== 1/3 · config.json ===");
  console.log(`Supabase : ${cfg.supabaseUrl}`);
  console.log(`Conta    : ${cfg.email}`);
  console.log(`PP       : ${cfg.proPresenter.host}:${cfg.proPresenter.porta ?? "(porta não preenchida)"}`);
  console.log(
    "Timer    : " +
      (cfg.proPresenter.timerIndice != null
        ? `índice ${cfg.proPresenter.timerIndice}`
        : cfg.proPresenter.timerNome
          ? `nome "${cfg.proPresenter.timerNome}"`
          : "(não preenchido)"),
  );

  console.log("\n=== 2/3 · Sirvo (Supabase) ===");
  const banco = new Banco(cfg);
  try {
    await banco.entrar();
    const culto = await banco.cultoAoVivo();
    if (!culto) {
      console.log("Nenhum roteiro ao vivo agora — normal fora do culto.");
    } else {
      console.log(`Culto ao vivo: ${culto.title || culto.id} (iniciado ${culto.rundown_started_at})`);
      const blocos = await banco.blocos(culto.id);
      const b = blocoAoVivo(blocos);
      console.log(`Blocos: ${blocos.length} · ao vivo agora: ${b ? `"${b.title}" (${b.duration_min} min)` : "nenhum"}`);
    }
    console.log("OK.");
  } catch (e) {
    console.log(`FALHOU: ${e.message}`);
  }

  console.log("\n=== 3/3 · ProPresenter ===");
  if (!cfg.proPresenter.porta) {
    console.log("Porta do ProPresenter ainda não preenchida no config.json — pulei este passo.");
    console.log("(Normal se você está só testando o lado do Sirvo, longe da máquina do ProPresenter.)\n");
    process.exit(0);
  }
  const pp = new DriverPro76(cfg);
  // Em diagnóstico eu quero o índice mesmo que o nome não exista, então
  // resolvo à mão depois de listar, em vez de deixar o ligar() morrer.
  const nomeSalvo = pp.pp.timerNome;
  pp.pp.timerNome = undefined;
  pp.pp.timerIndice = pp.pp.timerIndice ?? -1;
  try {
    await pp.ligar();
    const relogios = pp.relogios;
    if (!relogios.length) {
      console.log("Conectou, mas o ProPresenter não devolveu nenhum timer.");
      console.log("→ Crie um timer de contagem regressiva no ProPresenter e rode de novo.");
    } else {
      console.log(`\n${relogios.length} timer(s) — use o ÍNDICE da primeira coluna no config.json:\n`);
      const tipo = { 0: "regressiva", 1: "até horário", 2: "corrido" };
      relogios.forEach((c, i) => {
        const nome = c.clockName ?? "(sem nome)";
        const marca = nomeSalvo && nome.trim().toLowerCase() === String(nomeSalvo).trim().toLowerCase() ? "  ← é este" : "";
        console.log(
          `  [${i}] ${nome.padEnd(24)} tipo=${tipo[c.clockType] ?? c.clockType}` +
            `  duração=${c.clockDuration ?? c.clockTime ?? "?"}  rodando=${verdade(c.clockState) ? "sim" : "não"}${marca}`,
        );
      });
      console.log("");
      if (nomeSalvo && !relogios.some((c) => String(c.clockName ?? "").trim().toLowerCase() === String(nomeSalvo).trim().toLowerCase())) {
        console.log(`ATENÇÃO: nenhum timer se chama "${nomeSalvo}". Crie-o ou troque pra timerIndice.`);
      }
    }
    console.log("Resposta crua do clockRequest (guarde isto se algo estranhar):");
    console.log(JSON.stringify(relogios).slice(0, 1500));
  } catch (e) {
    console.log(`FALHOU: ${e.message}`);
    console.log("\nChecar no PC do ProPresenter:");
    console.log("  · Preferências → Rede: 'Habilitar rede' ligado?");
    console.log("  · A porta do config.json é a mesma que aparece lá?");
    console.log("  · A senha é a de CONTROLE (controller), não a de observador?");
  } finally {
    pp.fechar();
  }
  console.log("");
  process.exit(0);
}

/**
 * SONDA DO clockUpdate — descobre qual formato a 7.6.1 real aceita.
 *
 * Existe porque no ProPresenter 7.6.1 de produção o `clockStart` obedece mas a
 * escrita da duração é ignorada em silêncio: o timer inicia com o valor que já
 * estava salvo. Como o protocolo é reverso e não há resposta pro clockUpdate
 * (nem erro), o único jeito de saber é tentar cada forma plausível e LER o
 * estado depois de cada uma. Cada variante usa uma duração diferente, então o
 * valor lido denuncia qual delas pegou.
 */
async function sondar(cfg) {
  const pp = new DriverPro76(cfg);
  await pp.ligar();
  const idx = pp.indice;
  const atual = pp.relogios[idx] ?? {};
  const nome = atual.clockName ?? "BLOCO";

  const variantes = [
    {
      rotulo: "V1 clockTime (o que eu mando hoje)",
      alvo: "00:03:00",
      msg: { clockTime: "00:03:00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockElapsedTime: "00:00:00" },
    },
    {
      rotulo: "V2 clockDuration no lugar de clockTime",
      alvo: "00:04:00",
      msg: { clockDuration: "00:04:00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockElapsedTime: "00:00:00" },
    },
    {
      rotulo: "V3 clockTime + clockDuration juntos",
      alvo: "00:06:00",
      msg: { clockTime: "00:06:00", clockDuration: "00:06:00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockElapsedTime: "00:00:00" },
    },
    {
      rotulo: "V4 mínimo (só type + clockTime)",
      alvo: "00:07:00",
      msg: { clockTime: "00:07:00" },
    },
    {
      rotulo: "V5 clockEndTime em vez de Elapsed",
      alvo: "00:08:00",
      msg: { clockTime: "00:08:00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockEndTime: "00:00:00" },
    },
    {
      rotulo: "V6 com milissegundos (.00)",
      alvo: "00:02:00",
      msg: { clockTime: "00:02:00.00", clockDuration: "00:02:00.00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockElapsedTime: "00:00:00.00" },
    },
    {
      // O ProPresenter pode estar decodificando o JSON num objeto rígido e
      // descartando a mensagem inteira quando falta campo. Aqui eu devolvo
      // EXATAMENTE a forma que ele mesmo reportou, só trocando a duração.
      rotulo: "V7 eco do objeto que ele reportou",
      alvo: "00:09:00",
      msg: { ...atual, clockTime: "00:09:00", clockDuration: "00:09:00" },
    },
    {
      // Hipótese de ORDEM, não de formato: talvez ele só aceite nova duração
      // com o relógio já resetado. Hoje eu mando o update ANTES do reset.
      rotulo: "V8 reset ANTES do update",
      alvo: "00:11:00",
      preReset: true,
      msg: { clockTime: "00:11:00", clockDuration: "00:11:00", clockOverrun: true, clockIsPM: 0, clockName: nome, clockElapsedTime: "00:00:00" },
    },
  ];

  const iguais = (lido, alvo) => String(lido ?? "").replace(/\.\d+$/, "") === alvo;
  const leitura = async () => {
    await pp.lerRelogios();
    const c = pp.relogios[idx] ?? {};
    return { dur: c.clockDuration, tempo: c.clockTime, rodando: verdade(c.clockState) };
  };

  console.log(`\nTimer [${idx}] "${nome}" — estado antes: duração=${atual.clockDuration} tempo=${atual.clockTime}\n`);
  console.log("Cada variante escreve uma duração diferente. A que aparecer na leitura é a que funciona.\n");

  const vencedoras = [];
  for (const v of variantes) {
    pp.ws.enviarJson({ action: "clockStop", clockIndex: idx });
    await espera(200);
    if (v.preReset) {
      pp.ws.enviarJson({ action: "clockReset", clockIndex: idx });
      await espera(250);
    }
    pp.ws.enviarJson({ action: "clockUpdate", clockIndex: idx, clockType: 0, ...v.msg });
    await espera(500);
    const r = await leitura();
    const ok = iguais(r.dur, v.alvo) || iguais(r.tempo, v.alvo);
    if (ok) vencedoras.push(v);
    console.log(
      `${ok ? "✔ PEGOU " : "· ignorou"}  ${v.rotulo.padEnd(38)} pedi ${v.alvo} → duração=${r.dur} tempo=${r.tempo}`,
    );
  }

  console.log("");
  if (!vencedoras.length) {
    console.log("NENHUMA variante mudou a duração. Me manda esta saída inteira — o próximo passo é");
    console.log("olhar o tráfego do app ProPresenter Remote de verdade pra copiar a forma exata.");
  } else {
    const v = vencedoras[0];
    console.log(`FORMATO BOM: ${v.rotulo}`);
    console.log("Agora conferindo se o clockReset preserva ou apaga a duração nova…\n");
    pp.ws.enviarJson({ action: "clockStop", clockIndex: idx });
    await espera(200);
    pp.ws.enviarJson({ action: "clockUpdate", clockIndex: idx, clockType: 0, ...v.msg });
    await espera(400);
    console.log(`   depois do update ........ duração=${(await leitura()).dur}`);
    pp.ws.enviarJson({ action: "clockReset", clockIndex: idx });
    await espera(400);
    const posReset = await leitura();
    console.log(`   depois do clockReset .... duração=${posReset.dur} tempo=${posReset.tempo}`);
    pp.ws.enviarJson({ action: "clockStart", clockIndex: idx });
    await espera(1200);
    const posStart = await leitura();
    console.log(`   depois do clockStart .... tempo=${posStart.tempo} rodando=${posStart.rodando ? "sim" : "não"}`);
    console.log(
      `\n${iguais(posReset.dur, v.alvo) ? "O reset PRESERVA a duração nova — a sequência de 4 mensagens continua válida." : "⚠ O reset APAGOU a duração nova — vou tirar o clockReset da sequência."}`,
    );
  }

  pp.ws.enviarJson({ action: "clockStop", clockIndex: idx });
  await espera(300);
  console.log("\n(deixei o timer parado; a duração ficou no valor da última variante)\n");
  pp.fechar();
  process.exit(0);
}

async function testar(cfg, minutos) {
  const pp = new DriverPro76(cfg);
  await pp.ligar();
  const seg = Math.round(minutos * 60);
  log(`teste: aplicando ${hms(seg)} no timer índice ${pp.indice} e iniciando…`);
  await pp.aplicar({ nome: "Teste Sirvo", segundos: seg });
  await espera(1200);
  await pp.lerRelogios();
  const c = pp.relogios[pp.indice];
  if (c) log(`agora o timer está: ${c.clockTime ?? "?"} · rodando=${verdade(c.clockState) ? "sim" : "não"}`);
  log("se o cronômetro andou no ProPresenter, a integração está de pé.");
  pp.fechar();
  process.exit(0);
}

// ---------------------------------------------------------------- entrada

async function principal() {
  const args = process.argv.slice(2);
  const seco = args.includes("--seco");
  const cfg = lerConfig({ exigePro: !seco && !args.includes("--diagnosticar") });

  if (args.includes("--diagnosticar")) return diagnosticar(cfg);
  if (args.includes("--sonda")) return sondar(cfg);

  const iTeste = args.indexOf("--testar");
  if (iTeste !== -1) {
    const min = Number(args[iTeste + 1] ?? 1);
    if (!Number.isFinite(min) || min <= 0) morrer("uso: --testar <minutos>");
    return testar(cfg, min);
  }

  const driver = seco ? new DriverSeco() : new DriverPro76(cfg);
  const sair = () => {
    log("encerrando (o roteiro do Sirvo segue normal).");
    driver.fechar();
    process.exit(0);
  };
  process.on("SIGINT", sair);
  process.on("SIGTERM", sair);
  await rodar(cfg, driver);
}

principal().catch((e) => morrer(e?.stack || e?.message || String(e)));
