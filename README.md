# Pomodoro para Amazfit GTR 4 new (Zepp OS 1.0)

Mini app de pomodoro para o **Amazfit GTR 4 new** (deviceSource `9437441`, tela 480×480,
hardware do GTR 3 Pro, Zepp OS 1.0 / API 1.0).

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
- Estado salvo no relógio: o tempo é recalculado ao reabrir o app (zera se o relógio reiniciar)
- A tela fica acesa enquanto o timer roda
- Layout: nada sobrepõe o anel de progresso; todos os elementos ficam dentro do círculo
- Erros vão só para o log (`console.log`, visível no `zeus bridge`), nunca para a tela

## Instalar no relógio

Pré-requisitos: [Zeus CLI](https://docs.zepp.com/docs/guides/tools/cli/) logada com a mesma
conta do app Zepp e o Developer Mode ativo no app (Perfil → relógio → Developer Mode).

```bash
zeus bridge
# no prompt do bridge:
connect
install
```

Para só gerar o pacote: `zeus build -t gtr4new` (sai em `dist/`).

## Estrutura

- `app.json` — config v2, API 1.0, alvo `gtr4new`
- `page/index.js` — a página do pomodoro
- `assets/gtr4new/` — ícone do app e as imagens da maçã (`apple.png`) e da bolinha (`dot.png`)
- `variants/api2/` — versão antiga para API 2.0 (módulos `@zos/*`), para relógios com Zepp OS 2+

A cada alteração, suba `version.code` e `version.name` no `app.json`.
