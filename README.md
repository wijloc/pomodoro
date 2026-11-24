# Pomodoro para Amazfit GTR 4 new (Zepp OS 1.0)

Mini app de pomodoro para o **Amazfit GTR 4 new** (deviceSource `9437441`, tela 480×480,
hardware do GTR 3 Pro, Zepp OS 1.0 / API 1.0).

> **Usando um agente de IA (Claude Code, Codex, Cursor…)?** Depois de clonar, peça:
> *"configure o ambiente e instale o app no meu relógio"*. O passo a passo para o agente
> está em [AGENTS.md](AGENTS.md); ele faz o que der pelo terminal e te guia nos passos
> que só você pode fazer (login, celular, relógio).

## Funções

**Ciclo pomodoro**
- 25 min de foco, 5 min de pausa e 15 min de pausa longa a cada 4 focos
- Cores por fase no anel e no título: **foco azul**, **pausa verde**, **pausa longa cinza**
- Uma 🍎 maçã para cada foco concluído no ciclo atual (bolinhas vazias para os que faltam)

**Controles**
- Na tela: Iniciar / Pausar / Retomar, Zerar e Pular
- **Pular** encerra a fase atual e a conta como concluída (um foco pulado ganha a maçã)
- Botão físico de baixo: Iniciar / Pausar. O de cima continua saindo do app
- Teste rápido: **segurar** o botão físico de baixo faz a fase atual acabar em 15 s

**Alerta de fim de fase (só vibração)**
- Vibra por 6 s com a vibração de alarme do relógio
- Enquanto vibra, um overlay na cor da próxima fase cobre a tela: tocar nele para a vibração
- Um alarme do sistema (`hmApp.alarmNew`) reabre o app no fim da fase mesmo se ele estiver
  fechado ou com a tela apagada

**Outros**
- Ícone próprio: uma maçã com um relógio no meio
- Estado salvo no relógio: o tempo é recalculado ao reabrir o app (zera se o relógio reiniciar)
- A tela fica acesa enquanto o timer roda
- Layout: nada sobrepõe o anel de progresso; todos os elementos ficam dentro do círculo
- Erros vão só para o log (`console.log`, visível no `zeus bridge`), nunca para a tela
- Idioma segue o do relógio: inglês por padrão e português (pt-BR/pt-PT) quando o relógio
  estiver em português

## Setup completo (do zero até o app no relógio)

Você vai precisar de: um computador (macOS, Linux ou Windows), o relógio pareado no app
**Zepp** do celular (iOS ou Android) e uma conta Zepp (a mesma usada no app).

### 1. Confirme o modelo do relógio

Este app foi feito para o **Amazfit GTR 4 new** (modelo **A2040**). Confira no relógio em
*Configurações → Sobre* ou no app Zepp (*Perfil → seu relógio*).

