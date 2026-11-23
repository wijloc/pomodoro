# Roteiro para agentes: configurar e instalar o Pomodoro no relógio

Você (agente) está ajudando uma pessoa que clonou este repositório a colocar o app no
relógio dela. Faça pelo terminal tudo que for possível e **guie a pessoa** nos passos que
só ela pode fazer. Fale no idioma da pessoa (o projeto é em português).

## Regras

- **Nunca peça, leia, imprima ou versione credenciais.** O login da Zeus fica em
  `~/.zepp/.zeus` (contém token): não abra esse arquivo, não mostre o conteúdo e não o
  copie para o projeto. Para saber se há login, use `zeus status`.
- **Comandos interativos são da pessoa.** `zeus login` (abre navegador) e `zeus bridge`
  (prompt interativo `connect`/`install`) devem ser rodados por ela no terminal dela.
  Diga o comando exato e espere ela contar o resultado; se você tiver um terminal
  compartilhado com a pessoa, pode ler a saída de lá.
- Não apague `~/.zepp/.zeus`. Para limpar cache de aparelhos, só `~/.zepp/.zeus_device*`.
- O repositório é público: se fizer commits, revise antes de subir (nada de tokens,
  e-mails pessoais ou arquivos de `~/.zepp`).
- Se alterar o app (código, assets ou `app.json`), suba `version.code` e `version.name`.

## Passo a passo

Marque cada passo como feito antes de seguir. Os comandos de checagem são seguros de rodar.

### 1. Modelo do relógio (pergunte à pessoa)

Pergunte o modelo (relógio: *Configurações → Sobre*; ou app Zepp: *Perfil → relógio*).
O app suporta **Amazfit GTR 4 new, modelo A2040** (deviceSource `9437441`, Zepp OS 1.0).

- Outro modelo → explique a seção *Outros relógios* do README antes de seguir; o app atual
  não vai instalar (erro `Device not supported`).
- Na dúvida, siga: o erro na instalação confirma.

### 2. Node.js

```bash
node -v
```

Precisa ser 18+. Se faltar: com nvm (`nvm install --lts`), Homebrew (`brew install node`)
ou instalador de nodejs.org. Peça permissão antes de instalar algo no sistema.

### 3. Zeus CLI

```bash
zeus --version || npm install -g @zeppos/zeus-cli
```

### 4. Login na Zeus (pessoa)

```bash
zeus status
```

Se não estiver logada, peça para a pessoa rodar `zeus login` e entrar com **a mesma conta
do app Zepp do celular**. Rode `zeus status` de novo para confirmar.

### 5. Modo desenvolvedor e Bridge no celular (pessoa)

Guie:
1. App Zepp → *Perfil → Configurações → Sobre* → tocar 7 vezes no logo do Zepp.
2. *Perfil → relógio → Developer Mode* → **+** → **Bridge**.
3. Deixar essa tela aberta, celular desbloqueado, Bluetooth ligado.

### 6. Build (você)

Na raiz do repositório:

```bash
npm run build
```

Deve terminar sem erro e gerar `dist/*.zab`. Se falhar, leia o erro: normalmente é Zeus
não instalada ou Node antigo.

### 7. Instalação pelo bridge (pessoa)

Peça para a pessoa rodar, na pasta do projeto:

```bash
zeus bridge
```

e no prompt digitar `connect` e depois `install` (escolhendo **Amazfit GTR 4 new** se
perguntar). Peça para ela colar a saída.

- `successfully connected` + instalação concluída → vá para o passo 8.
- `Device not supported` → modelo errado (passo 1) ou cache velho: rode
  `rm -rf ~/.zepp/.zeus_device*` e tente de novo.
- Erro de conta/permissão do app → o `appId` 27808 é da conta do autor. Peça para a pessoa
  criar um app em https://console.zepp.com/ e informar o novo appId; troque em
  `app.json` (`app.appId`) **e** em `page/index.js` (`const APP_ID`), suba a versão e
  rode o build de novo.
- `connect` falha → tela Bridge fechada, celular bloqueado ou contas diferentes.

### 8. Teste (pessoa)

Abrir o app **Pomodoro** no relógio → **Iniciar** → **segurar o botão físico de baixo**
(fase acaba em 15 s) → deve vibrar e mostrar o overlay; tocar nele para.

Se algo não funcionar, peça a saída do terminal do `zeus bridge` (linhas `[pomodoro] ...`).

## Referência técnica

- API 1.0 (globais `hmUI`, `hmApp`, `hmSensor`, `hmFS`, `hmSetting`, `timer`), sem módulos
  `@zos/*`. Docs: https://docs.zepp.com/docs/1.0/reference/
- Não use o `this` do `Page` para estado (chega `null` em callbacks); use o objeto `P`.
- Layout: tudo dentro do círculo interno do anel (centro 240,240, raio ~200).
- `zeus build -t gtr4new` é o mesmo que `npm run build`.
