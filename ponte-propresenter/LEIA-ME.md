# Ponte Sirvo → ProPresenter 7.6.1

Quando um bloco novo do roteiro fica ao vivo no Sirvo, esta ponte escreve a
duração planejada do bloco num timer do ProPresenter e dá start. É só isso.

**Ela roda no PC do ProPresenter**, porque é o único lugar de onde se pode falar
com o ProPresenter: o Sirvo está na internet em HTTPS e navegador não conversa
com `http://` da rede local. Um arquivo, zero dependências, nada instalado.

**Ela é descartável.** Se cair, se você fechar a janela, se a internet oscilar, o
roteiro do Sirvo continua igual. Nada no app depende dela. E ela só mexe no
timer que você configurar — a contagem de pré-culto que o operador põe na mão
fica intocada.

---

## Antes de ir pro PC do ProPresenter

**1. Crie a conta que a ponte usa.** No Sirvo, convide uma pessoa/conta dedicada
(ex.: `regia@suaigreja.com`), membro comum. Ela só precisa **ler** o roteiro —
não dê liderança nem admin. Anote email e senha.

**2. No ProPresenter, crie o timer que vai ser dirigido.** Um timer de
**contagem regressiva**, chamado exatamente **`BLOCO`** (ou outro nome, desde que
você ajuste o `config.json`). Coloque ele no layout de stage display / na tela em
que ele deve aparecer. A ponte **não cria** timer — a 7.6 não permite isso pela
rede.

**3. Anote a porta e a senha da rede.** ProPresenter → Preferências → **Rede**:
"Habilitar rede" ligado, a **porta**, e a senha de **controle** (controller). Se
tiver duas senhas (controle e observador), é a de **controle** — com a de
observador o ProPresenter autentica mas ignora comandos, e a ponte vai avisar
isso no log.

**4. Prepare a pasta.** Copie esta pasta inteira pro PC do ProPresenter (pendrive
ou OneDrive serve). Duplique `config.example.json` como **`config.json`** e
preencha:

- `supabaseUrl` e `supabaseAnonKey` → os mesmos valores de `NEXT_PUBLIC_SUPABASE_URL`
  e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local` do projeto, ou painel da Vercel).
  A chave `anon` é pública por natureza — ela já vai no navegador de todo mundo.
- `email` / `senha` → a conta do passo 1.
- `proPresenter.porta` / `proPresenter.senha` → passo 3.
- `proPresenter.timerNome` → `BLOCO`.

**5. Node.** Se o PC não tiver Node, o `.cmd` te dá as instruções. O caminho que
não instala nada: baixe o **ZIP** do Node x64 em nodejs.org, extraia, renomeie a
pasta pra `node` e ponha do lado do `ponte.js`.

---

## No PC do ProPresenter, em ordem

Com o ProPresenter **aberto**:

### `1-diagnosticar.cmd` — não mexe em nada

Confere o `config.json`, loga no Sirvo, conecta no ProPresenter e **lista os
timers com os índices**. A saída boa é assim:

```
=== 3/3 · ProPresenter ===
ProPresenter 7.6.1: autenticado em 127.0.0.1:20304 (controlador)

3 timer(s) — use o ÍNDICE da primeira coluna no config.json:

  [0] Tempo de Culto           tipo=corrido      duração=00:00:00.00  rodando=não
  [1] Pre-Servico              tipo=regressiva   duração=00:05:00.00  rodando=não
  [2] BLOCO                    tipo=regressiva   duração=00:00:00.00  rodando=não  ← é este
```

Duas coisas pra conferir aqui: a palavra **(controlador)** — sem ela a ponte não
consegue comandar nada — e o **`← é este`** no timer certo.

Se apareceu, fixe o índice no `config.json` (`"timerIndice": 2`). Ficar preso ao
nome funciona, mas o índice é imune a alguém renomear o timer.

### `2-testar-5-min.cmd` — **mexe** no ProPresenter

Escreve 5 minutos no timer e dá start. Olhe a tela do ProPresenter: o cronômetro
deve pular pra `05:00` e começar a descer. **Rode em ensaio, nunca com culto no
ar.**

Deu certo aqui? A integração está de pé.

### `3-ligar-ponte.cmd` — o dia a dia

Deixe a janela aberta durante o culto. Cada bloco novo aparece assim:

```
[19:32:04] ▶ "Louvor" — 00:12:00 no telão
```

Ctrl+C ou fechar a janela encerra. O `ponte.log` na pasta guarda o histórico.

### `0-ensaio-seco.cmd` — o modo desconfiado

Acompanha o roteiro de verdade e escreve na tela o que **teria** mandado, sem
tocar no ProPresenter. Roda em qualquer PC (nem precisa da porta/senha no
config). Bom pra assistir um culto inteiro antes de confiar.

---

## O que ela faz, exatamente

| Acontece no Sirvo | A ponte faz |
| --- | --- |
| Roteiro iniciado → bloco 1 ao vivo | escreve a duração do bloco 1 e dá start |
| Bloco encerrado → o seguinte fica ao vivo | escreve a duração do novo e dá start |
| Alguém edita observação/título/responsável | **nada** (não reinicia o timer no ar) |
| Alguém ajusta a duração do bloco **que já está no ar** | **nada** — ver limitação abaixo |
| Último bloco encerrado, ou culto encerrado | para o timer |
| Nenhum culto ao vivo | nada — o timer de pré-culto fica na mão do operador |
| A conexão com o ProPresenter cai e volta | reconecta sozinha, **sem** reiniciar o timer |
| Você fecha e reabre a ponte no meio do culto | reaplica o bloco atual — o cronômetro volta ao cheio |

A troca de bloco chega em até 1 segundo (a ponte pergunta ao Sirvo a cada
segundo enquanto há culto ao vivo, e a cada 10 fora dele).

**Limitação consciente:** ajustar a duração de um bloco que já está no ar não
mexe no timer. Reaplicar reiniciaria a contagem cheia no meio da pregação, o que
é pior que não fazer nada. Se isso incomodar na prática, dá pra tratar depois.

## Quando algo não vai

| Sintoma | Onde olhar |
| --- | --- |
| `ProPresenter recusou a senha` | é a senha de **controle**, não a de observador |
| autenticou mas diz **"só observador"** | mesma coisa: senha errada das duas |
| `timeout conectando` / `ECONNREFUSED` | "Habilitar rede" desligado, porta errada, ou ProPresenter fechado |
| `não achei um timer chamado "BLOCO"` | o timer não existe ou tem outro nome — rode o `1-diagnosticar` |
| `login falhou (400)` | email/senha da conta do Sirvo |
| `sem igreja (church_id nulo)` | a conta logou mas está pendente — destrave em Equipes |
| timer certo, telão não mostra | o timer não está no layout de stage display / na tela |

Se o ProPresenter **travar ou fechar** na hora que a ponte manda o comando: é o
risco conhecido do protocolo reverso da 7.6. Feche a ponte, reabra o
ProPresenter e me mande o `ponte.log` — o suspeito número um é o formato do
campo `clockOverrun`, e existe um interruptor pra isso no `config.json`
(`overrunBooleano: false`).

## Trocar de programa depois

A conversa com o ProPresenter está isolada na classe `DriverPro76`, e o resto da
ponte não sabe o que existe do outro lado. Migrar pro FreeShow é escrever um
`DriverFreeShow` — que é mais simples, porque lá é HTTP puro: um POST com
`edit_timer` e outro com `id_start_timer`. O laço, a leitura do Sirvo, os
diagnósticos e os testes continuam valendo.
