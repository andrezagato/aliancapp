# Régia → ProPresenter: o procedimento

O `LEIA-ME.md` explica **como funciona**. Este arquivo diz **o que fazer**, sem
opções — porque escolher no domingo de manhã é o que dá errado.

---

## As três perguntas, respondidas

**Qual máquina?**
O PC do ProPresenter. Não porque seja obrigatório, mas porque ali a conversa é
com `127.0.0.1` e não tem rede pra falhar. (Dá pra rodar de outra máquina da
rede — ver o fim deste arquivo — mas só vale a pena se o PC do ProPresenter não
ficar logado.)

**Qual login?**
Nenhum que você precise digitar no domingo. A ponte já tem o dela guardada no
`config.json`, e ela loga sozinha. Ver a seção abaixo, que é onde mora a
confusão.

**Precisa ficar aberto?**
**Não.** Nenhuma página, em nenhum navegador, em nenhuma máquina. A ponte é um
programa que roda escondido — não tem janela, não tem aba, não tem login pra
fazer. Mas **alguém precisa avançar os blocos** no Sirvo (pelo `/control` ou
pelo celular), porque a ponte só espelha o roteiro; ela não conduz.

---

## São DOIS logins, e eles não se misturam

Esta é a parte que confunde, e a culpa é da palavra "régia" servir pras duas
coisas.

| | Quem usa | Onde | Precisa digitar? |
| --- | --- | --- | --- |
| **Login da ponte** | o programa, sozinho | `config.json`, no PC do ProPresenter | não — está no arquivo |
| **Login do `/control`** | a pessoa da cabine | navegador, em qualquer aparelho | sim, ela digita |

A ponte **não usa** a conta do `/control`, e o `/control` **não sabe** que a
ponte existe. Se você deslogar do `/control`, o timer continua andando. Se a
ponte cair, o `/control` continua funcionando.

> **O login da ponte:** abra o `config.json` na pasta da ponte e olhe os campos
> `email` e `senha`. É esse. Qualquer conta **ativa** do Sirvo serve — ela só
> precisa ler o roteiro.

---

## Uma vez só (e nunca mais)

No PC do ProPresenter, com o ProPresenter **aberto**:

1. **`1-diagnosticar.cmd`** — não mexe em nada. Tem que aparecer a palavra
   **`(controlador)`** e o **`← é este`** no timer `BLOCO`.
   Se aparecer "só observador", a senha no `config.json` é a de observador; a
   certa é a de **controle**, em Preferências → Rede.

2. **`2-testar-5-min.cmd`** — **mexe** no ProPresenter. O cronômetro tem que
   pular pra `05:00` e descer. **Rode em ensaio, nunca com culto no ar.**

3. **`instalar-inicio-automatico.cmd`** — o passo que resolve o domingo. A partir
   daqui a ponte sobe **sozinha e escondida** toda vez que alguém faz logon nesse
   PC, e se recupera em 15s se cair.

Depois do passo 3, você não tem mais nada a fazer nesse PC. Nunca.

---

## Todo domingo (30 segundos)

**`ver-log.cmd`** no PC do ProPresenter. Ele responde uma de duas coisas:

- **`PONTE VIVA — último batimento há 4s`** → acabou. Pode fechar a janela
  (fechar o log **não** desliga a ponte).
- **`PONTE PARADA?`** → dê dois cliques em **`3-ligar-ponte.cmd`** e siga o culto.
  Depois, com calma, descubra por quê.

É só isso. Se você não quiser nem olhar o log, o custo de a ponte estar parada é
o cronômetro do telão não acompanhar — o roteiro no Sirvo funciona igual, e nada
do culto depende dela.

---

## A pegadinha que explica o domingo que não funcionou

A ponte sobe no **logon**, não no boot.

Se o PC reiniciou (update do Windows de madrugada, queda de luz) e parou na tela
de senha do Windows, **nada roda até alguém entrar**. O PC parece ligado, o
ProPresenter até pode estar aberto — e a ponte não está.

Por isso o `ver-log.cmd` de domingo existe. É a única coisa que distingue "está
tudo certo" de "reiniciou de madrugada e ninguém logou".

---

## Se você preferir outra máquina

Vale a pena num caso só: o PC do ProPresenter **não fica logado**, e outro PC da
mesma rede fica.

Copie a pasta pra esse outro PC e, no `config.json`, troque:

```json
"proPresenter": { "host": "192.168.0.XX", "porta": 20304, ... }
```

Onde `192.168.0.XX` é o IP do PC do ProPresenter. Aí precisa de três coisas que
no `127.0.0.1` você ganha de graça:

- **"Habilitar rede" ligado** no ProPresenter (já tem que estar, de qualquer jeito);
- **a porta liberada no Firewall do Windows** do PC do ProPresenter;
- **IP fixo ou reservado no roteador** — se o IP mudar, a ponte perde o alvo em
  silêncio, e o sintoma é idêntico a "a ponte está parada".

Rode o `1-diagnosticar.cmd` do PC novo pra confirmar que ele alcança. O resto do
procedimento é igual.