- É o GTR 4 new / A2040 → siga em frente.
- É outro modelo (GTR 4 comum, GTR 4 Limited Edition, Zepp OS 2+) → este app não roda
  nele; veja [Outros relógios](#outros-relógios).

### 2. Instale o Node.js

Precisa do Node.js LTS (18 ou mais novo). Confira com `node -v`. Se não tiver, a forma mais
simples é pelo [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Feche e abra o terminal e então:

```bash
nvm install --lts
```

(No macOS também dá com `brew install node`; no Windows, pelo instalador de nodejs.org.)

### 3. Instale a Zeus CLI (ferramenta oficial da Zepp)

```bash
npm install -g @zeppos/zeus-cli
```

Confira com `zeus --version`.

### 4. Faça login na Zeus

```bash
zeus login
```

Abre o navegador para entrar na conta Zepp. **Use a mesma conta do app Zepp do celular**: com
contas diferentes o bridge conecta, mas a instalação falha. Confira depois com `zeus status`.

### 5. Ative o modo desenvolvedor no app Zepp (celular)

1. No app Zepp: *Perfil → Configurações → Sobre*.
2. Toque **7 vezes** no ícone/logo do Zepp até aparecer a confirmação do modo desenvolvedor.
3. Volte em *Perfil → seu relógio*: agora aparece **Developer Mode** (Modo desenvolvedor).
4. Entre nele, toque em **+** e escolha **Bridge**. Deixe essa tela aberta, com o celular
   desbloqueado e o Bluetooth ligado, durante a instalação.

### 6. Clone o projeto e gere o pacote

```bash
git clone https://github.com/wijloc/pomodoro.git
```

```bash
cd pomodoro
```

```bash
npm run build
```

O pacote sai em `dist/`. Se o build funcionar, o projeto está pronto para instalar.

#### Sobre o `appId` (troque se você não é o autor)

O `appId` do repositório, **1137996**, é o do app **publicado na loja da Zepp**, cadastrado
na conta do autor no [console.zepp.com](https://console.zepp.com/). Se você clonou o projeto
para instalar no **seu** relógio, troque por um número seu antes do build:

- **Só instalar pelo bridge:** use qualquer inteiro entre 20000 e 30000 (é a faixa que o
  `zeus create` sorteia para apps de desenvolvimento; não precisa de cadastro).
- **Publicar a sua própria versão na loja:** crie o app no console e use o appId que ele gerar.

Assim seu app não se confunde com a versão da loja nem com outro app de desenvolvimento
seu. Mude **os dois lugares** com o mesmo número (o alarme usa o segundo):
- `app.json` → `app.appId`
- `page/index.js` → `const APP_ID`

e rode `npm run build` de novo.

### 7. Instale no relógio pelo bridge

Dentro da pasta do projeto:

```bash
zeus bridge
```

No prompt que abrir, digite:

```
connect
install
```

- `connect` deve responder algo como *successfully connected to app-iOS* (ou app-Android).
- `install` compila e envia o app. Se pedir para escolher um aparelho, escolha
  **Amazfit GTR 4 new**.
- Para sair do bridge: `exit` (ou Ctrl+C).

O app aparece na lista de apps do relógio como **Pomodoro**.

### 8. Teste rápido

Abra o app, toque em **Start** (ou **Iniciar**, com o relógio em português) e **segure o botão físico de baixo**: a fase acaba em 15 s,
o relógio vibra e mostra o overlay. Toque no overlay para parar.

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| `Install result: stage=failed ... Device not supported` | O relógio não é o GTR 4 new (deviceSource `9437441`). Confira o modelo (passo 1) e veja [Outros relógios](#outros-relógios). Se o modelo estiver certo, limpe o cache de aparelhos: `rm -rf ~/.zepp/.zeus_device*` (não apague `~/.zepp/.zeus`, que guarda seu login). |
| `connect` não acha o celular | Tela *Developer Mode → Bridge* fechada, celular bloqueado ou contas diferentes entre `zeus login` e o app Zepp. |
| Instalou, mas sumiu outro app de desenvolvimento do relógio (ou a versão da loja) | Os dois tinham o mesmo `appId`. Troque o deste projeto (veja [Sobre o `appId`](#sobre-o-appid-troque-se-você-não-é-o-autor)). |
| Instalação recusada por conta/permissão | Você está usando o `appId` 1137996, que é da conta do autor. Troque por um seu (mesma seção acima). |
| O app funciona, mas não reabre sozinho no fim da fase | `APP_ID` em `page/index.js` diferente de `app.appId` no `app.json`. Deixe os dois iguais e reinstale. |
| `appId is invalid` no build | O `appId` precisa ser um número maior que 10000. |
| O app abre mas não reage | Veja o log no terminal do `zeus bridge` (as mensagens começam com `[pomodoro]`). |

## Outros relógios

Este projeto só suporta o **Amazfit GTR 4 new** (Zepp OS 1.0, tela 480×480, deviceSource
`9437441`). O código usa a **API 1.0** (globais `hmUI`, `hmApp`, `hmSensor`…). Em outros
modelos a instalação falha com `Device not supported`.

Para tentar outro aparelho Zepp OS 1.0 de tela redonda 480×480 (ex.: GTR 3 Pro), basta
adicionar o deviceSource dele em `targets.gtr4new.platforms` no `app.json`. Relógios com
Zepp OS 2 ou 3 (como o GTR 4 e o GTR 4 Limited Edition, 466×466) precisam de um port para os
módulos `@zos/*`.

Para descobrir o deviceSource de um modelo, depois de rodar a Zeus uma vez:

```bash
grep -o '"deviceSource":[0-9]*,"productName":"[^"]*"' ~/.zepp/.zeus_devices
```

## Estrutura

- `app.json` — config v2, API 1.0, alvo `gtr4new` (deviceSource 9437441, designWidth 480)
- `page/index.js` — a página do pomodoro (UI, timer, alarme, vibração)
- `assets/gtr4new/` — ícone do app (`icon.png`, maçã com relógio) e as imagens da maçã
  (`apple.png`) e da bolinha (`dot.png`)
- `page/i18n/` — textos da interface: `en-US.po` (padrão), `pt-BR.po` e `pt-PT.po`
- `tools/make-icons.py` — gera os PNGs acima e o ícone da loja (Python 3, sem dependências)
- `tools/screenshot.html` + `tools/make-screenshots.sh` — geram as capturas da loja
  (360×360, fundo transparente, em inglês) com o Chrome headless
- `store/` — material da loja: `icon-240.png` e `screenshots/`
- `app.js` — entrada do app (exigida pelo Zepp OS)
- `AGENTS.md` — roteiro para agentes de IA configurarem e instalarem tudo

## Desenvolvimento

- `npm run build` gera o pacote; `npm run bridge` abre o bridge.
- Textos novos na interface: use `gettext('chave')` e adicione a chave nos três `.po`.
- Mudou o layout ou as cores? Ajuste também `tools/screenshot.html` e rode
  `bash tools/make-screenshots.sh` para atualizar as capturas da loja.
- A cada alteração no app, suba `version.code` e `version.name` no `app.json`.
- Regra de layout: nada pode sobrepor o anel de progresso (tudo dentro de ~200 px do centro).
- Na API 1.0 o `this` do `Page` não é confiável; o estado fica no objeto `P` do módulo.
- Repositório público: nunca versione tokens, `.env` ou arquivos de `~/.zepp`.
