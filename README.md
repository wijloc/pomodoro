# Pomodoro para Amazfit GTR 4 new (Zepp OS 1.0)

Mini app de pomodoro para o **Amazfit GTR 4 new** (deviceSource `9437441`, tela 480×480,
hardware do GTR 3 Pro, Zepp OS 1.0 / API 1.0).

## Funções

- 25 min de foco, 5 min de pausa e 15 min de pausa longa a cada 4 focos
- Anel de progresso com cor por fase, tempo restante e marcador de ciclos
- Botões na tela: Iniciar/Pausar/Retomar, Zerar e Pular
- Botão físico de baixo: Iniciar/Pausar (o de cima continua saindo do app)
- Estado salvo no relógio, então o tempo é recalculado ao reabrir o app
- Tela fica acesa enquanto o timer roda; vibra 3 vezes no fim de cada fase
- Linha amarela de depuração no topo (versão, `build ok` e erros)

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
- `assets/gtr4new/icon.png` — ícone do alvo
- `variants/api2/` — versão antiga para API 2.0 (módulos `@zos/*`), para relógios com Zepp OS 2+

A cada alteração, suba `version.code` e `version.name` no `app.json` e `APP_VERSION` em `page/index.js`.
